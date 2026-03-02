"use client";

import React from "react";
import { Youtube, Video } from "lucide-react";
import { formatTimeAgo } from "./utils";
import type { WindowPeriod } from "./types";

export interface AnalyticsHeaderProps {
  /** Tweets synced: time ago */
  tweetsSyncedAt: string | null;
  /** Followers synced: time ago */
  followersSyncedAt: string | null;
  /** Show subtle stale indicator when true */
  followerDataStale?: boolean;
  /** Global window: single source of truth */
  windowPeriod: WindowPeriod;
  onWindowChange: (period: WindowPeriod) => void;
  onRefresh: () => void;
  refreshLoading: boolean;
  /** e.g. when job is queued or running */
  refreshDisabled?: boolean;
  setRoute?: (route: { name: string }) => void;
}

const PLATFORMS = [
  { id: "x" as const, label: "X", icon: null },
  { id: "youtube" as const, label: "YouTube", soon: true, icon: Youtube },
  { id: "tiktok" as const, label: "TikTok", soon: true, icon: Video },
];

export function AnalyticsHeader({
  tweetsSyncedAt,
  followersSyncedAt,
  followerDataStale,
  windowPeriod,
  onWindowChange,
  onRefresh,
  refreshLoading,
  refreshDisabled,
  setRoute,
}: AnalyticsHeaderProps) {
  return (
    <header
      className="sticky top-0 z-40 rounded-xl border border-border bg-card shadow-sm py-2.5 px-4 md:px-5"
      data-page="analytics"
    >
      <div className="flex flex-col gap-2 md:gap-0 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-4">
          {setRoute && (
            <a
              href="/dashboard"
              onClick={(e) => {
                e.preventDefault();
                setRoute({ name: "dashboard" });
              }}
              className="text-sm text-muted-foreground hover:text-foreground self-start sm:order-[-1] sm:mr-2"
            >
              ← Back
            </a>
          )}
          <div className="flex items-center gap-2">
            <h1 className="text-base font-semibold text-foreground tracking-tight">Analytics</h1>
            <div className="flex items-center gap-1">
              {PLATFORMS.map((p) => (
                <span
                  key={p.id}
                  className={`
                    inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
                    ${p.id === "x" ? "bg-primary/10 text-primary border border-primary/20" : "text-muted-foreground border border-border"}
                    ${p.soon ? "opacity-60" : ""}
                  `}
                >
                  {p.id === "x" ? <span aria-label="X">𝕏</span> : p.icon ? <p.icon className="w-3 h-3" /> : null}
                  {p.label}
                  {p.soon && <span className="text-[10px] text-muted-foreground">Soon</span>}
                </span>
              ))}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${tweetsSyncedAt ? "bg-primary/80" : "bg-muted-foreground/50"}`}
                aria-hidden
              />
              Tweets synced: {tweetsSyncedAt ? formatTimeAgo(tweetsSyncedAt) : "—"}
            </span>
            <span className="flex items-center gap-1.5">
              <span
                className={`inline-block w-1.5 h-1.5 rounded-full shrink-0 ${
                  followersSyncedAt ? (followerDataStale ? "bg-amber-500" : "bg-primary/80") : "bg-muted-foreground/50"
                }`}
                aria-hidden
              />
              Followers synced: {followersSyncedAt ? formatTimeAgo(followersSyncedAt) : "—"}
              {followerDataStale && <span className="text-amber-600 dark:text-amber-400">(stale)</span>}
            </span>
          </div>
        </div>

        {/* Right: window selector + Refresh */}
        <div className="flex items-center gap-2 flex-shrink-0">
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/30 p-0.5">
            {(["7D", "30D", "90D"] as const).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => onWindowChange(p)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  windowPeriod === p ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {p}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshLoading || refreshDisabled}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshLoading || refreshDisabled ? "Refreshing…" : "Refresh data"}
          </button>
        </div>
      </div>
    </header>
  );
}
