"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { TaskRow } from "@/lib/tasks";
import { Calendar, FileText, ListTodo, Megaphone } from "lucide-react";

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
  isBoardTotallyEmpty = false,
  campaignFilterActive = false,
  enrolledInFilteredCampaign = false,
}: {
  tasks: TaskRow[];
  emptyStateCTA?: ReactNode;
  /** No tasks on the board at all (any filter). */
  isBoardTotallyEmpty?: boolean;
  /** URL has ?campaign= */
  campaignFilterActive?: boolean;
  /** User is in that campaign but list is empty (sync / not generated yet). */
  enrolledInFilteredCampaign?: boolean;
}) {
  if (tasks.length === 0) {
    const filterOnly = !isBoardTotallyEmpty;
    return (
      <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
        <div className="p-6 sm:p-10 text-center px-4">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--crm-bg)] text-[var(--crm-muted)] mb-6" aria-hidden>
            <ListTodo className="h-7 w-7" />
          </div>
          <h3 className="text-lg font-semibold text-[var(--crm-foreground)] mb-2">
            {isBoardTotallyEmpty ? "Your board is ready" : "No tasks match this view"}
          </h3>
          <p className="text-sm text-[var(--crm-muted)] max-w-md mx-auto mb-2">
            {isBoardTotallyEmpty
              ? "Add a personal task, or wait for campaign tasks after you accept work on Linkary."
              : "Try another filter or clear the campaign filter to see all tasks."}
          </p>
          {filterOnly && campaignFilterActive && enrolledInFilteredCampaign && (
            <p className="text-xs text-[var(--crm-muted)] max-w-md mx-auto mb-3 rounded-lg bg-[var(--crm-bg)] px-3 py-2">
              If you just accepted this campaign, tasks may still be syncing—refresh in a minute. Weekly/recurring tasks may appear after the org generates them.
            </p>
          )}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-6">
            {emptyStateCTA && <div className="flex justify-center">{emptyStateCTA}</div>}
            {isBoardTotallyEmpty && (
              <p className="text-xs text-[var(--crm-muted)] flex items-center gap-1.5 max-w-xs justify-center">
                <Megaphone className="h-3.5 w-3.5 shrink-0" />
                Campaign work syncs from Linkary after you accept
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--crm-border)] bg-[var(--crm-card)] overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--crm-border)] bg-[var(--crm-bg)]">
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Task</th>
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Type</th>
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Campaign</th>
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Bundle</th>
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Status</th>
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Due</th>
              <th className="text-left py-3.5 px-5 font-medium text-[var(--crm-muted)]">Platform</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--crm-border)]">
            {tasks.map((t) => {
              const isManual = t.source_type === "manual";
              return (
                <tr
                  key={t.id}
                  className={`hover:bg-[var(--crm-bg)]/60 transition-colors ${
                    isManual ? "" : "bg-[var(--crm-primary)]/[0.03]"
                  }`}
                >
                  <td className="py-3.5 px-5">
                    <Link
                      href={`/tasks/${t.id}`}
                      className="font-medium text-[var(--crm-foreground)] hover:text-[var(--crm-primary)] hover:underline"
                    >
                      {t.title}
                    </Link>
                  </td>
                  <td className="py-3.5 px-5">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                        isManual
                          ? "bg-[var(--crm-bg)] text-[var(--crm-muted)] border border-[var(--crm-border)]"
                          : "bg-[var(--crm-primary)]/10 text-[var(--crm-primary)] border border-[var(--crm-primary)]/20"
                      }`}
                    >
                      {isManual ? (
                        <>
                          <FileText className="h-3 w-3 shrink-0" />
                          Personal
                        </>
                      ) : (
                        <>
                          <Megaphone className="h-3 w-3 shrink-0" />
                          Campaign
                        </>
                      )}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-[var(--crm-muted)]">
                    {t.campaign_title ?? "—"}
                  </td>
                  <td className="py-3.5 px-5 text-[var(--crm-muted)]">
                    {t.task_bundle_title ?? "—"}
                  </td>
                  <td className="py-3.5 px-5">
                    <span className={statusBadgeClass(t.status)}>
                      {t.status.replace("_", " ")}
                    </span>
                  </td>
                  <td className="py-3.5 px-5 text-[var(--crm-muted)] flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5 shrink-0" />
                    {formatDue(t.due_at)}
                  </td>
                  <td className="py-3.5 px-5 text-[var(--crm-muted)]">{t.platform ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
