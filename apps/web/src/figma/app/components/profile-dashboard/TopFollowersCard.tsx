"use client";

import React from "react";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";

export interface TopFollowerItem {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  tier?: string;
}

export interface TopFollowersCardProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  items: TopFollowerItem[];
  sampleLabel?: string | null;
  onSeeAll?: () => void;
  emptyMessage?: string;
}

export function TopFollowersCard({
  tabs,
  activeTab,
  onTabChange,
  items,
  sampleLabel,
  onSeeAll,
  emptyMessage = "Nothing here yet",
}: TopFollowersCardProps) {
  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-white/90">Top followers</h3>
        {onSeeAll && (
          <button
            type="button"
            onClick={onSeeAll}
            className="text-xs font-medium text-primary hover:text-primary/80"
          >
            See all
          </button>
        )}
      </div>
      {sampleLabel && <p className="mt-1 text-xs text-white/50">{sampleLabel}</p>}
      <div className="mt-3 flex gap-2 border-b border-white/10 pb-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              activeTab === tab.id ? "bg-primary/20 text-primary" : "text-white/60 hover:bg-white/10"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className="py-4 text-center text-xs text-white/50">{emptyMessage}</p>
        ) : (
          items.slice(0, 5).map((item) => {
            const safeAvatar = item.avatar_url && !isPrivateStorageUrl(item.avatar_url)
              ? item.avatar_url
              : (item.username ? `https://unavatar.io/twitter/${encodeURIComponent(item.username.replace(/^@/, ""))}` : null);
            return (
              <div
                key={item.username}
                className="flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2"
              >
                {safeAvatar ? (
                  <img src={safeAvatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className="h-8 w-8 rounded-lg bg-white/10" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-white/90">
                    {item.display_name || `@${item.username.replace(/^@/, "")}`}
                  </p>
                  <p className="truncate text-xs text-white/50">@{item.username.replace(/^@/, "")}</p>
                </div>
                {item.followers != null && (
                  <span className="text-xs text-white/50">{item.followers.toLocaleString()} followers</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
