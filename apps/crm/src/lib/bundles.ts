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
  /** From campaign definition: required weekly posts per creator. */
  requiredWeeklyPosts: number | null;
  /** From campaign definition: daily engagement description. */
  dailyEngagementRequired: string | null;
  /** Progress for this week: weekly_post tasks only. */
  progressThisWeekWeekly: TaskBundleProgress | null;
  /** Progress for this week: daily_engagement tasks only. */
  progressThisWeekDaily: TaskBundleProgress | null;
};

export type TaskBundleProgressFilter = {
  deliverableType?: string | null;
  weekStart?: string;
  weekEnd?: string;
};

/**
 * Compute progress for a task bundle from crm_tasks (no schema change).
 * Overdue = due_at < today and status not in (done, approved, rejected).
 */
export async function getTaskBundleProgress(
  supabase: SupabaseClient,
  bundleId: string
): Promise<TaskBundleProgress> {
  return getTaskBundleProgressFiltered(supabase, bundleId, {});
}

function progressFromTasks(
  tasks: { id: string; status: string; due_at: string | null; deliverable_type?: string | null }[],
  filter?: TaskBundleProgressFilter
): TaskBundleProgress {
  let filtered = tasks;
  if (filter?.deliverableType != null) {
    filtered = filtered.filter((t) => (t.deliverable_type ?? null) === filter.deliverableType);
  }
  if (filter?.weekStart != null && filter?.weekEnd != null) {
    filtered = filtered.filter(
      (t) => t.due_at && t.due_at >= filter.weekStart! && t.due_at <= filter.weekEnd!
    );
  }

  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const todayIso = todayStart.toISOString();
  const counts = {
    total: filtered.length,
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
  for (const t of filtered) {
    const status = t.status ?? "backlog";
    if (status === "approved") counts.approved++;
    else if (status === "rejected") counts.rejected++;
    else if (status === "submitted") counts.pending++;
    else if (status === "done") counts.done++;
    else if (status === "to_do") counts.to_do++;
    else if (status === "in_progress") counts.in_progress++;
    else counts.backlog++;
    if (t.due_at && t.due_at < todayIso && !completedStatuses.has(status)) counts.overdue++;
  }
  return counts;
}

/**
 * Progress for a bundle with optional filter by deliverable_type and/or week.
 */
export async function getTaskBundleProgressFiltered(
  supabase: SupabaseClient,
  bundleId: string,
  filter: TaskBundleProgressFilter
): Promise<TaskBundleProgress> {
  const { data: tasks, error } = await supabase
    .from("crm_tasks")
    .select("id, status, due_at, deliverable_type")
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

  return progressFromTasks(
    tasks as { id: string; status: string; due_at: string | null; deliverable_type?: string | null }[],
    Object.keys(filter).length ? filter : undefined
  );
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
    .select("id, title, description, starts_at, ends_at, status, weekly_required_posts, daily_engagement_required")
    .in("id", campaignIds);

  type CampaignRow = {
    id: string;
    title: string;
    description: string | null;
    starts_at: string | null;
    ends_at: string | null;
    status: string;
    weekly_required_posts?: number | null;
    daily_engagement_required?: string | null;
  };
  const campaignById = new Map(
    (campaigns ?? []).map((c) => [(c as { id: string }).id, c as CampaignRow])
  );

  const { weekStart, weekEnd } = getWeekRangeUtcForBundle();
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
    const [progress, progressThisWeekWeekly, progressThisWeekDaily] = await Promise.all([
      getTaskBundleProgress(supabase, b.id),
      getTaskBundleProgressFiltered(supabase, b.id, {
        deliverableType: "weekly_post",
        weekStart,
        weekEnd,
      }),
      getTaskBundleProgressFiltered(supabase, b.id, {
        deliverableType: "daily_engagement",
        weekStart,
        weekEnd,
      }),
    ]);
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
      requiredWeeklyPosts: campaign.weekly_required_posts ?? null,
      dailyEngagementRequired: campaign.daily_engagement_required ?? null,
      progressThisWeekWeekly,
      progressThisWeekDaily,
    });
  }
  return result;
}

function getWeekRangeUtcForBundle(): { weekStart: string; weekEnd: string } {
  const d = new Date();
  const day = d.getUTCDay();
  const toMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + toMonday);
  const weekStart = new Date(d);
  weekStart.setUTCHours(0, 0, 0, 0);
  const weekEnd = new Date(d);
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 6);
  weekEnd.setUTCHours(23, 59, 59, 999);
  return { weekStart: weekStart.toISOString(), weekEnd: weekEnd.toISOString() };
}
