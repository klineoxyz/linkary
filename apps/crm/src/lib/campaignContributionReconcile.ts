/**
 * Operator-safe backfill: align crm_tasks with approved crm_submissions, then refresh stored contribution %.
 * Idempotent. Use server session with workspace access (same as writeContribution).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getCampaign } from "@/lib/campaigns";
import { writeContribution } from "@/lib/contribution";

export type ReconcileCampaignContributionResult = {
  tasks_synced_to_approved: number;
  error?: string;
};

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

  const { data: approvedRows, error: subErr } = await supabase
    .from("crm_submissions")
    .select("task_id")
    .eq("campaign_id", campaignId)
    .eq("status", "approved");

  if (subErr) {
    return { tasks_synced_to_approved: 0, error: subErr.message };
  }

  const taskIds = [...new Set((approvedRows ?? []).map((r) => (r as { task_id: string }).task_id).filter(Boolean))];
  let tasks_synced_to_approved = 0;
  const now = new Date().toISOString();

  for (const taskId of taskIds) {
    const { data: task, error: tErr } = await supabase
      .from("crm_tasks")
      .select("id, status, campaign_id")
      .eq("id", taskId)
      .maybeSingle();

    if (tErr || !task) continue;
    const row = task as { id: string; status: string; campaign_id: string | null };
    if (row.campaign_id !== campaignId) continue;

    const st = (row.status ?? "").toLowerCase();
    if (st === "approved" || st === "done") continue;

    const { error: upErr } = await supabase
      .from("crm_tasks")
      .update({ status: "approved", updated_at: now })
      .eq("id", taskId)
      .eq("campaign_id", campaignId);

    if (!upErr) tasks_synced_to_approved += 1;
  }

  const finalized = !!campaign.finalized_at;
  if (finalized) {
    await writeContribution(supabase, campaignId, { weighted: true, statuses: ["approved"] });
  } else {
    await writeContribution(supabase, campaignId, { weighted: true });
  }

  return { tasks_synced_to_approved };
}
