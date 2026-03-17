"use client";

import { useState } from "react";
import { getReportCsvAction } from "./actions";
import { Download } from "lucide-react";

export function DownloadReportCsvButton({ campaignId }: { campaignId: string }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await getReportCsvAction(campaignId);
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    if (!result.csv) return;
    const blob = new Blob([result.csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `campaign-report-${campaignId.slice(0, 8)}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy}
        className="inline-flex items-center gap-2 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)] disabled:opacity-50"
      >
        <Download className="h-4 w-4" />
        {busy ? "Preparing…" : "Download CSV"}
      </button>
      {error && (
        <span className="text-sm text-red-600 dark:text-red-400">{error}</span>
      )}
    </div>
  );
}
