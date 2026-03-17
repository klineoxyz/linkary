"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { finalizeCampaignAction } from "./actions";
import type { EndSnapshotStatus } from "@/lib/snapshots";

export function FinalizeCampaignButton({
  campaignId,
  endSnapshotStatus,
}: {
  campaignId: string;
  endSnapshotStatus: EndSnapshotStatus;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const { promotedCount, endSnapshotCount, hasAllEndSnapshots } = endSnapshotStatus;
  const missingEndSnapshots = promotedCount > 0 && !hasAllEndSnapshots;

  async function handleClick() {
    if (busy) return;
    if (missingEndSnapshots) {
      const proceed = confirm(
        `${endSnapshotCount}/${promotedCount} promoted accounts have end snapshots. ` +
          `Growth data will be incomplete for the rest. Record end snapshots on the report page first, or finalize anyway?`
      );
      if (!proceed) return;
    }
    if (
      !confirm(
        "Finalize this campaign? Contribution will be set to approved-only and won't be overwritten by progress recalc."
      )
    )
      return;
    setBusy(true);
    setError(null);
    const result = await finalizeCampaignAction(campaignId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Finalizing…" : "Finalize campaign"}
      </button>
      {promotedCount > 0 && (
        <Link
          href={`/campaigns/${campaignId}/report`}
          className="text-sm text-[var(--crm-muted)] hover:text-[var(--crm-primary)] underline"
        >
          Record end snapshots
        </Link>
      )}
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
