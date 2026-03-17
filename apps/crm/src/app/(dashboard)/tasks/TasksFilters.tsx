"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { TaskFilter } from "@/lib/tasks";
import { X } from "lucide-react";

const filters: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "this_week", label: "This week" },
  { value: "overdue", label: "Overdue" },
  { value: "campaign", label: "Campaign tasks" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
];

export function TasksFilters({
  campaignId,
  campaignTitle,
}: {
  campaignId?: string | null;
  campaignTitle?: string | null;
}) {
  const searchParams = useSearchParams();
  const current = (searchParams.get("filter") as TaskFilter) || "all";

  function buildHref(filterValue: TaskFilter): string {
    const params = new URLSearchParams();
    if (filterValue !== "all") params.set("filter", filterValue);
    if (campaignId) params.set("campaign", campaignId);
    const q = params.toString();
    return q ? `/tasks?${q}` : "/tasks";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {campaignId && campaignTitle && (
        <Link
          href="/tasks"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-card)] px-3 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:bg-[var(--crm-bg)]"
        >
          <span className="max-w-[180px] truncate" title={campaignTitle}>
            {campaignTitle}
          </span>
          <X className="h-3.5 w-3.5 shrink-0" />
        </Link>
      )}
      {filters.map(({ value, label }) => {
        const isActive = current === value;
        const href = buildHref(value);
        return (
          <Link
            key={value}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)]"
                : "bg-[var(--crm-card)] border border-[var(--crm-border)] text-[var(--crm-muted)] hover:bg-[var(--crm-border)] hover:text-[var(--crm-primary)]"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
