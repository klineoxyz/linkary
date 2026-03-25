"use client";

import { useState } from "react";
import { recordSnapshotAction } from "../actions";

const SNAPSHOT_TYPES = [
  { value: "baseline", label: "Baseline" },
  { value: "daily", label: "Daily" },
  { value: "end", label: "End" },
] as const;

export function RecordSnapshotForm({
  campaignId,
  hasHandles,
}: {
  campaignId: string;
  hasHandles: boolean;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  if (!hasHandles) return null;

  async function submit(formData: FormData) {
    setBusy(true);
    setMessage(null);
    const result = await recordSnapshotAction(campaignId, formData);
    setBusy(false);
    if (result.error) setMessage({ ok: false, text: result.error });
    else setMessage({ ok: true, text: "Snapshot recorded for all promoted accounts." });
  }

  const today = new Date().toISOString().slice(0, 10);

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
              defaultValue={today}
              className="rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-sm text-[var(--crm-foreground)]"
            />
          </label>
          {["followers", "views", "likes", "replies", "quotes", "reposts", "engagement_total"].map(
            (field) => (
              <label key={field} className="flex flex-col gap-1">
                <span className="text-xs text-[var(--crm-muted)]">{field}</span>
                <input
                  type="number"
                  name={field}
                  min={0}
                  step={1}
                  placeholder="—"
                  className="w-24 rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-sm text-[var(--crm-foreground)]"
                />
              </label>
            )
          )}
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
