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

function relativeTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export interface TopFollowersCardProps {
  tabs: { id: string; label: string }[];
  activeTab: string;
  onTabChange: (id: string) => void;
  items: TopFollowerItem[];
  sampleLabel?: string | null;
  onSeeAll?: () => void;
  emptyMessage?: string;
  /** Phase 7: cache status and last updated */
  cacheStatus?: "hit" | "miss" | "stale";
  updatedAt?: string | null;
  /** Use "light" on light page backgrounds so text is readable */
  variant?: "light" | "dark";
}

export function TopFollowersCard({
  tabs,
  activeTab,
  onTabChange,
  items,
  sampleLabel,
  onSeeAll,
  emptyMessage = "Nothing here yet",
  cacheStatus,
  updatedAt,
  variant = "dark",
}: TopFollowersCardProps) {
  const isLight = variant === "light";
  const statusLine =
    cacheStatus === "stale"
      ? "Data is stale, refreshing soon"
      : cacheStatus === "miss"
        ? "No data yet. Sync will run automatically."
        : updatedAt
          ? `Updated: ${relativeTime(updatedAt)}`
          : null;

  return (
    <div
      className={
        isLight
          ? "rounded-2xl border border-border bg-card p-6"
          : "rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6"
      }
    >
      <div className="flex items-center justify-between">
        <h3 className={isLight ? "text-sm font-semibold text-foreground" : "text-sm font-semibold text-white/90"}>Top followers</h3>
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
      {(sampleLabel || statusLine) && (
        <p className={isLight ? "mt-1 text-xs font-medium text-foreground" : "mt-1 text-xs text-white/50"}>
          {statusLine ?? sampleLabel}
        </p>
      )}
      <div className={`mt-3 flex gap-2 border-b pb-2 ${isLight ? "border-border" : "border-white/10"}`}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => onTabChange(tab.id)}
            className={
              isLight
                ? `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id ? "bg-primary/20 text-primary" : "text-foreground hover:bg-secondary"
                  }`
                : `rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                    activeTab === tab.id ? "bg-primary/20 text-primary" : "text-white/60 hover:bg-white/10"
                  }`
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <p className={isLight ? "py-4 text-center text-xs font-medium text-foreground" : "py-4 text-center text-xs text-white/50"}>
            {emptyMessage}
          </p>
        ) : (
          items.slice(0, 5).map((item) => {
            const safeAvatar = item.avatar_url && !isPrivateStorageUrl(item.avatar_url)
              ? item.avatar_url
              : (item.username ? `https://unavatar.io/twitter/${encodeURIComponent(item.username.replace(/^@/, ""))}` : null);
            return (
              <div
                key={item.username}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 ${isLight ? "bg-secondary border border-border" : "bg-white/5"}`}
              >
                {safeAvatar ? (
                  <img src={safeAvatar} alt="" className="h-8 w-8 rounded-lg object-cover" />
                ) : (
                  <div className={`h-8 w-8 rounded-lg ${isLight ? "bg-muted" : "bg-white/10"}`} />
                )}
                <div className="min-w-0 flex-1">
                  <p className={isLight ? "truncate text-sm font-medium text-foreground" : "truncate text-sm font-medium text-white/90"}>
                    {item.display_name || `@${item.username.replace(/^@/, "")}`}
                  </p>
                  <p className={isLight ? "truncate text-xs font-medium text-foreground" : "truncate text-xs text-white/50"}>
                    @{item.username.replace(/^@/, "")}
                  </p>
                </div>
                {item.followers != null && (
                  <span className={isLight ? "text-xs font-medium text-foreground" : "text-xs text-white/50"}>
                    {item.followers.toLocaleString()} followers
                  </span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
