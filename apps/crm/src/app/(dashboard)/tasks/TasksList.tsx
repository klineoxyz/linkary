"use client";

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

function statusColor(status: string): string {
  const m: Record<string, string> = {
    backlog: "bg-gray-100 text-gray-700",
    to_do: "bg-sky-100 text-sky-800",
    in_progress: "bg-amber-100 text-amber-800",
    submitted: "bg-purple-100 text-purple-800",
    approved: "bg-green-100 text-green-800",
    rejected: "bg-red-100 text-red-800",
    done: "bg-emerald-100 text-emerald-800",
  };
  return m[status] ?? "bg-gray-100 text-gray-700";
}

export function TasksList({ tasks }: { tasks: TaskRow[] }) {
  if (tasks.length === 0) {
    return (
      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-12 text-center">
        <FileText className="mx-auto h-12 w-12 text-[var(--crm-muted)] mb-4" />
        <h3 className="font-medium text-[var(--crm-primary)] mb-1">No tasks yet</h3>
        <p className="text-sm text-[var(--crm-muted)]">
          Create a task above or wait for campaign tasks to appear here.
        </p>
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
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusColor(t.status)}`}>
                    {t.status.replace("_", " ")}
                  </span>
                </td>
                <td className="py-3 px-4 text-[var(--crm-muted)] flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5 shrink-0" />
                  {formatDue(t.due_at)}
                </td>
                <td className="py-3 px-4 text-[var(--crm-muted)]">{t.platform ?? "—"}</td>
                <td className="py-3 px-4 text-[var(--crm-muted)]">{t.source_type.replace("_", " ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
