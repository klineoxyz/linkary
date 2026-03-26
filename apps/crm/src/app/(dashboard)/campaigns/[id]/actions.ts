"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  getCampaign,
  setCampaignFinalized,
  setCampaignStatus,
  updateCampaignDefinition,
} from "@/lib/campaigns";
import type { PromotedSocialHandle } from "@/lib/campaigns";
import {
  getSubmissionWithCampaignWorkspace,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { generateRecurringTasksForCampaignWeek } from "@/lib/recurring";
import { reconcileCampaignContributionFromSubmissions } from "@/lib/campaignContributionReconcile";
import { writeContribution } from "@/lib/contribution";
import { upsertAccountSnapshot } from "@/lib/snapshots";
import type { SnapshotMetrics, SnapshotType } from "@/lib/snapshots";
import { revalidatePath } from "next/cache";
import {
  fetchXAccountPreview,
  getTwitterApiKeyFromEnv,
  parseXHandleInput,
} from "@/lib/xUserPreview";

const REVIEW_STATUSES = ["approved", "rejected", "needs_revision"] as const;
const FOLLOW_VERIFICATION_STATUSES = ["pending", "verified", "waived"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type PromotedAccountPreview =
  | {
      ok: true;
      kind: "linkary_org";
      org_id: string;
      name: string | null;
      slug: string | null;
      twitter_username: string | null;
    }
  | {
      ok: true;
      kind: "x_profile";
      handle: string;
      display_name: string | null;
      bio: string | null;
      profile_image_url: string | null;
      followers: number | null;
      following: number | null;
      verified: boolean;
      profile_url: string;
    }
  | { ok: true; kind: "x_handle_only"; handle: string; message: string }
  | { ok: false; error: string };

/**
 * Resolve promoted field input to a human-visible preview (Linkary org row or live X profile).
 * RLS: caller must have access to the campaign workspace.
 */
export async function previewPromotedAccountAction(
  campaignId: string,
  rawInput: string
): Promise<PromotedAccountPreview> {
  const supabase = await createServerSupabase();
  if (!supabase) return { ok: false, error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { ok: false, error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { ok: false, error: "Campaign not found or access denied" };

  const trimmed = rawInput.trim();
  if (!trimmed) return { ok: false, error: "Enter a value to preview" };

  if (UUID_RE.test(trimmed)) {
    const { data: org } = await supabase
      .from("orgs")
      .select("id,name,slug,twitter_username")
      .eq("id", trimmed)
      .maybeSingle();
    const row = org as { id: string; name: string | null; slug: string | null; twitter_username: string | null } | null;
    if (row) {
      return {
        ok: true,
        kind: "linkary_org",
        org_id: row.id,
        name: row.name,
        slug: row.slug,
        twitter_username: row.twitter_username,
      };
    }
    return { ok: false, error: "No Linkary org found for this UUID" };
  }

  const handle = parseXHandleInput(trimmed);
  if (!handle) return { ok: false, error: "Invalid X handle or URL" };
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    return { ok: false, error: "Invalid X handle format" };
  }

  const apiKey = getTwitterApiKeyFromEnv();
  if (!apiKey) {
    return {
      ok: true,
      kind: "x_handle_only",
      handle,
      message:
        "Live X profile preview needs TWITTERAPI_API_KEY (or TWITTERAPI_IO_KEY) on the CRM server. You can still save; the handle will be tracked.",
    };
  }

  const preview = await fetchXAccountPreview(handle, apiKey);
  if (!preview) {
    return { ok: false, error: "X profile not found or could not be loaded. Check the handle." };
  }

  return {
    ok: true,
    kind: "x_profile",
    handle: preview.handle,
    display_name: preview.display_name,
    bio: preview.bio,
    profile_image_url: preview.profile_image_url,
    followers: preview.followers,
    following: preview.following,
    verified: preview.verified,
    profile_url: preview.profile_url,
  };
}

async function resolveXHandle(handleInput: string): Promise<{ handle: string | null; error?: string }> {
  const handle = parseXHandleInput(handleInput);
  if (!handle) return { handle: null };
  if (!/^[a-z0-9_]{1,15}$/i.test(handle)) {
    return { handle: null, error: "Invalid X handle format" };
  }

  const apiKey = process.env.TWITTERAPI_IO_KEY?.trim() || process.env.TWITTERAPI_API_KEY?.trim();
  if (!apiKey) {
    // Beta-safe fallback: accept normalized handle even when lookup key isn't configured.
    return { handle };
  }

  try {
    const res = await fetch(`https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(handle)}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) {
      return { handle: null, error: "Could not verify X handle. Check handle and try again." };
    }
    const data = (await res.json().catch(() => ({}))) as {
      data?: { userName?: string; user_name?: string; screen_name?: string };
      userName?: string;
      username?: string;
      screen_name?: string;
    };
    const resolved =
      data.data?.userName ??
      data.data?.user_name ??
      data.data?.screen_name ??
      data.userName ??
      data.username ??
      data.screen_name ??
      handle;
    const normalized = String(resolved).replace(/^@/, "").trim().toLowerCase();
    if (!/^[a-z0-9_]{1,15}$/i.test(normalized)) {
      return { handle: null, error: "Could not verify X handle. Check handle and try again." };
    }
    return { handle: normalized };
  } catch {
    return { handle: null, error: "Could not verify X handle. Check handle and try again." };
  }
}

/**
 * Org review action: approve, reject, or request revision on a submission.
 * Permission-gated: caller must be a member of the campaign's workspace and must
 * not be the submission's participant (creators cannot review their own).
 */
/**
 * Workspace member: set manual X follow verification / waive on a participant row.
 * Audit fields are merged into x_follow_verification JSON (no recurring API checks).
 */
export async function updateParticipantFollowVerificationAction(
  campaignId: string,
  participantRowId: string,
  status: (typeof FOLLOW_VERIFICATION_STATUSES)[number],
  note?: string | null,
  waiveReason?: string | null
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  if (!FOLLOW_VERIFICATION_STATUSES.includes(status)) {
    return { error: "Invalid verification status" };
  }

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const { data: row, error: selErr } = await supabase
    .from("crm_campaign_participants")
    .select("id, x_follow_verification")
    .eq("id", participantRowId)
    .eq("campaign_id", campaignId)
    .maybeSingle();

  if (selErr || !row) return { error: "Participant not found or access denied" };

  const existing =
    row.x_follow_verification && typeof row.x_follow_verification === "object"
      ? ({ ...(row.x_follow_verification as Record<string, unknown>) } as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  const now = new Date().toISOString();
  const events = Array.isArray(existing.events) ? [...(existing.events as unknown[])] : [];

  if (status === "waived") {
    const wr = waiveReason?.trim() ?? "";
    if (!wr) return { error: "Waive reason is required" };
    events.push({ at: now, by: user.id, action: "waived", reason: wr });
  } else if (status === "verified") {
    events.push({ at: now, by: user.id, action: "verified", note: note?.trim() || null });
  } else {
    events.push({ at: now, by: user.id, action: "reset_pending" });
  }

  const next: Record<string, unknown> = {
    ...existing,
    status,
    decided_at: now,
    decided_by_profile_id: user.id,
    note: note?.trim() || null,
  };
  if (status === "waived") {
    next.waive_reason = waiveReason?.trim() ?? null;
  } else {
    next.waive_reason = null;
  }
  next.events = events;

  const { error } = await supabase
    .from("crm_campaign_participants")
    .update({ x_follow_verification: next, updated_at: now })
    .eq("id", participantRowId)
    .eq("campaign_id", campaignId);

  if (error) return { error: error.message };
  revalidatePath(`/campaigns/${campaignId}`);
  return {};
}

export async function reviewSubmissionAction(
  submissionId: string,
  status: (typeof REVIEW_STATUSES)[number],
  note?: string | null
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const row = await getSubmissionWithCampaignWorkspace(supabase, submissionId);
  if (!row) return { error: "Submission not found or access denied" };

  const { submission } = row;
  if (submission.participant_profile_id === user.id) {
    return { error: "You cannot review your own submission" };
  }

  const campaign = await getCampaign(supabase, submission.campaign_id!);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const result = await updateSubmissionStatus(
    supabase,
    submissionId,
    status,
    note?.trim() || null,
    user.id
  );

  if (result.error) return result;

  // Keep crm_tasks.status in sync with proof review so contribution/KPIs reflect reality.
  // Map submission review to closest task status:
  // - approved => approved
  // - rejected => rejected
  // - needs_revision => in_progress (work needs changes, not approved)
  const taskStatus =
    status === "approved" ? "approved" : status === "rejected" ? "rejected" : "in_progress";
  const { error: taskUpdErr } = await supabase
    .from("crm_tasks")
    .update({ status: taskStatus, updated_at: new Date().toISOString() })
    .eq("id", submission.task_id);

  if (taskUpdErr) return { error: `Could not sync linked task: ${taskUpdErr.message}` };

  if (!campaign.finalized_at) {
    await writeContribution(supabase, submission.campaign_id!, { weighted: true });
  }

  revalidatePath(`/campaigns/${submission.campaign_id}`);
  revalidatePath(`/campaigns/${submission.campaign_id}/report`);
  revalidatePath("/campaigns");
  return {};
}

/**
 * Update campaign definition (operator workspace unchanged).
 * RLS: caller must be member of campaign's workspace.
 */
export async function updateCampaignDefinitionAction(
  campaignId: string,
  formData: FormData
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const rewardDateRaw = (formData.get("reward_date") as string | null)?.trim() || null;
  const reward_date = rewardDateRaw ? rewardDateRaw : null;
  const campaignValueRaw = formData.get("campaign_value_usd") as string | null;
  const campaign_value_usd =
    campaignValueRaw != null && campaignValueRaw !== ""
      ? Number(campaignValueRaw)
      : null;
  const token_or_usdt = (formData.get("token_or_usdt") as string | null)?.trim() || null;
  const requiredPlatformsRaw = (formData.get("required_platforms") as string | null)?.trim();
  const required_platforms =
    requiredPlatformsRaw ? requiredPlatformsRaw.split(/[\s,]+/).filter(Boolean) : [];
  const weeklyRaw = formData.get("weekly_required_posts") as string | null;
  const weekly_required_posts =
    weeklyRaw != null && weeklyRaw !== "" ? Number(weeklyRaw) : null;
  const daily_engagement_required = (formData.get("daily_engagement_required") as string | null)?.trim() || null;
  const campaign_objective = (formData.get("campaign_objective") as string | null)?.trim() || null;
  const promotedOrgInput = (formData.get("promoted_org_id") as string | null)?.trim() || "";
  let promoted_org_id: string | null = null;
  const promotedHandlesRaw = (formData.get("promoted_social_handles") as string | null)?.trim();
  let promoted_social_handles: PromotedSocialHandle[] = [];
  if (promotedHandlesRaw) {
    const lines = promotedHandlesRaw.split(/\n/).filter((s) => s.trim());
    for (const line of lines) {
      const [platform, ...rest] = line.split(",").map((s) => s.trim());
      const handle = rest.join(",").trim();
      if (platform && handle) promoted_social_handles.push({ platform, handle });
    }
  }

  if (promotedOrgInput) {
    if (UUID_RE.test(promotedOrgInput)) {
      promoted_org_id = promotedOrgInput;
    } else {
      const resolved = await resolveXHandle(promotedOrgInput);
      if (resolved.error) return { error: resolved.error };
      if (resolved.handle) {
        const exists = promoted_social_handles.some(
          (h) => h.platform.toLowerCase() === "x" && h.handle.replace(/^@/, "").toLowerCase() === resolved.handle
        );
        if (!exists) {
          promoted_social_handles = [
            { platform: "x", handle: `@${resolved.handle}` },
            ...promoted_social_handles,
          ];
        }
      }
    }
  }

  const guidanceParsed = parseGuidanceLinksFromForm(formData);
  if (guidanceParsed.error) return { error: guidanceParsed.error };

  const require_x_follow = formData.get("require_x_follow") === "on";
  const mustFollowRaw = (formData.get("must_follow_handles") as string | null)?.trim() ?? "";
  const must_follow_handles = mustFollowRaw
    ? mustFollowRaw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter(Boolean)
    : [];
  const follow_rules_notes = (formData.get("follow_rules_notes") as string | null)?.trim() || null;
  const marketplace_enabled = formData.get("marketplace_enabled") === "on";
  const marketplace_category = "creator_programs" as const;
  const visibilityRaw = (formData.get("visibility_mode") as string | null)?.trim();
  const visibility_mode: "public" | "invite_only" | "private_hidden" =
    visibilityRaw === "public" || visibilityRaw === "invite_only" || visibilityRaw === "private_hidden"
      ? visibilityRaw
      : "private_hidden";
  const accepting_new_users = formData.get("accepting_new_users") === "on";
  const public_summary = (formData.get("public_summary") as string | null)?.trim() || null;

  const follow_rules: Record<string, unknown> = { require_x_follow };
  if (must_follow_handles.length) follow_rules.must_follow_handles = must_follow_handles;
  if (follow_rules_notes) follow_rules.notes = follow_rules_notes;

  const result = await updateCampaignDefinition(supabase, campaignId, {
    reward_date,
    campaign_value_usd: Number.isNaN(campaign_value_usd) ? null : campaign_value_usd,
    token_or_usdt,
    required_platforms: required_platforms.length ? required_platforms : [],
    weekly_required_posts: Number.isNaN(weekly_required_posts) ? null : weekly_required_posts,
    daily_engagement_required,
    promoted_org_id: promoted_org_id || null,
    promoted_social_handles,
    campaign_objective,
    guidance_links: guidanceParsed.links,
    follow_rules,
    marketplace_enabled,
    marketplace_category,
    visibility_mode,
    accepting_new_users,
    public_summary,
  });

  if (result.error) return result;
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return { success: true };
}

function normalizeHttpUrl(raw: string): string | null {
  const t = raw.trim();
  if (!t) return null;
  if (/^https?:\/\//i.test(t)) {
    try {
      return new URL(t).toString();
    } catch {
      return null;
    }
  }
  try {
    return new URL(`https://${t}`).toString();
  } catch {
    return null;
  }
}

/** Up to 5 creator resource URLs (posts to amplify, Notion briefs, etc.). */
function parseGuidanceLinksFromForm(
  formData: FormData
): { links: Array<{ label?: string; url: string }>; error?: string } {
  const links: Array<{ label?: string; url: string }> = [];
  for (let i = 0; i < 5; i++) {
    const urlRaw = (formData.get(`guidance_link_${i}_url`) as string | null)?.trim() || "";
    const labelRaw = (formData.get(`guidance_link_${i}_label`) as string | null)?.trim() || "";
    if (!urlRaw) continue;
    const url = normalizeHttpUrl(urlRaw);
    if (!url) return { links: [], error: `Creator resource ${i + 1}: enter a valid URL` };
    if (labelRaw) links.push({ label: labelRaw, url });
    else links.push({ url });
  }
  return { links };
}

/**
 * Generate recurring tasks for the current week (weekly_post + daily_engagement from campaign definition).
 * RLS: caller must be member of campaign's workspace.
 */
export async function generateRecurringTasksAction(
  campaignId: string
): Promise<{ error?: string; tasks_created?: number }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const result = await generateRecurringTasksForCampaignWeek(supabase, campaignId);
  if (!result.ok) return { error: result.error ?? "Generation failed" };

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  revalidatePath("/tasks");
  return { tasks_created: result.tasks_created ?? 0 };
}

function parseOptionalNumber(v: string | null): number | null {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isNaN(n) ? null : n;
}

/**
 * Record baseline / daily / end snapshots for all promoted_social_handles with the same metrics and timestamp.
 * Stored data only; no fake metrics. RLS: caller must be workspace member.
 */
export async function recordSnapshotAction(
  campaignId: string,
  formData: FormData
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const handles = campaign.promoted_social_handles ?? [];
  if (handles.length === 0) return { error: "No promoted social handles; add them in campaign definition" };

  const snapshotType = (formData.get("snapshot_type") as string | null)?.trim() as SnapshotType | undefined;
  if (!snapshotType || !["baseline", "daily", "end"].includes(snapshotType)) {
    return { error: "Invalid snapshot_type" };
  }

  const snapshotAtRaw = (formData.get("snapshot_at") as string | null)?.trim();
  const snapshotAt = snapshotAtRaw
    ? new Date(snapshotAtRaw).toISOString()
    : new Date().toISOString();

  const metrics = {
    followers: parseOptionalNumber(formData.get("followers") as string | null),
    views: parseOptionalNumber(formData.get("views") as string | null),
    likes: parseOptionalNumber(formData.get("likes") as string | null),
    replies: parseOptionalNumber(formData.get("replies") as string | null),
    quotes: parseOptionalNumber(formData.get("quotes") as string | null),
    reposts: parseOptionalNumber(formData.get("reposts") as string | null),
    engagement_total: parseOptionalNumber(formData.get("engagement_total") as string | null),
  };

  for (const { platform, handle } of handles) {
    const out = await upsertAccountSnapshot(
      supabase,
      campaignId,
      platform,
      handle,
      snapshotType,
      snapshotAt,
      metrics
    );
    if (out.error) return { error: out.error };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  return {};
}

/**
 * Record snapshots from explicit payload (same effect as recordSnapshotAction form).
 * For worker/cron or bulk entry: pass campaignId, snapshotType, snapshotAt (ISO), and metrics.
 * Records one row per promoted_social_handles with the same metrics. RLS: caller must be workspace member.
 */
export async function recordSnapshotFromPayloadAction(
  campaignId: string,
  snapshotType: SnapshotType,
  snapshotAt: string,
  metrics: SnapshotMetrics
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const handles = campaign.promoted_social_handles ?? [];
  if (handles.length === 0) return { error: "No promoted social handles; add them in campaign definition" };

  if (!["baseline", "daily", "end"].includes(snapshotType)) {
    return { error: "Invalid snapshot_type" };
  }

  const at = snapshotAt ? new Date(snapshotAt).toISOString() : new Date().toISOString();

  for (const { platform, handle } of handles) {
    const out = await upsertAccountSnapshot(
      supabase,
      campaignId,
      platform,
      handle,
      snapshotType,
      at,
      metrics ?? {}
    );
    if (out.error) return { error: out.error };
  }

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  return {};
}

/**
 * Operator repair: for tasks with approved proof rows, set task to approved if still not approved/done,
 * then refresh crm_task_bundles / crm_campaign_participants contribution % (approved-only if finalized).
 */
export async function recomputeCampaignContributionAction(
  campaignId: string
): Promise<{ error?: string; tasksSynced?: number }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  const out = await reconcileCampaignContributionFromSubmissions(supabase, campaignId);
  if (out.error) return { error: out.error };

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath("/campaigns");
  return { tasksSynced: out.tasks_synced_to_approved };
}

/**
 * Finalize campaign: set finalized_at, write contribution in approved-only mode (final share).
 * Does not overwrite contribution after this unless explicitly re-finalized. RLS: caller must be workspace member.
 */
export async function finalizeCampaignAction(campaignId: string): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  if (campaign.finalized_at) return { error: "Campaign already finalized" };

  const err = await setCampaignFinalized(supabase, campaignId);
  if (err.error) return err;

  // Finalization implies lifecycle completion for operators.
  await setCampaignStatus(supabase, campaignId, "completed");

  await writeContribution(supabase, campaignId, {
    weighted: true,
    statuses: ["approved"],
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath("/campaigns");
  return {};
}

const CAMPAIGN_STATUSES = ["draft", "active", "paused", "completed", "cancelled"] as const;

export async function updateCampaignStatusAction(
  campaignId: string,
  nextStatus: (typeof CAMPAIGN_STATUSES)[number]
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  if (!CAMPAIGN_STATUSES.includes(nextStatus)) return { error: "Invalid status" };

  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { error: "Campaign not found or access denied" };

  // Guardrails: do not allow moving out of completed once finalized; use cancel/pause only pre-finalize.
  if (campaign.finalized_at && campaign.status === "completed" && nextStatus !== "completed") {
    return { error: "Finalized campaigns cannot change status" };
  }

  const out = await setCampaignStatus(supabase, campaignId, nextStatus);
  if (out.error) return out;
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return {};
}
