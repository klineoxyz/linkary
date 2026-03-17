"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { Users, BarChart2, Eye, TrendingUp, Heart, ThumbsUp, MessageCircle } from "lucide-react";
import {
  FollowerGrowthChart,
  EngagementChart,
  PostingCadenceChart,
  ChartSkeleton,
} from "@/figma/app/components/analytics";
import { SWR_DEDUP_MS } from "@/lib/swrAuthFetcher";

function formatIslandValue(n: number): string {
  if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return n.toLocaleString();
}

type ApiSuccess = {
  ok: true;
  data: {
    window_days: number;
    window_start: string;
    window_end: string;
    follower_data_coverage_days: number;
    chart_points: {
      engagement_rate: Array<{
        date: string;
        engagement_pct: number;
        posts: number;
        is_estimated?: boolean;
        is_capped?: boolean;
      }>;
      posting_cadence: Array<{ date: string; posts: number }>;
      follower_growth: Array<{ date: string; follower_delta: number }>;
    };
    kpis: {
      posts_total: number;
      impressions_total: number;
      engagements_total: number;
      engagement_pct_avg: number;
      followers_latest: number | null;
      avg_likes_per_post: number;
      avg_replies_per_post: number;
      potential_reach: number;
      prior_potential_reach?: number;
      prior_engagements_total?: number;
      prior_posts_total?: number;
      prior_avg_likes_per_post?: number;
      prior_avg_replies_per_post?: number;
    };
    debug?: { auth_mode: string };
  };
};

type ApiError = {
  ok: false;
  code: string;
  message: string;
};

type ApiResponse = ApiSuccess | ApiError;

async function analyticsFetcher(url: string): Promise<ApiResponse> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}${url}`, { credentials: "include" });
  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, code: "BAD_RESPONSE", message: "Non-JSON response" };
  }
  if (!res.ok) {
    if (json && typeof json === "object" && "ok" in json && (json as ApiError).ok === false) {
      const err = json as ApiError;
      return { ok: false, code: err.code ?? "ERROR", message: err.message ?? "Request failed" };
    }
    return {
      ok: false,
      code: "ERROR",
      message: (json && typeof json === "object" && "message" in json && typeof (json as { message: unknown }).message === "string")
        ? (json as { message: string }).message
        : "Request failed",
    };
  }
  if (json && typeof json === "object" && "ok" in json && (json as ApiSuccess).ok === true) {
    return json as ApiSuccess;
  }
  return { ok: false, code: "BAD_RESPONSE", message: "Invalid response shape" };
}

type WindowParam = "7d" | "30d" | "90d";

type PlatformTab = "x" | "youtube" | "tiktok" | "facebook";

const PLATFORM_TABS: { id: PlatformTab; label: string; available: boolean }[] = [
  { id: "x", label: "X", available: true },
  { id: "youtube", label: "YouTube", available: false },
  { id: "tiktok", label: "TikTok", available: false },
  { id: "facebook", label: "Facebook", available: false },
];

function XLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YoutubeLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function TiktokLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
    </svg>
  );
}

function FacebookLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function PlatformIcon({ platform, active }: { platform: PlatformTab; active: boolean }) {
  const c = "w-5 h-5 shrink-0";
  switch (platform) {
    case "x":
      return <XLogo className={c} />;
    case "youtube":
      return <YoutubeLogo className={c} />;
    case "tiktok":
      return <TiktokLogo className={c} />;
    case "facebook":
      return <FacebookLogo className={c} />;
  }
}

export default function AnalyticsPage({ setRoute }: { setRoute?: (route: { name: string }) => void }) {
  const searchParams = useSearchParams();
  const showDebug = searchParams?.get("debug") === "1";
  const [platform, setPlatform] = useState<PlatformTab>("x");
  const [windowParam, setWindowParam] = useState<WindowParam>("30d");
  const key = `/api/analytics/x?window=${windowParam}${showDebug ? "&debug=1" : ""}`;

  const { data: res, isLoading } = useSWR<ApiResponse>(key, analyticsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: SWR_DEDUP_MS,
  });

  const payload = res?.ok === true ? res.data : null;

  const deltaPct = useMemo(() => {
    if (!payload) return (_c: number, _p?: number) => null as number | null;
    return (curr: number, prior: number | undefined): number | null => {
      if (prior == null || prior === 0 || !Number.isFinite(curr)) return null;
      return ((curr - prior) / prior) * 100;
    };
  }, [payload]);

  const engagementPoints = payload?.chart_points?.engagement_rate ?? [];
  const cadencePoints = payload?.chart_points?.posting_cadence ?? [];
  const followerPoints = payload?.chart_points?.follower_growth ?? [];
  const windowDays = payload?.window_days ?? 30;
  const followerCoverageDays = payload?.follower_data_coverage_days ?? 0;
  const activeDaysEngagement = engagementPoints.filter((p) => (p.posts ?? 0) > 0).length;
  const activeDaysCadence = cadencePoints.filter((p) => (p.posts ?? 0) > 0).length;
  const noPostsEngagement = activeDaysEngagement === 0;
  const insufficientEngagement = activeDaysEngagement > 0 && activeDaysEngagement < 3;
  const noPostsCadence = activeDaysCadence === 0;
  const insufficientCadence = activeDaysCadence > 0 && activeDaysCadence < 3;
  const followerInsufficient = followerPoints.length < 3;

  const freshness = payload?.freshness as { has_x_handle?: boolean; last_sync_at?: string | null; data_state?: "none" | "partial" | "full" } | undefined;
  const hasXHandle = freshness?.has_x_handle ?? true;
  const lastSyncAt = freshness?.last_sync_at ?? null;
  const dataState = freshness?.data_state ?? "none";
  function freshnessLabel(): string {
    if (!hasXHandle) return "Connect X in Integrations to see analytics.";
    if (!lastSyncAt && dataState === "none") return "Sync from Integrations to populate data.";
    if (lastSyncAt) {
      const d = new Date(lastSyncAt);
      if (!isNaN(d.getTime())) {
        const sec = Math.floor((Date.now() - d.getTime()) / 1000);
        if (sec < 60) return "Last updated: just now";
        if (sec < 3600) return "Last updated: " + Math.floor(sec / 60) + "m ago";
        if (sec < 86400) return "Last updated: " + Math.floor(sec / 3600) + "h ago";
        if (sec < 604800) return "Last updated: " + Math.floor(sec / 86400) + "d ago";
        return "Last updated: " + d.toLocaleDateString();
      }
    }
    if (dataState === "partial") return "Building history…";
    if (dataState === "none" && hasXHandle) return "No activity in this window. Try 90d or sync from Integrations.";
    return "";
  }

  if (res?.ok === false) {
    return (
      <div className="min-h-screen bg-background" data-page="analytics">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">{res.message}</p>
            <a
              href="/app/settings/integrations"
              className="inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              Go to Integrations
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" data-page="analytics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* Platform tabs — X active; YouTube / TikTok / Facebook coming soon */}
        <div className="border-b border-border" role="tablist" aria-label="Analytics platform">
          <div className="flex gap-0">
            {PLATFORM_TABS.map((tab) => {
              const isActive = platform === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-disabled={!tab.available}
                  onClick={() => tab.available && setPlatform(tab.id)}
                  className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                    isActive
                      ? "border-primary text-primary"
                      : tab.available
                        ? "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                        : "border-transparent text-muted-foreground/70 cursor-default"
                  }`}
                >
                  <span className="inline-flex items-center gap-2">
                    <PlatformIcon platform={tab.id} active={isActive} />
                    <span>{tab.label}</span>
                    {!tab.available && (
                      <span className="text-[10px] font-normal normal-case text-muted-foreground">Coming soon</span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {platform !== "x" ? (
          <div className="rounded-xl border border-border bg-card p-8 text-center">
            <p className="text-sm font-medium text-foreground">{PLATFORM_TABS.find((t) => t.id === platform)?.label} analytics</p>
            <p className="text-sm text-muted-foreground mt-1">Coming soon. Connect your account in Integrations to be ready.</p>
            <a
              href="/app/settings/integrations"
              className="inline-block mt-4 text-xs text-primary hover:underline underline-offset-2"
            >
              Go to Integrations
            </a>
          </div>
        ) : (
          <>
        {/* Same layout for all profiles; empty state when no X handle or no synced data */}
        {payload && payload.kpis.posts_total === 0 && payload.kpis.followers_latest == null && (
          <div className="rounded-xl border border-border bg-muted/30 px-4 py-3 text-center">
            <p className="text-sm text-muted-foreground">
              {!hasXHandle
                ? "Connect your X handle in Integrations to see analytics here."
                : dataState === "none" && !lastSyncAt
                  ? "Sync from Integrations to populate data. No synced data yet."
                  : dataState === "none"
                    ? "No activity in this time window. Try 90d or sync again from Integrations."
                    : "X metrics appear when your profile has an X handle connected and sync has run. Add your handle in Integrations and run sync to populate data here."}
            </p>
            <a
              href="/app/settings/integrations"
              className="inline-block mt-2 text-xs font-medium text-primary hover:underline underline-offset-2"
            >
              Go to Integrations
            </a>
          </div>
        )}
        <header className="rounded-xl border border-border bg-card py-2.5 px-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {setRoute && (
                <a
                  href="/app/dashboard"
                  onClick={(e) => {
                    e.preventDefault();
                    setRoute({ name: "dashboard" });
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Back
                </a>
              )}
              <h1 className="text-base font-semibold text-foreground tracking-tight">X</h1>
              {payload && freshnessLabel() && (
                <span className="text-xs text-muted-foreground" aria-live="polite">
                  {freshnessLabel()}
                </span>
              )}
            </div>
            <div className="inline-flex rounded-md border border-border bg-muted/30 p-0.5" role="group" aria-label="Time window">
              {(["7d", "30d", "90d"] as const).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWindowParam(w)}
                  className={`px-3 py-1.5 rounded text-xs font-medium tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
                    windowParam === w ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {w === "7d" ? "7d" : w === "30d" ? "30d" : "90d"}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* Stats islands — same style as Overview page */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-foreground/80 transition-all duration-500 group-hover:from-primary/95 group-hover:to-foreground/90" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Followers</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Users className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{payload ? (payload.kpis.followers_latest != null ? formatIslandValue(payload.kpis.followers_latest) : "—") : "0"}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{payload?.kpis.followers_latest != null && payload.kpis.followers_latest > 0 ? "Latest in window" : "Beta"}</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Posts</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <BarChart2 className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{payload ? payload.kpis.posts_total.toLocaleString() : "0"}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{(payload?.kpis.posts_total ?? 0) > 0 ? "In window" : "Beta"}</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&q=80)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Impressions</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <Eye className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{payload ? formatIslandValue(payload.kpis.impressions_total) : "0"}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{(payload?.kpis.impressions_total ?? 0) > 0 ? "Total in window" : "Beta"}</span>
            </div>
          </div>
          <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80)" }}>
            <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
            <div className="relative z-10">
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium text-white">Engagement Rate</p>
                <div className="p-2 bg-white/20 rounded-lg">
                  <TrendingUp className="h-4 w-4 text-white stroke-[1.75]" />
                </div>
              </div>
              <h2 className="text-4xl font-bold text-white mb-1">{payload && payload.kpis.posts_total > 0 ? `${Number(payload.kpis.engagement_pct_avg).toFixed(2)}%` : "0%"}</h2>
              <span className="text-xs flex items-center gap-1 text-white">{(payload?.kpis.posts_total ?? 0) > 0 ? "Avg in window" : "Beta"}</span>
            </div>
          </div>
        </div>

        {/* Second row — same island style as first: 4 islands in 1 row */}
        {isLoading || !res ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-6 animate-pulse h-[140px]" />
            ))}
          </div>
        ) : payload ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1557683316-973673baf926?w=800&q=80)" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-foreground/80 transition-all duration-500 group-hover:from-primary/95 group-hover:to-foreground/90" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Potential Reach</p>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Eye className="h-4 w-4 text-white stroke-[1.75]" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-white mb-1">{formatIslandValue(payload.kpis.potential_reach)}</h2>
                <span className="text-xs flex items-center gap-1 text-white">
                  {deltaPct(payload.kpis.potential_reach, payload.kpis.prior_potential_reach) != null
                    ? `${deltaPct(payload.kpis.potential_reach, payload.kpis.prior_potential_reach)! >= 0 ? "+" : ""}${deltaPct(payload.kpis.potential_reach, payload.kpis.prior_potential_reach)!.toFixed(1)}% vs prior`
                    : "Total impressions"}
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1579546929518-9e396f3cc809?w=800&q=80)" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Engagements</p>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <Heart className="h-4 w-4 text-white stroke-[1.75]" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-white mb-1">{formatIslandValue(payload.kpis.engagements_total)}</h2>
                <span className="text-xs flex items-center gap-1 text-white">
                  {deltaPct(payload.kpis.engagements_total, payload.kpis.prior_engagements_total) != null
                    ? `${deltaPct(payload.kpis.engagements_total, payload.kpis.prior_engagements_total)! >= 0 ? "+" : ""}${deltaPct(payload.kpis.engagements_total, payload.kpis.prior_engagements_total)!.toFixed(1)}% vs prior`
                    : "Likes + replies + reposts + quotes"}
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1557683311-eac922347aa1?w=800&q=80)" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Avg Likes/Post</p>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <ThumbsUp className="h-4 w-4 text-white stroke-[1.75]" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-white mb-1">{payload.kpis.posts_total > 0 ? formatIslandValue(payload.kpis.avg_likes_per_post) : "0"}</h2>
                <span className="text-xs flex items-center gap-1 text-white">
                  {payload.kpis.prior_posts_total && payload.kpis.prior_posts_total > 0 && deltaPct(payload.kpis.avg_likes_per_post, payload.kpis.prior_avg_likes_per_post) != null
                    ? `${deltaPct(payload.kpis.avg_likes_per_post, payload.kpis.prior_avg_likes_per_post)! >= 0 ? "+" : ""}${deltaPct(payload.kpis.avg_likes_per_post, payload.kpis.prior_avg_likes_per_post)!.toFixed(1)}% vs prior`
                    : "Likes per post in window"}
                </span>
              </div>
            </div>
            <div className="relative overflow-hidden rounded-xl p-6 bg-cover bg-center border-0 h-full transition-all duration-500 hover:scale-[1.02] hover:shadow-xl hover:shadow-primary/10 cursor-pointer group border border-border bg-card" style={{ backgroundImage: "url(https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=800&q=80)" }}>
              <div className="absolute inset-0 bg-gradient-to-br from-primary/90 to-primary/70 transition-all duration-500 group-hover:from-primary/95 group-hover:to-primary/80" />
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <p className="text-sm font-medium text-white">Avg Comments/Post</p>
                  <div className="p-2 bg-white/20 rounded-lg">
                    <MessageCircle className="h-4 w-4 text-white stroke-[1.75]" />
                  </div>
                </div>
                <h2 className="text-4xl font-bold text-white mb-1">{payload.kpis.posts_total > 0 ? formatIslandValue(payload.kpis.avg_replies_per_post) : "0"}</h2>
                <span className="text-xs flex items-center gap-1 text-white">
                  {payload.kpis.prior_posts_total && payload.kpis.prior_posts_total > 0 && deltaPct(payload.kpis.avg_replies_per_post, payload.kpis.prior_avg_replies_per_post) != null
                    ? `${deltaPct(payload.kpis.avg_replies_per_post, payload.kpis.prior_avg_replies_per_post)! >= 0 ? "+" : ""}${deltaPct(payload.kpis.avg_replies_per_post, payload.kpis.prior_avg_replies_per_post)!.toFixed(1)}% vs prior`
                    : "Replies per post in window"}
                </span>
              </div>
            </div>
          </div>
        ) : null}

        {isLoading || !res ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton title="Engagement Rate" />
              <ChartSkeleton title="Posting Cadence" />
            </div>
            <ChartSkeleton title="Follower Growth" />
          </>
        ) : payload ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EngagementChart
                points={engagementPoints}
                coverageDays={activeDaysEngagement}
                windowDays={windowDays}
                tweetCountWindow={payload.kpis.posts_total}
                noPostsInPeriod={noPostsEngagement}
                insufficientForTrend={insufficientEngagement}
              />
              <PostingCadenceChart
                points={cadencePoints}
                tweetCountWindow={payload.kpis.posts_total}
                windowDays={windowDays}
                noPostsInPeriod={noPostsCadence}
                insufficientForTrend={insufficientCadence}
              />
            </div>
            <FollowerGrowthChart
              points={followerPoints}
              coverageDays={followerCoverageDays}
              windowDays={windowDays}
              insufficientData={followerInsufficient}
            />
          </>
        ) : null}

        {showDebug && payload && platform === "x" && (
          <details className="rounded-xl border border-border bg-card overflow-hidden">
            <summary className="px-4 py-3 text-sm font-medium cursor-pointer">Debug</summary>
            <div className="px-4 pb-4 pt-2 border-t border-border text-xs text-muted-foreground space-y-2 font-mono">
              <p>window_start: {payload.window_start}, window_end: {payload.window_end}</p>
              <p>follower_data_coverage_days: {payload.follower_data_coverage_days} / window_days: {payload.window_days}</p>
              {(() => {
                const vals = payload.chart_points.engagement_rate.map((p) => p.engagement_pct).filter(Number.isFinite);
                const minEr = vals.length ? Math.min(...vals).toFixed(2) : "—";
                const maxEr = vals.length ? Math.max(...vals).toFixed(2) : "—";
                return <p>engagement_pct min: {minEr}%, max: {maxEr}%</p>;
              })()}
              <p>First 5 engagement points: {JSON.stringify(payload.chart_points.engagement_rate.slice(0, 5))}</p>
              {payload.debug?.auth_mode != null && <p>auth_mode: {payload.debug.auth_mode}</p>}
            </div>
          </details>
        )}
          </>
        )}
      </div>
    </div>
  );
}
