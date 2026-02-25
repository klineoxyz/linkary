"use client";

import React from "react";
import { EmptyStateCard } from "./EmptyStateCard";
import { Link2 } from "lucide-react";

export interface AffiliatedAccountsCardProps {
  accounts: unknown[];
  emptyMessage?: string;
  /** Use "light" on light page backgrounds so text is readable */
  variant?: "light" | "dark";
}

export function AffiliatedAccountsCard({
  accounts,
  emptyMessage = "Nothing here yet",
  variant = "dark",
}: AffiliatedAccountsCardProps) {
  const isLight = variant === "light";
  const wrapper = isLight
    ? "rounded-2xl border border-border bg-card p-6"
    : "rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6";
  if (accounts.length === 0) {
    return (
      <div className={wrapper}>
        <h3 className={isLight ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-white/90"}>Affiliated accounts</h3>
        <EmptyStateCard
          variant={variant}
          title="No affiliated accounts"
          message={emptyMessage}
          icon={<Link2 className="h-10 w-10" />}
          className="mt-3 border-0 bg-transparent p-0"
        />
      </div>
    );
  }
  return (
    <div className={wrapper}>
      <h3 className={isLight ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-white/90"}>Affiliated accounts</h3>
      <ul className="mt-3 space-y-2">
        {(accounts as Record<string, unknown>[]).map((a, i) => (
          <li
            key={i}
            className={
              isLight
                ? "rounded-xl bg-secondary border border-border px-3 py-2 text-xs font-medium text-foreground"
                : "rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70"
            }
          >
            {JSON.stringify(a)}
          </li>
        ))}
      </ul>
    </div>
  );
}
