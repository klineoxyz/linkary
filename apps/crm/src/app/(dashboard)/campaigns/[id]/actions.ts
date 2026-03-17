"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getCampaign, updateCampaignDefinition } from "@/lib/campaigns";
import type { PromotedSocialHandle } from "@/lib/campaigns";
import {
  getSubmissionWithCampaignWorkspace,
  updateSubmissionStatus,
} from "@/lib/submissions";
import { generateRecurringTasksForCampaignWeek } from "@/lib/recurring";
import { revalidatePath } from "next/cache";

const REVIEW_STATUSES = ["approved", "rejected", "needs_revision"] as const;

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
  const promoted_org_id = (formData.get("promoted_org_id") as string | null)?.trim() || null;
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
