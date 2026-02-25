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
}

export function RecommendedAccountsCard({
  accounts,
  onAccountClick,
  emptyMessage = "Nothing here yet",
}: RecommendedAccountsCardProps) {
  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white/90">Recommended accounts</h3>
        <p className="mt-3 py-4 text-center text-xs text-white/50">{emptyMessage}</p>
      </div>
    );
  }
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <h3 className="text-sm font-semibold text-white/90">Recommended accounts</h3>
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
              className="flex flex-col items-center rounded-xl bg-white/5 p-3 text-center transition-colors hover:bg-white/10"
            >
              {safeAvatar ? (
                <img src={safeAvatar} alt="" className="h-12 w-12 rounded-xl object-cover" />
              ) : (
                <div className="h-12 w-12 rounded-xl bg-white/10" />
              )}
              <p className="mt-2 truncate w-full text-xs font-medium text-white/90">{acc.name || acc.username}</p>
              <p className="truncate w-full text-xs text-white/50">@{acc.username.replace(/^@/, "")}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
