"use client";

import React from "react";
import { EmptyStateCard } from "./EmptyStateCard";
import { Link2 } from "lucide-react";

export interface AffiliatedAccountsCardProps {
  accounts: unknown[];
  emptyMessage?: string;
}

export function AffiliatedAccountsCard({
  accounts,
  emptyMessage = "Nothing here yet",
}: AffiliatedAccountsCardProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white/90">Affiliated accounts</h3>
        <EmptyStateCard
          title="No affiliated accounts"
          message={emptyMessage}
          icon={<Link2 className="h-10 w-10" />}
          className="mt-3 border-0 bg-transparent p-0"
        />
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <h3 className="text-sm font-semibold text-white/90">Affiliated accounts</h3>
      <ul className="mt-3 space-y-2">
        {(accounts as Record<string, unknown>[]).map((a, i) => (
          <li key={i} className="rounded-xl bg-white/5 px-3 py-2 text-xs text-white/70">
            {JSON.stringify(a)}
          </li>
        ))}
      </ul>
    </div>
  );
}
