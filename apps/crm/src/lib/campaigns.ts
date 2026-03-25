/**
 * CRM: Campaign list and detail for org workspaces. Uses stored data only; RLS-safe.
 * Campaign definition: workspace_id = operator; promoted_org_id = who is promoted; promoted_social_handles = accounts to track.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePromotedSocialHandlesForStorage } from "@/lib/trackedXHandle";

/** One social account to track for growth/reporting (e.g. { platform: "x", handle: "@acme" }). */
export type PromotedSocialHandle = { platform: string; handle: string };

export type CampaignRow = {
  id: string;
  workspace_id: string;
  title: string;
  description: string | null;
  starts_at: string | null;
  ends_at: string | null;
  budget: number | null;
  currency: string | null;
  status: string;
  created_at: string;
  updated_at: string;
  // Campaign definition extension
  reward_date?: string | null;
  campaign_value_usd?: number | null;
  token_or_usdt?: string | null;
  required_platforms?: string[] | null;
  weekly_required_posts?: number | null;
  daily_engagement_required?: string | null;
  promoted_org_id?: string | null;
  promoted_social_handles?: PromotedSocialHandle[] | null;
  campaign_objective?: string | null;
  guidance_links?: Array<{ label?: string; url: string }> | null;
  finalized_at?: string | null;
  follow_rules?: unknown;
  marketplace_enabled?: boolean;
  marketplace_category?: "creator_programs";
  visibility_mode?: "public" | "invite_only" | "private_hidden";
  accepting_new_users?: boolean;
  public_summary?: string | null;
};

export type CampaignListItem = CampaignRow & {
  participant_count: number;
  submission_count: number;
};

export type CampaignKpis = {
  total_views: number;
  total_engagements: number;
  /** All participant rows (invited + accepted + declined + removed). */
  total_contributors: number;
  /** Accepted participants only (more meaningful “live contributors”). */
  accepted_contributors: number;
  total_submissions: number;
  submissions_by_status: Record<"pending" | "approved" | "rejected" | "needs_revision", number>;
  tasks_by_status: Partial<Record<"backlog" | "to_do" | "in_progress" | "submitted" | "approved" | "rejected" | "done", number>>;
  budget_used: number;
  budget_total: number | null;
  currency: string;
  /** Cost per 1k impressions (tweet views); only when spend_used sum &gt; 0. */
  cpm: number | null;
  cpv: number | null;
  cpe: number | null;
  /** True when crm_campaign_metrics_daily has rows for this campaign. */
  has_metrics: boolean;
  /** Sum of total_posts from daily metric rows (tracked-account tweets in window). */
  metrics_posts_total: number;
  /** Latest ingest metadata (handle resolution, source), when present. */
  performance_meta: {
    source: string | null;
    handles_normalized: string[];
    handles_unresolved: string[];
    note: string | null;
    partial_impressions_hint?: boolean;
  } | null;
};

export type CampaignParticipantRow = {
  id: string;
  campaign_id: string;
  participant_profile_id: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
  x_follow_attestation?: unknown;
  x_follow_verification?: unknown;
};

export type CampaignSubmissionRow = {
  id: string;
  task_id: string;
  campaign_id: string;
  participant_profile_id: string;
  platform: string;
  url: string;
  title: string | null;
  notes: string | null;
  status: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  created_at: string;
  /** Optional per-link metrics (manual or future automation); keys vary. */
  metrics_snapshot?: Record<string, unknown> | null;
};

/** Top contributor: profile id + submission count (or engagement proxy). */
export type TopContributor = {
  participant_profile_id: string;
  submission_count: number;
};

const ORG_WORKSPACE_TYPES = ["org", "project", "brand", "agency"] as const;

/**
 * Fetch campaigns for org/project/brand/agency workspaces the user can access.
 * Creator workspaces are excluded so creator-only users get an empty list.
 * Includes participant and submission counts from stored data.
 */
export async function fetchCampaignsForUser(
  supabase: SupabaseClient
): Promise<CampaignListItem[]> {
  const { data: workspaces } = await supabase
    .from("crm_workspaces")
    .select("id")
    .in("type", ORG_WORKSPACE_TYPES);

  const orgWorkspaceIds = (workspaces ?? []).map((w) => (w as { id: string }).id);
  if (orgWorkspaceIds.length === 0) return [];

  const { data: campaigns } = await supabase
    .from("crm_campaigns")
    .select("id, workspace_id, title, description, starts_at, ends_at, budget, currency, status, created_at, updated_at, reward_date, campaign_value_usd, token_or_usdt, required_platforms, weekly_required_posts, daily_engagement_required, promoted_org_id, promoted_social_handles, campaign_objective, guidance_links, follow_rules, marketplace_enabled, marketplace_category, visibility_mode, accepting_new_users, public_summary")
    .in("workspace_id", orgWorkspaceIds)
    .order("updated_at", { ascending: false });

  if (!campaigns?.length) return [];

  const list: CampaignListItem[] = [];
  for (const c of campaigns as CampaignRow[]) {
    const [{ count: participantCount }, { count: submissionCount }] = await Promise.all([
      supabase.from("crm_campaign_participants").select("id", { count: "exact", head: true }).eq("campaign_id", c.id),
      supabase.from("crm_submissions").select("id", { count: "exact", head: true }).eq("campaign_id", c.id),
    ]);
    list.push({
      ...c,
      participant_count: participantCount ?? 0,
      submission_count: submissionCount ?? 0,
    });
  }
  return list;
}

/**
 * Get a single campaign by id. Returns null if not found or RLS denies access.
 */
export async function getCampaign(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignRow | null> {
  const { data } = await supabase
    .from("crm_campaigns")
    .select("id, workspace_id, title, description, starts_at, ends_at, budget, currency, status, created_at, updated_at, reward_date, campaign_value_usd, token_or_usdt, required_platforms, weekly_required_posts, daily_engagement_required, promoted_org_id, promoted_social_handles, campaign_objective, guidance_links, finalized_at, follow_rules, marketplace_enabled, marketplace_category, visibility_mode, accepting_new_users, public_summary")
    .eq("id", campaignId)
    .maybeSingle();

  if (!data) return null;
  const row = data as Record<string, unknown>;
  const handles = row.promoted_social_handles;
  return {
    ...row,
    promoted_social_handles: Array.isArray(handles) ? handles as PromotedSocialHandle[] : null,
  } as CampaignRow;
}

/**
 * Aggregate KPIs for a campaign from stored data only.
 * Uses crm_campaign_metrics_daily (sum), campaign budget, and counts.
 * Labels as insufficient when no daily metrics.
 */
export async function getCampaignKpis(
  supabase: SupabaseClient,
  campaignId: string,
  campaign: { budget: number | null; currency: string | null }
): Promise<CampaignKpis> {
  const { data: dailyRows } = await supabase
    .from("crm_campaign_metrics_daily")
    .select("day, total_views, total_engagements, total_posts, spend_used, metadata")
    .eq("campaign_id", campaignId)
    .order("day", { ascending: false });

  const totals = (dailyRows ?? []).reduce(
    (acc, row) => {
      acc.views += Number((row as { total_views?: number }).total_views) || 0;
      acc.engagements += Number((row as { total_engagements?: number }).total_engagements) || 0;
      acc.spend += Number((row as { spend_used?: number }).spend_used) || 0;
      acc.posts += Number((row as { total_posts?: number }).total_posts) || 0;
      return acc;
    },
    { views: 0, engagements: 0, spend: 0, posts: 0 }
  );

  type Meta = {
    source?: string;
    version?: number;
    handles_normalized?: string[];
    handles_linked_to_profiles?: string[];
    handles_external_tracked?: string[];
    handles_unresolved?: string[];
    handles_unmatched_promoted_raw?: string[];
    note?: string;
    partial_impressions?: string | null;
  };
  let performance_meta: CampaignKpis["performance_meta"] = null;
  let partial_impressions_hint = false;
  for (const row of dailyRows ?? []) {
    const m = (row as { metadata?: unknown }).metadata as Meta | null | undefined;
    if (!m || typeof m !== "object") continue;
    const linked = Array.isArray(m.handles_linked_to_profiles) ? m.handles_linked_to_profiles : [];
    const legacyNorm = Array.isArray(m.handles_normalized) ? m.handles_normalized : [];
    const external = Array.isArray(m.handles_external_tracked) ? m.handles_external_tracked : [];
    const mergedHandles = [...new Set([...linked, ...legacyNorm, ...external])];
    const unresolvedRaw = Array.isArray(m.handles_unmatched_promoted_raw)
      ? m.handles_unmatched_promoted_raw
      : Array.isArray(m.handles_unresolved)
        ? m.handles_unresolved
        : [];
    if (m.source || mergedHandles.length > 0 || unresolvedRaw.length > 0) {
      performance_meta = {
        source: m.source ?? null,
        handles_normalized: mergedHandles,
        handles_unresolved: unresolvedRaw,
        note: m.note ?? null,
        partial_impressions_hint: false,
      };
      break;
    }
  }
  for (const row of dailyRows ?? []) {
    const m = (row as { metadata?: unknown; total_views?: number; total_posts?: number }).metadata as Meta | null | undefined;
    const tv = Number((row as { total_views?: number }).total_views) || 0;
    const tp = Number((row as { total_posts?: number }).total_posts) || 0;
    if (tp > 0 && tv === 0) {
      partial_impressions_hint = true;
      break;
    }
    if (m?.partial_impressions) {
      partial_impressions_hint = true;
      break;
    }
  }
  if (performance_meta && partial_impressions_hint) {
    performance_meta = { ...performance_meta, partial_impressions_hint: true };
  }

  const submissionStatuses = ["pending", "approved", "rejected", "needs_revision"] as const;
  const taskStatuses = ["backlog", "to_do", "in_progress", "submitted", "approved", "rejected", "done"] as const;

  const [
    { count: contributorCount },
    { count: acceptedContributorCount },
    { count: submissionCount },
    ...submissionCountsByStatus
  ] = await Promise.all([
    supabase.from("crm_campaign_participants").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    supabase.from("crm_campaign_participants").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", "accepted"),
    supabase.from("crm_submissions").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    ...submissionStatuses.map((s) =>
      supabase.from("crm_submissions").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", s)
    ),
  ]);

  const submissions_by_status = submissionStatuses.reduce(
    (acc, s, i) => {
      acc[s] = submissionCountsByStatus[i]?.count ?? 0;
      return acc;
    },
    { pending: 0, approved: 0, rejected: 0, needs_revision: 0 } as Record<(typeof submissionStatuses)[number], number>
  );

  const taskCounts = await Promise.all(
    taskStatuses.map((s) =>
      supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId).eq("status", s)
    )
  );
  const tasks_by_status: Partial<Record<(typeof taskStatuses)[number], number>> = {};
  taskStatuses.forEach((s, i) => {
    tasks_by_status[s] = taskCounts[i]?.count ?? 0;
  });

  const budgetTotal = campaign.budget != null ? Number(campaign.budget) : null;
  const budgetUsed = totals.spend;
  const views = totals.views;
  const engagements = totals.engagements;
  const spendPositive = budgetUsed > 0;
  const cpm = views > 0 && spendPositive ? (budgetUsed / views) * 1000 : null;
  const cpv = views > 0 && spendPositive ? budgetUsed / views : null;
  const cpe = engagements > 0 && spendPositive ? budgetUsed / engagements : null;
  const hasMetrics = dailyRows != null && dailyRows.length > 0;

  return {
    total_views: views,
    total_engagements: engagements,
    total_contributors: contributorCount ?? 0,
    accepted_contributors: acceptedContributorCount ?? 0,
    total_submissions: submissionCount ?? 0,
    submissions_by_status,
    tasks_by_status,
    budget_used: budgetUsed,
    budget_total: budgetTotal,
    currency: campaign.currency ?? "USD",
    cpm,
    cpv,
    cpe,
    has_metrics: hasMetrics,
    metrics_posts_total: totals.posts,
    performance_meta,
  };
}

export type CampaignStatus = "draft" | "active" | "paused" | "completed" | "cancelled";

export async function setCampaignStatus(
  supabase: SupabaseClient,
  campaignId: string,
  status: CampaignStatus
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("crm_campaigns")
    .update({ status, updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) return { error: error.message };
  return {};
}

export async function createCampaignDraft(
  supabase: SupabaseClient,
  payload: {
    workspace_id: string;
    title: string;
    description?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    budget?: number | null;
    currency?: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const title = payload.title.trim();
  if (!title) return { error: "Title is required" };
  const { data, error } = await supabase
    .from("crm_campaigns")
    .insert({
      workspace_id: payload.workspace_id,
      title,
      description: payload.description?.trim() || null,
      starts_at: payload.starts_at ?? null,
      ends_at: payload.ends_at ?? null,
      budget: payload.budget ?? null,
      currency: payload.currency?.trim() || "USD",
      status: "draft",
      updated_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) return { error: error.message };
  if (!data?.id) return { error: "Insert failed" };
  return { id: data.id };
}

export async function deleteDraftCampaignIfSafe(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{ error?: string }> {
  const camp = await getCampaign(supabase, campaignId);
  if (!camp) return { error: "Campaign not found or access denied" };
  if (camp.status !== "draft") return { error: "Only draft campaigns can be deleted" };
  const [{ count: participants }, { count: subs }, { count: tasks }] = await Promise.all([
    supabase.from("crm_campaign_participants").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    supabase.from("crm_submissions").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    supabase.from("crm_tasks").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
  ]);
  if ((participants ?? 0) > 0 || (subs ?? 0) > 0 || (tasks ?? 0) > 0) {
    return { error: "Draft has activity; cancel instead of delete" };
  }
  const { error } = await supabase.from("crm_campaigns").delete().eq("id", campaignId);
  if (error) return { error: error.message };
  return {};
}

export async function getCampaignContributors(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignParticipantRow[]> {
  const { data } = await supabase
    .from("crm_campaign_participants")
    .select("id, campaign_id, participant_profile_id, role, status, invited_at, accepted_at, x_follow_attestation, x_follow_verification")
    .eq("campaign_id", campaignId)
    .order("accepted_at", { ascending: false, nullsFirst: false });

  return (data ?? []) as CampaignParticipantRow[];
}

export async function getCampaignSubmissions(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignSubmissionRow[]> {
  const { data } = await supabase
    .from("crm_submissions")
    .select(
      "id, task_id, campaign_id, participant_profile_id, platform, url, title, notes, status, reviewed_at, rejection_reason, created_at, metrics_snapshot"
    )
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  return (data ?? []) as CampaignSubmissionRow[];
}

/**
 * Top contributors by submission count (stored data only).
 */
function submissionCountsByParticipant(
  rows: { participant_profile_id: string }[] | null | undefined
): TopContributor[] {
  const byProfile = new Map<string, number>();
  for (const row of rows ?? []) {
    const pid = row.participant_profile_id;
    byProfile.set(pid, (byProfile.get(pid) ?? 0) + 1);
  }
  return Array.from(byProfile.entries())
    .map(([participant_profile_id, submission_count]) => ({ participant_profile_id, submission_count }))
    .sort((a, b) => b.submission_count - a.submission_count)
    .slice(0, 10);
}

/** All submissions (every status). Rank = raw proof rows submitted. */
export async function getCampaignTopContributors(
  supabase: SupabaseClient,
  campaignId: string
): Promise<TopContributor[]> {
  const { data } = await supabase
    .from("crm_submissions")
    .select("participant_profile_id")
    .eq("campaign_id", campaignId);

  return submissionCountsByParticipant(data as { participant_profile_id: string }[] | null);
}

/** Approved submissions only (proof-of-work accepted). */
export async function getCampaignTopContributorsByApprovedSubmissions(
  supabase: SupabaseClient,
  campaignId: string
): Promise<TopContributor[]> {
  const { data } = await supabase
    .from("crm_submissions")
    .select("participant_profile_id")
    .eq("campaign_id", campaignId)
    .eq("status", "approved");

  return submissionCountsByParticipant(data as { participant_profile_id: string }[] | null);
}

/** Payload for updating campaign definition (operator = workspace_id is unchanged). */
export type UpdateCampaignDefinitionPayload = {
  reward_date?: string | null;
  campaign_value_usd?: number | null;
  token_or_usdt?: string | null;
  required_platforms?: string[] | null;
  weekly_required_posts?: number | null;
  daily_engagement_required?: string | null;
  promoted_org_id?: string | null;
  promoted_social_handles?: PromotedSocialHandle[] | null;
  campaign_objective?: string | null;
  guidance_links?: Array<{ label?: string; url: string }> | null;
  follow_rules?: unknown;
  marketplace_enabled?: boolean;
  marketplace_category?: "creator_programs";
  visibility_mode?: "public" | "invite_only" | "private_hidden";
  accepting_new_users?: boolean;
  public_summary?: string | null;
};

/**
 * Update campaign definition fields. RLS: caller must be workspace member.
 * Does not change workspace_id (operator). Sync is unchanged.
 */
export async function updateCampaignDefinition(
  supabase: SupabaseClient,
  campaignId: string,
  payload: UpdateCampaignDefinitionPayload
): Promise<{ error?: string }> {
  const update: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (payload.reward_date !== undefined) update.reward_date = payload.reward_date?.trim() || null;
  if (payload.campaign_value_usd !== undefined) update.campaign_value_usd = payload.campaign_value_usd;
  if (payload.token_or_usdt !== undefined) update.token_or_usdt = payload.token_or_usdt?.trim() || null;
  if (payload.required_platforms !== undefined) update.required_platforms = payload.required_platforms ?? [];
  if (payload.weekly_required_posts !== undefined) update.weekly_required_posts = payload.weekly_required_posts;
  if (payload.daily_engagement_required !== undefined)
    update.daily_engagement_required = payload.daily_engagement_required?.trim() || null;
  if (payload.promoted_org_id !== undefined) update.promoted_org_id = payload.promoted_org_id?.trim() || null;
  if (payload.promoted_social_handles !== undefined)
    update.promoted_social_handles = Array.isArray(payload.promoted_social_handles)
      ? normalizePromotedSocialHandlesForStorage(payload.promoted_social_handles as PromotedSocialHandle[])
      : [];
  if (payload.campaign_objective !== undefined)
    update.campaign_objective = payload.campaign_objective?.trim() || null;
  if (payload.guidance_links !== undefined)
    update.guidance_links = Array.isArray(payload.guidance_links) ? payload.guidance_links : [];
  if (payload.follow_rules !== undefined) update.follow_rules = payload.follow_rules ?? {};
  if (payload.marketplace_enabled !== undefined) update.marketplace_enabled = payload.marketplace_enabled;
  if (payload.marketplace_category !== undefined) update.marketplace_category = payload.marketplace_category;
  if (payload.visibility_mode !== undefined) update.visibility_mode = payload.visibility_mode;
  if (payload.accepting_new_users !== undefined) update.accepting_new_users = payload.accepting_new_users;
  if (payload.public_summary !== undefined) update.public_summary = payload.public_summary?.trim() || null;

  const { error } = await supabase.from("crm_campaigns").update(update).eq("id", campaignId);
  if (error) return { error: error.message };
  return {};
}

/**
 * Set campaign finalized_at to now. Used by finalize flow. RLS: caller must be workspace member.
 */
export async function setCampaignFinalized(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("crm_campaigns")
    .update({ finalized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
    .eq("id", campaignId);
  if (error) return { error: error.message };
  return {};
}
