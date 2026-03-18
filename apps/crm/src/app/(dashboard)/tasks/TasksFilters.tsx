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
          className="inline-flex items-center gap-1.5 crm-surface-card px-3 py-2 text-sm font-medium text-[var(--crm-foreground)] hover:border-[var(--crm-primary)]/25 no-underline"
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
            className={`rounded-[var(--crm-radius)] px-3 py-2 text-sm font-medium transition-colors no-underline ${
              isActive
                ? "bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] shadow-sm"
                : "crm-surface-card text-[var(--crm-muted)] hover:text-[var(--crm-foreground)] hover:border-[var(--crm-primary)]/20"
            }`}
          >
            {label}
          </Link>
        );
      })}
    </div>
  );
}
