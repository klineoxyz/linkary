"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recomputeCampaignContributionAction } from "./actions";

/** Operator-only: backfill task status from approved proofs + refresh stored contribution %. */
export function RecomputeContributionButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneMsg, setDoneMsg] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (busy) return;
    if (
      !confirm(
        "Recompute contribution from proofs? This sets linked tasks to approved when a proof is approved (if not already approved/done), then refreshes bundle and participant contribution % for this campaign. Safe to repeat."
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
    setDoneMsg(
      result.tasksSynced != null && result.tasksSynced > 0
        ? `Synced ${result.tasksSynced} task(s); contribution refreshed.`
        : "Contribution refreshed (no task status changes needed)."
    );
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
        {busy ? "Recomputing…" : "Recompute from proofs"}
      </button>
      {doneMsg && <span className="text-xs text-[var(--crm-muted)]">{doneMsg}</span>}
      {error && <span className="text-sm text-red-600 dark:text-red-400">{error}</span>}
    </div>
  );
}
