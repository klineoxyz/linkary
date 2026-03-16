"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { TaskFilter } from "@/lib/tasks";

const filters: { value: TaskFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "this_week", label: "This week" },
  { value: "overdue", label: "Overdue" },
  { value: "campaign", label: "Campaign tasks" },
  { value: "submitted", label: "Submitted" },
  { value: "approved", label: "Approved" },
];

export function TasksFilters() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const current = (searchParams.get("filter") as TaskFilter) || "all";

  return (
    <div className="flex flex-wrap gap-2">
      {filters.map(({ value, label }) => {
        const isActive = current === value;
        const href = value === "all" ? "/tasks" : `/tasks?filter=${value}`;
        return (
          <Link
            key={value}
            href={href}
            className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
              isActive
                ? "bg-[var(--crm-primary)] text-white"
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
