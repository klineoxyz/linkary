/**
 * CRM: Task bundle progress and creator campaign bundles. Uses stored data only; RLS-safe.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskBundleProgress = {
  total: number;
  approved: number;
  rejected: number;
  pending: number; // submitted, awaiting review
  done: number;
  to_do: number;
  in_progress: number;
  backlog: number;
  overdue: number;
};

export type MyCampaignBundleItem = {
  bundleId: string;
  campaignId: string;
  campaignTitle: string;
  campaignDescription: string | null;
  campaignStartsAt: string | null;
  campaignEndsAt: string | null;
  campaignStatus: string;
  bundleTitle: string;
  expectedTaskCount: number;
  progress: TaskBundleProgress;
  contributionPercent: number | null;
};

/**
 * Compute progress for a task bundle from crm_tasks (no schema change).
 * Overdue = due_at < today and status not in (done, approved, rejected).
 */
export async function getTaskBundleProgress(
  supabase: SupabaseClient,
  bundleId: string
): Promise<TaskBundleProgress> {
  const { data: tasks, error } = await supabase
    .from("crm_tasks")
    .select("id, status, due_at")
    .eq("task_bundle_id", bundleId);

  if (error || !tasks?.length) {
    return {
      total: 0,
      approved: 0,
      rejected: 0,
      pending: 0,
      done: 0,
      to_do: 0,
      in_progress: 0,
      backlog: 0,
      overdue: 0,
    };
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();

  const counts = {
    total: tasks.length,
    approved: 0,
    rejected: 0,
    pending: 0,
    done: 0,
    to_do: 0,
    in_progress: 0,
    backlog: 0,
    overdue: 0,
  };

  const completedStatuses = new Set(["done", "approved", "rejected"]);

  for (const t of tasks as { id: string; status: string; due_at: string | null }[]) {
    const status = t.status ?? "backlog";
    if (status === "approved") counts.approved++;
    else if (status === "rejected") counts.rejected++;
    else if (status === "submitted") counts.pending++;
    else if (status === "done") counts.done++;
    else if (status === "to_do") counts.to_do++;
    else if (status === "in_progress") counts.in_progress++;
    else counts.backlog++;

    if (t.due_at && t.due_at < todayIso && !completedStatuses.has(status)) {
      counts.overdue++;
    }
  }

  return counts;
}

/**
 * Fetch all campaign bundles for a profile (creator view): bundles where
 * participant_profile_id = profileId, with campaign info and computed progress.
 */
export async function fetchMyCampaignBundles(
  supabase: SupabaseClient,
  profileId: string
): Promise<MyCampaignBundleItem[]> {
  const { data: bundles, error: bundleErr } = await supabase
    .from("crm_task_bundles")
    .select("id, campaign_id, title, expected_task_count, contribution_percent")
    .eq("participant_profile_id", profileId)
    .order("id", { ascending: false });

  if (bundleErr || !bundles?.length) return [];

  const campaignIds = [...new Set((bundles as { campaign_id: string }[]).map((b) => b.campaign_id))];
  const { data: campaigns } = await supabase
    .from("crm_campaigns")
    .select("id, title, description, starts_at, ends_at, status")
    .in("id", campaignIds);

  const campaignById = new Map(
    (campaigns ?? []).map((c) => [
      (c as { id: string }).id,
      c as { id: string; title: string; description: string | null; starts_at: string | null; ends_at: string | null; status: string },
    ])
  );

  const result: MyCampaignBundleItem[] = [];
  for (const b of bundles as {
    id: string;
    campaign_id: string;
    title: string;
    expected_task_count: number;
    contribution_percent: number | null;
  }[]) {
    const campaign = campaignById.get(b.campaign_id);
    if (!campaign) continue;
    const progress = await getTaskBundleProgress(supabase, b.id);
    result.push({
      bundleId: b.id,
      campaignId: b.campaign_id,
      campaignTitle: campaign.title,
      campaignDescription: campaign.description,
      campaignStartsAt: campaign.starts_at,
      campaignEndsAt: campaign.ends_at,
      campaignStatus: campaign.status,
      bundleTitle: b.title,
      expectedTaskCount: b.expected_task_count,
      progress,
      contributionPercent: b.contribution_percent != null ? Number(b.contribution_percent) : null,
    });
  }
  return result;
}
