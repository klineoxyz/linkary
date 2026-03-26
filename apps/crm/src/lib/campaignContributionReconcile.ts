/**
 * Operator-safe backfill: align crm_tasks with approved crm_submissions, then refresh stored contribution %.
 * Idempotent. Use server session with workspace access (same as writeContribution).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCampaign } from "@/lib/campaigns";
import { writeContribution } from "@/lib/contribution";
import { getWeekRangeUtc } from "@/lib/recurring";

export type ReconcileCampaignContributionResult = {
  tasks_synced_to_approved: number;
  error?: string;
};

/**
 * Align linked task with an approved proof: status, campaign_id, weekly_post metadata (when campaign requires weekly posts).
 * Fixes live rows where submission.campaign_id is set but task.campaign_id is null, or due_at/deliverable_type were never set.
 */
export async function alignTaskFromApprovedProof(
  supabase: SupabaseClient,
  args: {
    taskId: string;
    campaignId: string;
    reviewedAt: string | null;
    weeklyRequiredPosts: number;
    participantProfileId?: string | null;
  }
): Promise<{ error?: string; statusChanged: boolean }> {
  const { weekEnd } = getWeekRangeUtc(args.reviewedAt ? new Date(args.reviewedAt) : new Date());
  const now = new Date().toISOString();

  const { data: task, error: tErr } = await supabase
    .from("crm_tasks")
    .select("id, status, campaign_id, task_bundle_id, deliverable_type, due_at")
    .eq("id", args.taskId)
    .maybeSingle();

  if (tErr || !task) return { error: "Linked task not found", statusChanged: false };

  const row = task as {
    id: string;
    status: string;
    campaign_id: string | null;
    task_bundle_id: string | null;
    deliverable_type: string | null;
    due_at: string | null;
  };

  let belongs = row.campaign_id === args.campaignId;
  if (!belongs) {
    if (row.campaign_id != null) {
      return { error: "Task is attached to a different campaign", statusChanged: false };
    }
    if (!row.task_bundle_id) {
      return { error: "Task has no campaign_id and no bundle", statusChanged: false };
    }
    const { data: b } = await supabase
      .from("crm_task_bundles")
      .select("campaign_id")
      .eq("id", row.task_bundle_id)
      .maybeSingle();
    const bc = (b as { campaign_id?: string } | null)?.campaign_id;
    if (bc !== args.campaignId) {
      return { error: "Task bundle is not for this campaign", statusChanged: false };
    }
    belongs = true;
  }

  if (!belongs) return { error: "Task does not belong to this campaign", statusChanged: false };

  const st = (row.status ?? "").toLowerCase();
  const statusChanged = st !== "approved" && st !== "done";

  const patch: Record<string, unknown> = { updated_at: now };
  if (statusChanged) patch.status = "approved";
  if (row.campaign_id == null) patch.campaign_id = args.campaignId;
  if (!row.task_bundle_id && args.participantProfileId) {
    const { data: bundle } = await supabase
      .from("crm_task_bundles")
      .select("id")
      .eq("campaign_id", args.campaignId)
      .eq("participant_profile_id", args.participantProfileId)
      .limit(1)
      .maybeSingle();
    const bundleId = (bundle as { id?: string } | null)?.id ?? null;
    if (bundleId) patch.task_bundle_id = bundleId;
  }
  if ((args.weeklyRequiredPosts ?? 0) > 0) {
    if (!row.deliverable_type) patch.deliverable_type = "weekly_post";
    if (!row.due_at) patch.due_at = weekEnd;
  }

  const needsWrite =
    statusChanged ||
    row.campaign_id == null ||
    (!row.task_bundle_id && !!(patch.task_bundle_id as string | undefined)) ||
    ((args.weeklyRequiredPosts ?? 0) > 0 && (!row.deliverable_type || !row.due_at));

  if (!needsWrite) return { error: undefined, statusChanged: false };

  const { error: upErr } = await supabase.from("crm_tasks").update(patch).eq("id", args.taskId);
  if (upErr) return { error: upErr.message, statusChanged: false };
  return { error: undefined, statusChanged };
}

/**
 * For each task that has at least one approved proof row for this campaign, ensure task status
 * is approved or done so task contribution math matches proof truth. Then run writeContribution
 * (approved+done normally; approved-only when campaign is finalized).
 */
export async function reconcileCampaignContributionFromSubmissions(
  supabase: SupabaseClient,
  campaignId: string
): Promise<ReconcileCampaignContributionResult> {
  const campaign = await getCampaign(supabase, campaignId);
  if (!campaign) return { tasks_synced_to_approved: 0, error: "Campaign not found" };

  const weeklyReq = campaign.weekly_required_posts ?? 0;

  const { data: approvedRows, error: subErr } = await supabase
    .from("crm_submissions")
    .select("task_id, reviewed_at, participant_profile_id")
    .eq("campaign_id", campaignId)
    .eq("status", "approved");

  if (subErr) {
    return { tasks_synced_to_approved: 0, error: subErr.message };
  }

  const approvedMetaByTask = new Map<string, { reviewedAt: string | null; participantProfileId: string | null }>();
  for (const r of approvedRows ?? []) {
    const tid = (r as { task_id: string }).task_id;
    if (!tid) continue;
    const rv = (r as { reviewed_at: string | null }).reviewed_at;
    const participantProfileId = (r as { participant_profile_id?: string | null }).participant_profile_id ?? null;
    const prev = approvedMetaByTask.get(tid);
    if (!prev || (rv && (!prev.reviewedAt || rv > prev.reviewedAt))) {
      approvedMetaByTask.set(tid, { reviewedAt: rv ?? null, participantProfileId });
    }
  }

  const taskIds = [...approvedMetaByTask.keys()];
  let tasks_synced_to_approved = 0;

  for (const taskId of taskIds) {
    const meta = approvedMetaByTask.get(taskId) ?? { reviewedAt: null, participantProfileId: null };
    const out = await alignTaskFromApprovedProof(supabase, {
      taskId,
      campaignId,
      reviewedAt: meta.reviewedAt,
      weeklyRequiredPosts: weeklyReq,
      participantProfileId: meta.participantProfileId,
    });
    if (out.error) continue;
    if (out.statusChanged) tasks_synced_to_approved += 1;
  }

  const finalized = !!campaign.finalized_at;
  if (finalized) {
    await writeContribution(supabase, campaignId, { weighted: true, statuses: ["approved"] });
  } else {
    await writeContribution(supabase, campaignId, { weighted: true });
  }

  return { tasks_synced_to_approved };
}
