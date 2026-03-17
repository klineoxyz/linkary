/**
 * CRM: Contribution scoring per creator per campaign.
 * Uses stored data only: approved/done tasks, deliverable_type, bundle membership.
 * Writes to crm_task_bundles.contribution_percent and crm_campaign_participants.contribution_percent.
 *
 * IMPORTANT: writeContribution must only be called with a client that has full campaign
 * visibility (all bundles and all tasks for that campaign). Use from operator context only
 * (e.g. campaign detail page). Do not call from creator /tasks path — RLS would expose
 * only one bundle and produce incorrect campaign-wide percentages.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Weights by deliverable_type for weighted contribution. Completion-based = all 1. */
export const DELIVERABLE_WEIGHTS: Record<string, number> = {
  weekly_post: 1,
  daily_engagement: 0.25,
  one_off: 1,
  custom: 0.5,
};
const DEFAULT_WEIGHT = 0.5;

export type ContributionRow = {
  bundleId: string;
  participant_profile_id: string;
  contributionPercent: number;
};

export type ComputeContributionOptions = {
  /** If true, weight by deliverable_type; else completion-based (count only). */
  weighted?: boolean;
  /** Task statuses that count. Default approved+done (progress). Use ['approved'] for final/reward share. */
  statuses?: ("approved" | "done")[];
};

/**
 * Compute contribution % per bundle for a campaign.
 * Only approved and done tasks count (progress contribution). Rejected, submitted, to_do, etc. do not count.
 * For final/reward reporting, prefer approved-only (future option).
 */
const DEFAULT_CONTRIBUTION_STATUSES = ["approved", "done"] as const;

export async function computeContribution(
  supabase: SupabaseClient,
  campaignId: string,
  options?: ComputeContributionOptions
): Promise<ContributionRow[]> {
  const weighted = options?.weighted ?? false;
  const statuses = options?.statuses ?? [...DEFAULT_CONTRIBUTION_STATUSES];

  const { data: bundles, error: bundleErr } = await supabase
    .from("crm_task_bundles")
    .select("id, participant_profile_id")
    .eq("campaign_id", campaignId);

  if (bundleErr || !bundles?.length) return [];

  const bundleIds = (bundles as { id: string }[]).map((b) => b.id);
  const { data: tasks, error: taskErr } = await supabase
    .from("crm_tasks")
    .select("id, task_bundle_id, status, deliverable_type")
    .in("task_bundle_id", bundleIds)
    .in("status", statuses);

  if (taskErr) return [];

  const completed = (tasks ?? []) as {
    id: string;
    task_bundle_id: string;
    status: string;
    deliverable_type?: string | null;
  }[];

  const bundleScores = new Map<string, number>();
  for (const b of bundles as { id: string; participant_profile_id: string }[]) {
    bundleScores.set(b.id, 0);
  }

  for (const t of completed) {
    const bid = t.task_bundle_id;
    const current = bundleScores.get(bid) ?? 0;
    const add = weighted
      ? DELIVERABLE_WEIGHTS[t.deliverable_type ?? ""] ?? DEFAULT_WEIGHT
      : 1;
    bundleScores.set(bid, current + add);
  }

  const total = Array.from(bundleScores.values()).reduce((a, b) => a + b, 0);

  const result: ContributionRow[] = [];
  for (const b of bundles as { id: string; participant_profile_id: string }[]) {
    const score = bundleScores.get(b.id) ?? 0;
    const contributionPercent =
      total > 0 ? Math.round((100 * score) / total * 10) / 10 : 0;
    result.push({
      bundleId: b.id,
      participant_profile_id: b.participant_profile_id,
      contributionPercent,
    });
  }
  return result;
}

/**
 * Compute contribution for a campaign and write to crm_task_bundles and crm_campaign_participants.
 * Safe and idempotent. Returns the computed rows (e.g. for display).
 * When campaign is finalized: skips DB updates for progress (approved+done); only writes when
 * options.statuses is ['approved'] (finalize run), so final share is not overwritten by later progress.
 */
export async function writeContribution(
  supabase: SupabaseClient,
  campaignId: string,
  options?: ComputeContributionOptions
): Promise<ContributionRow[]> {
  const { getCampaign } = await import("@/lib/campaigns");
  const campaign = await getCampaign(supabase, campaignId);
  const statuses = options?.statuses ?? [...DEFAULT_CONTRIBUTION_STATUSES];
  const isFinalizeRun = statuses.length === 1 && statuses[0] === "approved";

  const rows = await computeContribution(supabase, campaignId, options);
  if (rows.length === 0) return [];

  if (campaign?.finalized_at && !isFinalizeRun) {
    return rows;
  }

  for (const row of rows) {
    await supabase
      .from("crm_task_bundles")
      .update({ contribution_percent: row.contributionPercent })
      .eq("id", row.bundleId);
    await supabase
      .from("crm_campaign_participants")
      .update({ contribution_percent: row.contributionPercent })
      .eq("campaign_id", campaignId)
      .eq("participant_profile_id", row.participant_profile_id);
  }
  return rows;
}
