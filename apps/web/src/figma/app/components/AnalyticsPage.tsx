"use client";

import React, { useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  KpiGrid,
  FollowerGrowthChart,
  EngagementChart,
  PostingCadenceChart,
  ChartSkeleton,
} from "@/figma/app/components/analytics";
import type { KpiCardData } from "@/figma/app/components/analytics";

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

export default function AnalyticsPage({ setRoute }: { setRoute?: (route: { name: string }) => void }) {
  const searchParams = useSearchParams();
  const showDebug = searchParams?.get("debug") === "1";
  const [windowParam, setWindowParam] = useState<WindowParam>("30d");
  const key = `/api/analytics/x?window=${windowParam}${showDebug ? "&debug=1" : ""}`;

  const { data: res, isLoading } = useSWR<ApiResponse>(key, analyticsFetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 30_000,
  });

  const payload = res?.ok === true ? res.data : null;

  const kpiCards: KpiCardData[] = useMemo(() => {
    if (!payload) return [];
    const { kpis } = payload;
    const badge: "Building" | "Active" = kpis.posts_total > 0 ? "Active" : "Building";
    return [
      {
        id: "posts",
        label: "Posts",
        value: String(kpis.posts_total),
        delta: null,
        helper: `In selected window`,
        badge,
      },
      {
        id: "impressions",
        label: "Impressions",
        value: kpis.impressions_total >= 1e6 ? `${(kpis.impressions_total / 1e6).toFixed(1)}M` : kpis.impressions_total >= 1e3 ? `${(kpis.impressions_total / 1e3).toFixed(1)}K` : String(kpis.impressions_total),
        delta: null,
        helper: "Total in window",
        badge,
      },
      {
        id: "engagements",
        label: "Engagements",
        value: kpis.engagements_total >= 1e6 ? `${(kpis.engagements_total / 1e6).toFixed(1)}M` : kpis.engagements_total >= 1e3 ? `${(kpis.engagements_total / 1e3).toFixed(1)}K` : String(kpis.engagements_total),
        delta: null,
        helper: "Likes + replies + reposts + quotes",
        badge,
      },
      {
        id: "engagement",
        label: "Engagement Rate",
        value: kpis.posts_total > 0 ? `${Number(kpis.engagement_pct_avg).toFixed(2)}%` : "—",
        delta: null,
        helper: "Avg in window",
        badge,
      },
    ];
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

  if (res?.ok === false) {
    return (
      <div className="min-h-screen bg-background" data-page="analytics">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-sm text-muted-foreground mb-2">{res.message}</p>
            <a
              href="/settings/integrations"
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
        <header className="rounded-xl border border-border bg-card py-2.5 px-4">
          <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
              {setRoute && (
                <a
                  href="/dashboard"
                  onClick={(e) => {
                    e.preventDefault();
                    setRoute({ name: "dashboard" });
                  }}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Back
                </a>
              )}
              <h1 className="text-base font-semibold text-foreground tracking-tight">Analytics</h1>
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

        {isLoading || !res ? (
          <>
            <KpiGrid cards={[]} loading />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton title="Engagement Rate" />
              <ChartSkeleton title="Posting Cadence" />
            </div>
            <ChartSkeleton title="Follower Growth" />
          </>
        ) : payload ? (
          <>
            <KpiGrid cards={kpiCards} />
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

        {showDebug && payload && (
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
      </div>
    </div>
  );
}
