"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recomputeCampaignContributionAction } from "./actions";

/** Operator-only: backfill proof->task truth + contribution + X proof metrics snapshots. */
export function RecomputeContributionButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (busy) return;
    if (
      !confirm(
        "Recompute from proofs + refresh X metrics? This aligns linked tasks with approved proofs (including campaign_id / weekly_post metadata when needed), refreshes contribution %, and backfills metrics_snapshot for X proof URLs via twitterapi.io (requires API key in env). Safe to repeat."
      )
    ) {
      return;
    }
    setBusy(true);
    setError(null);
    setDoneMsg(null);
    const result = await recomputeCampaignContributionAction(campaignId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const parts: string[] = [];
    if (result.tasksSynced != null && result.tasksSynced > 0) {
      parts.push(`Synced ${result.tasksSynced} task(s)`);
    } else {
      parts.push("Tasks aligned (no status-only changes needed)");
    }
    parts.push("contribution refreshed");
    if (result.metricsEnriched != null && result.metricsEnriched > 0) {
      parts.push(`X metrics on ${result.metricsEnriched} proof row(s)`);
    }
    if (result.metricsFailed != null && result.metricsFailed > 0) {
      parts.push(`${result.metricsFailed} proof row(s) could not fetch metrics`);
    }
    if (result.metricsHint) {
      parts.push(`Note: ${result.metricsHint}`);
    }
    setDoneMsg(parts.join(" · "));
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-1.5 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)] disabled:opacity-50"
      >
        {busy ? "Recomputing…" : "Recompute proofs + X metrics"}
      </button>
      {doneMsg && <span className="text-xs text-[var(--crm-muted)]">{doneMsg}</span>}
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
