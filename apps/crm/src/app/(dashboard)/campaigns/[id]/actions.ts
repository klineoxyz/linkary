"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import {
  getCampaign,
  setCampaignFinalized,
  updateCampaignDefinition,
} from "@/lib/campaigns";
import type { PromotedSocialHandle } from "@/lib/campaigns";
import {
  getSubmissionWithCampaignWorkspace,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { generateRecurringTasksForCampaignWeek } from "@/lib/recurring";
import { writeContribution } from "@/lib/contribution";
import { upsertAccountSnapshot } from "@/lib/snapshots";
import type { SnapshotMetrics, SnapshotType } from "@/lib/snapshots";
import { revalidatePath } from "next/cache";

const REVIEW_STATUSES = ["approved", "rejected", "needs_revision"] as const;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function parseXHandleInput(input: string): string {
  const raw = input.trim();
  if (!raw) return "";
  const noProto = raw.replace(/^https?:\/\//i, "");
  const noDomain = noProto
    .replace(/^www\./i, "")
    .replace(/^x\.com\//i, "")
    .replace(/^twitter\.com\//i, "");
  const firstSegment = noDomain.split(/[/?#]/)[0] ?? "";
  const handle = firstSegment.replace(/^@/, "").trim().toLowerCase();
  return handle;
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
  revalidatePath(`/campaigns/${submission.campaign_id}`);
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
): Promise<{ error?: string }> {
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

  const result = await updateCampaignDefinition(supabase, campaignId, {
    reward_date,
    campaign_value_usd: Number.isNaN(campaign_value_usd) ? null : campaign_value_usd,
    token_or_usdt,
    required_platforms: required_platforms.length ? required_platforms : [],
    weekly_required_posts: Number.isNaN(weekly_required_posts) ? null : weekly_required_posts,
    daily_engagement_required,
    promoted_org_id: promoted_org_id || null,
    promoted_social_handles,
  });

  if (result.error) return result;
  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath("/campaigns");
  return {};
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

  await writeContribution(supabase, campaignId, {
    weighted: true,
    statuses: ["approved"],
  });

  revalidatePath(`/campaigns/${campaignId}`);
  revalidatePath(`/campaigns/${campaignId}/report`);
  revalidatePath("/campaigns");
  return {};
}
