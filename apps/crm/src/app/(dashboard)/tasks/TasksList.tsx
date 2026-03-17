"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { TaskRow } from "@/lib/tasks";
import { Calendar, FileText } from "lucide-react";

function formatDue(due: string | null): string {
  if (!due) return "—";
  const d = new Date(due);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const dDay = new Date(d);
  dDay.setHours(0, 0, 0, 0);
  if (dDay.getTime() === today.getTime()) return "Today";
  if (dDay.getTime() === tomorrow.getTime()) return "Tomorrow";
  if (d < today) return "Overdue";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: d.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
}

/* Linkary palette only: use CRM tokens for status badges */
function statusBadgeClass(status: string): string {
  const base = "inline-flex rounded-full px-2 py-0.5 text-xs font-medium ";
  const positive = "bg-[var(--crm-accent)] text-[var(--crm-primary)]";
  const neutral = "bg-[var(--crm-bg)] text-[var(--crm-muted)]";
  const negative = "bg-[var(--crm-muted)]/20 text-[var(--crm-foreground)]";
  const m: Record<string, string> = {
    backlog: neutral,
    to_do: "bg-[var(--crm-accent)] text-[var(--crm-foreground)]",
    in_progress: positive,
    submitted: neutral,
    approved: positive,
    rejected: negative,
    done: positive,
  };
  return base + (m[status] ?? neutral);
}

export function TasksList({
  tasks,
  emptyStateCTA,
}: {
  tasks: TaskRow[];
  /** Rendered in the empty state (e.g. CreateTaskButton) for strong first-task CTA. */
  emptyStateCTA?: ReactNode;
}) {
  if (tasks.length === 0) {
    return (
      <div className="space-y-4">
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center">
          <FileText className="mx-auto h-12 w-12 text-[var(--crm-muted)] mb-4" aria-hidden />
          <h3 className="font-medium text-[var(--crm-foreground)] mb-1">No tasks yet</h3>
          <p className="text-sm text-[var(--crm-muted)] max-w-md mx-auto mb-6">
            Add your own tasks to track work, or wait for campaign tasks to appear here when you’re in a campaign.
          </p>
          {emptyStateCTA && <div className="flex justify-center">{emptyStateCTA}</div>}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Task</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Campaign</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Bundle</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Status</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Due</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Platform</th>
              <th className="text-left py-3 px-4 font-medium text-[var(--crm-muted)]">Source</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--crm-border)]">
            {tasks.map((t) => (
              <tr key={t.id} className="hover:bg-[var(--crm-bg)]/50">
                <td className="py-3 px-4">
                  <Link
                    href={`/tasks/${t.id}`}
                    className="font-medium text-[var(--crm-primary)] hover:underline"
                  >
                    {t.title}
                  </Link>
                </td>
                <td className="py-3 px-4 text-[var(--crm-muted)]">
                  {t.campaign_title ?? "—"}
                </td>
                <td className="py-3 px-4 text-[var(--crm-muted)]">
                  {t.task_bundle_title ?? "—"}
                </td>
                <td className="py-3 px-4">
                  <span className={statusBadgeClass(t.status)}>
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--crm-muted)] flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {formatDue(t.due_at)}
                </td>
                <td className="py-3 px-4 text-[var(--crm-muted)]">{t.platform ?? "—"}</td>
                <td className="py-3 px-4">
                  <span
                    className={
                      t.source_type === "manual"
                        ? "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--crm-bg)] text-[var(--crm-muted)]"
                        : "inline-flex rounded-full px-2 py-0.5 text-xs font-medium bg-[var(--crm-accent)] text-[var(--crm-primary)]"
                    }
                  >
                    {t.source_type === "manual" ? "Manual" : "Campaign"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
