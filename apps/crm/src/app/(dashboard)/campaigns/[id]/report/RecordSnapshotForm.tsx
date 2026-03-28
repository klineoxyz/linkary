"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { recordSnapshotAction } from "../actions";
import type { LatestSnapshotPrefill } from "@/lib/snapshots";

const SNAPSHOT_TYPES = [
  { value: "baseline", label: "Baseline" },
  { value: "daily", label: "Daily" },
  { value: "end", label: "End" },
] as const;

function numOrEmpty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "";
  return String(Math.trunc(n));
}

export function RecordSnapshotForm({
  campaignId,
  hasHandles,
  latestSnapshot,
}: {
  campaignId: string;
  hasHandles: boolean;
  /** Prefill from most recent row in crm_campaign_account_snapshots (any type). */
  latestSnapshot?: LatestSnapshotPrefill | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!hasHandles) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await recordSnapshotAction(campaignId, formData);
    setBusy(false);
    if (result.error) setMessage({ ok: false, text: result.error });
    else {
      setMessage({ ok: true, text: "Snapshot recorded for all promoted accounts." });
      router.refresh();
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const snapDate =
    latestSnapshot?.snapshot_at != null
      ? new Date(latestSnapshot.snapshot_at).toISOString().slice(0, 10)
      : today;

  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-4 mb-4">
      <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">
        Record promoted-account snapshot (all handles)
      </h3>
      <p className="text-xs text-[var(--crm-muted)] mb-3 space-y-1">
        <span className="block">
          <strong className="text-[var(--crm-foreground)]">Baseline</strong> — once at (or before) campaign start, for growth math.{" "}
          <strong className="text-[var(--crm-foreground)]">Daily</strong> — optional manual checkpoints.{" "}
          <strong className="text-[var(--crm-foreground)]">End</strong> — at wrap-up; the growth table compares baseline → end.
        </span>
        <span className="block">
          One submit stores the same numbers for every entry in <code className="text-[10px] bg-[var(--crm-bg)] px-1 rounded">promoted_social_handles</code>. Leave fields blank if unknown.
        </span>
        {latestSnapshot ? (
          <span className="block mt-2 rounded-md border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-[11px]">
            <strong className="text-[var(--crm-foreground)]">Latest stored snapshot</strong> ({latestSnapshot.snapshot_type ?? "—"} @{" "}
            {latestSnapshot.snapshot_at
              ? new Date(latestSnapshot.snapshot_at).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })
              : "—"}
            ) — fields below prefill from that row so you can edit and record the next checkpoint.
          </span>
        ) : (
          <span className="block mt-2 text-[11px] text-[var(--crm-muted)]">No prior snapshot rows — enter fresh numbers.</span>
        )}
      </p>
      <form action={submit} className="space-y-3">
        <div className="flex flex-wrap gap-4 items-end">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--crm-muted)]">Type</span>
            <select
              name="snapshot_type"
              required
              className="rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-sm text-[var(--crm-foreground)]"
            >
              {SNAPSHOT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-xs text-[var(--crm-muted)]">Date (optional)</span>
            <input
              type="date"
              name="snapshot_at"
              defaultValue={snapDate}
              className="rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-sm text-[var(--crm-foreground)]"
            />
          </label>
          {(
            [
              ["followers", latestSnapshot?.followers],
              ["views", latestSnapshot?.views],
              ["likes", latestSnapshot?.likes],
              ["replies", latestSnapshot?.replies],
              ["quotes", latestSnapshot?.quotes],
              ["reposts", latestSnapshot?.reposts],
              ["engagement_total", latestSnapshot?.engagement_total],
            ] as const
          ).map(([field, def]) => (
            <label key={field} className="flex flex-col gap-1">
              <span className="text-xs text-[var(--crm-muted)]">{field}</span>
              <input
                type="number"
                name={field}
                min={0}
                step={1}
                placeholder="—"
                defaultValue={numOrEmpty(def)}
                className="w-24 rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-sm text-[var(--crm-foreground)]"
              />
            </label>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={busy}
            className="rounded-lg bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] px-3 py-1.5 text-sm font-medium disabled:opacity-50"
          >
            {busy ? "Recording…" : "Record snapshot"}
          </button>
          {message && (
            <span
              className={
                message.ok
                  ? "text-sm text-emerald-600 dark:text-emerald-400"
                  : "text-sm text-red-600 dark:text-red-400"
              }
            >
              {message.text}
            </span>
          )}
        </div>
      </form>
    </div>
  );
}
