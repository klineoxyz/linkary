/**
 * CRM: Campaign compliance tracking from campaign definition + tasks.
 * workspace_id = operator; compliance is per participant/bundle, computed from crm_tasks.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTaskBundleProgressFiltered } from "@/lib/bundles";
import { getWeekRangeUtc } from "@/lib/recurring";

export type ParticipantComplianceRow = {
  participant_profile_id: string;
  bundleId: string;
  requiredWeeklyPosts: number;
  approvedWeeklyThisWeek: number;
  dailyRequired: boolean;
  dailyCompletedThisWeek: number;
  dailyTotalThisWeek: number;
  overdueCount: number;
  status: "compliant" | "behind" | "overperforming";
};

/**
 * Compute compliance for all participants in a campaign for the current week.
 * Uses campaign definition (weekly_required_posts, daily_engagement_required) and task counts.
 */
export async function getCampaignCompliance(
  supabase: SupabaseClient,
  campaignId: string
): Promise<{
  compliance: ParticipantComplianceRow[];
  weekStart: string;
  weekEnd: string;
} | null> {
  const { data: campaign, error: campErr } = await supabase
    .from("crm_campaigns")
    .select("id, weekly_required_posts, daily_engagement_required")
    .eq("id", campaignId)
    .single();

  if (campErr || !campaign?.id) return null;

  const weeklyRequired =
    (campaign as { weekly_required_posts?: number | null }).weekly_required_posts ?? 0;
  const dailyRequired = !!(campaign as { daily_engagement_required?: string | null })
    .daily_engagement_required;

  const { data: bundles, error: bundleErr } = await supabase
    .from("crm_task_bundles")
    .select("id, participant_profile_id")
    .eq("campaign_id", campaignId);

  if (bundleErr || !bundles?.length) {
    return { compliance: [], ...getWeekRangeUtc(new Date()) };
  }

  const { weekStart, weekEnd } = getWeekRangeUtc(new Date());
  const compliance: ParticipantComplianceRow[] = [];

  for (const bundle of bundles as { id: string; participant_profile_id: string }[]) {
    const [progressAll, progressWeekly, progressDaily] = await Promise.all([
      getTaskBundleProgressFiltered(supabase, bundle.id, {}),
      getTaskBundleProgressFiltered(supabase, bundle.id, {
        deliverableType: "weekly_post",
        weekStart,
        weekEnd,
      }),
      getTaskBundleProgressFiltered(supabase, bundle.id, {
        deliverableType: "daily_engagement",
        weekStart,
        weekEnd,
      }),
    ]);

    const approvedWeekly =
      (progressWeekly.approved ?? 0) + (progressWeekly.done ?? 0);
    const dailyDone = (progressDaily.approved ?? 0) + (progressDaily.done ?? 0);
    const dailyTotal = progressDaily.total ?? 0;
    const overdueCount = progressAll.overdue ?? 0;

    let status: ParticipantComplianceRow["status"] = "compliant";
    if (overdueCount > 0 || approvedWeekly < weeklyRequired) {
      status = "behind";
    } else if (weeklyRequired > 0 && approvedWeekly > weeklyRequired) {
      status = "overperforming";
    }
    if (dailyRequired && dailyDone < dailyTotal && dailyTotal > 0) {
      status = "behind";
    }

    compliance.push({
      participant_profile_id: bundle.participant_profile_id,
      bundleId: bundle.id,
      requiredWeeklyPosts: weeklyRequired,
      approvedWeeklyThisWeek: approvedWeekly,
      dailyRequired,
      dailyCompletedThisWeek: dailyDone,
      dailyTotalThisWeek: dailyTotal,
      overdueCount,
      status,
    });
  }

  return { compliance, weekStart, weekEnd };
}
