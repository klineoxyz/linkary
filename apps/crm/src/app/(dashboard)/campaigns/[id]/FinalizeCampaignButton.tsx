"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { finalizeCampaignAction } from "./actions";

export function FinalizeCampaignButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleClick() {
    if (busy) return;
    if (!confirm("Finalize this campaign? Contribution will be set to approved-only and won’t be overwritten by progress recalc.")) return;
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
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="rounded-lg border border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-400 px-3 py-1.5 text-sm font-medium disabled:opacity-50"
      >
        {busy ? "Finalizing…" : "Finalize campaign"}
      </button>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
