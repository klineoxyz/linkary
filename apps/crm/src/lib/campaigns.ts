/**
 * CRM: Campaign list and detail for org workspaces. Uses stored data only; RLS-safe.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

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
};

export type CampaignListItem = CampaignRow & {
  participant_count: number;
  submission_count: number;
};

export type CampaignKpis = {
  total_views: number;
  total_engagements: number;
  total_contributors: number;
  total_submissions: number;
  budget_used: number;
  budget_total: number | null;
  currency: string;
  cpv: number | null;
  cpe: number | null;
  /** True when metrics are from stored snapshots; false when no data. */
  has_metrics: boolean;
};

export type CampaignParticipantRow = {
  id: string;
  campaign_id: string;
  participant_profile_id: string;
  role: string;
  status: string;
  invited_at: string;
  accepted_at: string | null;
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
    .select("id, workspace_id, title, description, starts_at, ends_at, budget, currency, status, created_at, updated_at")
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
    .select("id, workspace_id, title, description, starts_at, ends_at, budget, currency, status, created_at, updated_at")
    .eq("id", campaignId)
    .maybeSingle();

  return data as CampaignRow | null;
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
    .select("total_views, total_engagements, total_contributors, spend_used")
    .eq("campaign_id", campaignId);

  const totals = (dailyRows ?? []).reduce(
    (acc, row) => {
      acc.views += Number((row as { total_views?: number }).total_views) || 0;
      acc.engagements += Number((row as { total_engagements?: number }).total_engagements) || 0;
      acc.spend += Number((row as { spend_used?: number }).spend_used) || 0;
      return acc;
    },
    { views: 0, engagements: 0, spend: 0 }
  );

  const [{ count: contributorCount }, { count: submissionCount }] = await Promise.all([
    supabase.from("crm_campaign_participants").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
    supabase.from("crm_submissions").select("id", { count: "exact", head: true }).eq("campaign_id", campaignId),
  ]);

  const budgetTotal = campaign.budget != null ? Number(campaign.budget) : null;
  const budgetUsed = totals.spend;
  const views = totals.views;
  const engagements = totals.engagements;
  const cpv = views > 0 && budgetUsed != null ? budgetUsed / views : null;
  const cpe = engagements > 0 && budgetUsed != null ? budgetUsed / engagements : null;
  const hasMetrics = dailyRows != null && dailyRows.length > 0;

  return {
    total_views: views,
    total_engagements: engagements,
    total_contributors: contributorCount ?? 0,
    total_submissions: submissionCount ?? 0,
    budget_used: budgetUsed,
    budget_total: budgetTotal,
    currency: campaign.currency ?? "USD",
    cpv,
    cpe,
    has_metrics: hasMetrics,
  };
}

export async function getCampaignContributors(
  supabase: SupabaseClient,
  campaignId: string
): Promise<CampaignParticipantRow[]> {
  const { data } = await supabase
    .from("crm_campaign_participants")
    .select("id, campaign_id, participant_profile_id, role, status, invited_at, accepted_at")
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
    .select("id, task_id, campaign_id, participant_profile_id, platform, url, title, notes, status, reviewed_at, rejection_reason, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false });

  return (data ?? []) as CampaignSubmissionRow[];
}

/**
 * Top contributors by submission count (stored data only).
 */
export async function getCampaignTopContributors(
  supabase: SupabaseClient,
  campaignId: string
): Promise<TopContributor[]> {
  const { data } = await supabase
    .from("crm_submissions")
    .select("participant_profile_id")
    .eq("campaign_id", campaignId);

  const byProfile = new Map<string, number>();
  for (const row of data ?? []) {
    const pid = (row as { participant_profile_id: string }).participant_profile_id;
    byProfile.set(pid, (byProfile.get(pid) ?? 0) + 1);
  }
  return Array.from(byProfile.entries())
    .map(([participant_profile_id, submission_count]) => ({ participant_profile_id, submission_count }))
    .sort((a, b) => b.submission_count - a.submission_count)
    .slice(0, 10);
}
