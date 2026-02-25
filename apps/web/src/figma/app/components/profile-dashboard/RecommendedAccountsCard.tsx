"use client";

import React from "react";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";

export interface RecommendedAccount {
  id: string;
  name: string;
  username: string;
  avatar_url: string | null;
  url?: string;
}

export interface RecommendedAccountsCardProps {
  accounts: RecommendedAccount[];
  onAccountClick?: (username: string) => void;
  emptyMessage?: string;
  /** Use "light" on light page backgrounds so text is readable */
  variant?: "light" | "dark";
}

export function RecommendedAccountsCard({
  accounts,
  onAccountClick,
  emptyMessage = "Nothing here yet",
  variant = "dark",
}: RecommendedAccountsCardProps) {
  const isLight = variant === "light";
  const wrapper = isLight
    ? "rounded-2xl border border-border bg-card p-6"
    : "rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6";
  if (accounts.length === 0) {
    return (
      <div className={wrapper}>
        <h3 className={isLight ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-white/90"}>Recommended accounts</h3>
        <p className={isLight ? "mt-3 py-4 text-center text-xs font-medium text-foreground" : "mt-3 py-4 text-center text-xs text-white/50"}>
          {emptyMessage}
        </p>
      </div>
    );
  }
  return (
    <div className={wrapper}>
      <h3 className={isLight ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-white/90"}>Recommended accounts</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        {accounts.slice(0, 3).map((acc) => {
          const safeAvatar = acc.avatar_url && !isPrivateStorageUrl(acc.avatar_url)
            ? acc.avatar_url
            : (acc.username ? `https://unavatar.io/twitter/${encodeURIComponent(acc.username.replace(/^@/, ""))}` : null);
          return (
            <button
              key={acc.id}
              type="button"
              onClick={() => onAccountClick?.(acc.username)}
              className={
                isLight
                  ? "flex flex-col items-center rounded-xl bg-secondary border border-border p-3 text-center transition-colors hover:bg-accent"
                  : "flex flex-col items-center rounded-xl bg-white/5 p-3 text-center transition-colors hover:bg-white/10"
              }
            >
              {safeAvatar ? (
                <img src={safeAvatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className={`h-12 w-12 rounded-xl ${isLight ? "bg-muted" : "bg-white/10"}`} />
              )}
              <p className={isLight ? "mt-2 truncate w-full text-xs font-medium text-foreground" : "mt-2 truncate w-full text-xs font-medium text-white/90"}>
                {acc.name || acc.username}
              </p>
              <p className={isLight ? "truncate w-full text-xs font-medium text-foreground" : "truncate w-full text-xs text-white/50"}>
                @{acc.username.replace(/^@/, "")}
              </p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
