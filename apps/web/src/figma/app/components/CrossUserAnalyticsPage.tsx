"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { BarChart2, ExternalLink, Lock, AlertCircle, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  CROSS_USER_ANALYTICS_EMPTY_BODY,
  CROSS_USER_ANALYTICS_EMPTY_TITLE,
  getOwnerFreshnessLine,
} from "@/lib/analytics-owner-state-presentation";
import { formatTryAgainAfter } from "@/lib/rateLimitUx";
import { PRICING_PATH, upgradeCtaLine } from "@/lib/planPackageUi";
import {
  FollowerGrowthChart,
  EngagementChart,
  PostingCadenceChart,
  ChartSkeleton,
} from "@/figma/app/components/analytics";

type Profile = { username: string; display_name: string | null; avatar_url: string | null };

type WindowAnalyticsPayload = {
  window_days: number;
  window_start: string;
  window_end: string;
  follower_data_coverage_days: number;
  follower_earliest_snapshot_date?: string | null;
  chart_points: {
    engagement_rate: Array<{
      date: string;
      engagement_pct: number;
      posts: number;
      is_estimated?: boolean;
      is_capped?: boolean;
    }>;
    posting_cadence: Array<{ date: string; posts: number }>;
    follower_growth: Array<{ date: string; follower_delta: number | null }>;
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
  freshness?: {
    has_x_handle: boolean;
    last_sync_at: string | null;
    data_state: "none" | "partial" | "full";
  };
};

function extractWindowAnalyticsPayload(w: unknown): WindowAnalyticsPayload | null {
  if (!w || typeof w !== "object") return null;
  const d = w as Record<string, unknown>;
  if (!d.kpis || typeof d.kpis !== "object") return null;
  if (!d.chart_points || typeof d.chart_points !== "object") return null;
  return d as WindowAnalyticsPayload;
}

type Status = "idle" | "loading" | "success" | "locked" | "unauthorized" | "rate_limited" | "not_found" | "error";

type WindowParam = "7d" | "30d" | "90d";

function normalizeCrossUserWindow(raw: string | null | undefined): WindowParam | null {
  const w = (raw ?? "").toLowerCase();
  if (w === "7d" || w === "30d" || w === "90d") return w;
  return null;
}

function windowParamToDaysCross(w: WindowParam): number {
  if (w === "7d") return 7;
  if (w === "90d") return 90;
  return 30;
}

export default function CrossUserAnalyticsPage({
  username: usernameProp,
  setRoute,
}: {
  username: string;
  setRoute?: (r: { name: string }) => void;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const username = (usernameProp ?? "").trim().replace(/^@/, "");
  const [status, setStatus] = useState<Status>("loading");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [windowPayloadRaw, setWindowPayloadRaw] = useState<unknown>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rateLimitResetAt, setRateLimitResetAt] = useState<string | null>(null);
  const [windowParam, setWindowParamState] = useState<WindowParam>(() => {
    if (typeof window === "undefined") return "30d";
    return normalizeCrossUserWindow(new URLSearchParams(window.location.search).get("window")) ?? "30d";
  });

  useEffect(() => {
    const fromUrl = normalizeCrossUserWindow(searchParams?.get("window"));
    if (fromUrl) setWindowParamState(fromUrl);
  }, [searchParams]);

  const commitCrossUserWindow = useCallback(
    (w: WindowParam) => {
      setWindowParamState(w);
      const path =
        pathname ??
        (username ? `/app/analytics/profile/${encodeURIComponent(username)}` : "/app/analytics");
      const params = new URLSearchParams(searchParams?.toString() ?? "");
      params.set("window", w);
      router.replace(`${path}?${params.toString()}`, { scroll: false });
    },
    [pathname, router, searchParams, username]
  );

  const fetchData = useCallback(async () => {
    if (!username) {
      setStatus("error");
      setErrorMessage("Username required");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setStatus("unauthorized");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setStatus("loading");
    setErrorMessage(null);
    const q = new URLSearchParams({ window: windowParam });
    const res = await fetch(
      `${base}/api/me/analytics/profile/${encodeURIComponent(username)}?${q.toString()}`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const json = await res.json().catch(() => ({}));

    if (res.status === 401) {
      setStatus("unauthorized");
      return;
    }
    if (res.status === 403 && (json?.code === "ANALYTICS_VIEW_NOT_ELIGIBLE" || json?.code === "DISCOVERY_NOT_ELIGIBLE")) {
      setStatus("locked");
      return;
    }
    if (res.status === 429 || json?.code === "RATE_LIMITED") {
      setRateLimitResetAt(typeof json?.resetAt === "string" ? json.resetAt : null);
      setStatus("rate_limited");
      return;
    }
    if (res.status === 404 || json?.code === "NOT_FOUND") {
      setStatus("not_found");
      return;
    }
    if (!res.ok) {
      setStatus("error");
      setErrorMessage(json?.message ?? "Something went wrong");
      return;
    }
    setStatus("success");
    setProfile(json?.profile ?? null);
    setWindowPayloadRaw(json?.window_analytics ?? null);
  }, [username, windowParam]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const payload = useMemo(() => extractWindowAnalyticsPayload(windowPayloadRaw), [windowPayloadRaw]);

  const engagementPoints = payload?.chart_points?.engagement_rate ?? [];
  const cadencePoints = payload?.chart_points?.posting_cadence ?? [];
  const followerPoints = payload?.chart_points?.follower_growth ?? [];
  const windowDays = payload?.window_days ?? 30;
  const followerCoverageDays = payload?.follower_data_coverage_days ?? 0;
  const followerEarliestDate = payload?.follower_earliest_snapshot_date ?? null;
  const activeDaysEngagement = engagementPoints.filter((p) => (p.posts ?? 0) > 0).length;
  const activeDaysCadence = cadencePoints.filter((p) => (p.posts ?? 0) > 0).length;
  const postsTotalInWindow = payload?.kpis?.posts_total ?? 0;
  const noPostsInWindow =
    !Number.isFinite(Number(postsTotalInWindow)) || Number(postsTotalInWindow) === 0;
  const noPostsEngagement = noPostsInWindow;
  const noPostsCadence = noPostsInWindow;
  const expectedWindowDays = windowParamToDaysCross(windowParam);
  const windowPayloadStale =
    payload != null && Number(payload.window_days) !== expectedWindowDays;
  const insufficientEngagement = false;
  const insufficientCadence = false;
  const followerInsufficient = false;

  const freshness = payload?.freshness;
  const hasXHandle = freshness?.has_x_handle ?? true;
  const lastSyncAt = freshness?.last_sync_at ?? null;
  const dataState = freshness?.data_state ?? "none";
  const freshnessLine = useMemo(
    () =>
      getOwnerFreshnessLine(
        { has_x_handle: hasXHandle, last_sync_at: lastSyncAt, data_state: dataState },
        "never_synced",
        { posts_total_in_window: payload?.kpis.posts_total ?? 0 }
      ),
    [hasXHandle, lastSyncAt, dataState, payload?.kpis.posts_total]
  );

  const goToPublicProfile = () => {
    if (!username) return;
    const slug = String(username).replace(/^@/, "");
    router.push(`/${encodeURIComponent(slug)}`);
  };

  if (!username) {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <p className="text-sm text-muted-foreground">Username is required.</p>
        </div>
      </div>
    );
  }

  if (status === "unauthorized") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Sign in required</h2>
          <p className="text-sm text-muted-foreground mt-2">Please sign in to view analytics.</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "login" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Other profiles&apos; analytics</h2>
          <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{upgradeCtaLine("cross_user_analytics")}</p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            <Link
              href={PRICING_PATH}
              className="inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              View packs
            </Link>
            {setRoute && (
              <button
                type="button"
                onClick={() => setRoute({ name: "analytics" })}
                className="inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground"
              >
                Back to Analytics
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === "rate_limited") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
          <h2 className="text-lg font-medium text-foreground">Too many requests</h2>
          <p className="text-sm text-muted-foreground mt-2">{formatTryAgainAfter(rateLimitResetAt)}</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "analytics" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground"
            >
              Back to Analytics
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "not_found") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-medium text-foreground">Profile not found</h2>
          <p className="text-sm text-muted-foreground mt-2">@{username} could not be found or is not published.</p>
          {setRoute && (
            <button
              type="button"
              onClick={() => setRoute({ name: "analytics" })}
              className="mt-4 inline-flex items-center justify-center rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground"
            >
              Back to Analytics
            </button>
          )}
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-2xl mx-auto p-6" data-page="cross-user-analytics">
        <div className="rounded-xl border border-border bg-card p-8 text-center">
          <AlertCircle className="h-12 w-12 mx-auto text-destructive mb-4" />
          <h2 className="text-lg font-medium text-foreground">Something went wrong</h2>
          <p className="text-sm text-muted-foreground mt-2">{errorMessage ?? "Please try again."}</p>
          <button
            type="button"
            onClick={() => void fetchData()}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  if (status === "loading") {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden" data-page="cross-user-analytics">
        <div className="max-w-7xl mx-auto px-3 min-[390px]:px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 sm:space-y-6">
          <div className="rounded-xl border border-border bg-card p-6 animate-pulse">
            <div className="flex gap-3">
              <div className="h-12 w-12 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-4 w-24 bg-muted rounded" />
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ChartSkeleton title="Engagement Rate" />
            <ChartSkeleton title="Posting Cadence" />
          </div>
          <ChartSkeleton title="Follower Growth" />
        </div>
      </div>
    );
  }

  const chartsMalformed = status === "success" && windowPayloadRaw != null && payload == null;

  if (chartsMalformed) {
    return (
      <div className="min-h-screen bg-background overflow-x-hidden" data-page="cross-user-analytics">
        <div className="max-w-7xl mx-auto px-3 min-[390px]:px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="rounded-xl border border-border bg-card p-6 text-center space-y-2">
            <p className="text-sm font-medium text-foreground">Analytics data incomplete</p>
            <p className="text-sm text-muted-foreground">
              The server returned an unexpected shape. Try reloading; if it persists, check the Network tab for{" "}
              <code className="text-xs bg-muted px-1 rounded">/api/me/analytics/profile/…</code>.
            </p>
            <button
              type="button"
              onClick={() => void fetchData()}
              className="mt-2 inline-flex items-center justify-center px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90"
            >
              Retry
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background overflow-x-hidden" data-page="cross-user-analytics">
      <div className="max-w-7xl mx-auto px-3 min-[390px]:px-4 sm:px-6 lg:px-8 py-4 sm:py-5 space-y-4 sm:space-y-6">
        <header className="rounded-xl border border-border bg-card/80 backdrop-blur-sm shadow-sm">
          <div className="px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 min-w-0">
              <div className="flex items-center gap-3 min-w-0">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-10 w-10 rounded-full object-cover shrink-0" />
                ) : (
                  <div className="h-10 w-10 rounded-full bg-muted shrink-0 flex items-center justify-center">
                    <BarChart2 className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <div className="min-w-0">
                  <h1 className="text-base font-semibold text-foreground truncate">
                    {profile?.display_name || profile?.username || `@${username}`}
                  </h1>
                  <p className="text-sm text-muted-foreground truncate">@{profile?.username ?? username}</p>
                </div>
              </div>
              {payload && freshnessLine ? (
                <span className="text-xs text-muted-foreground block sm:inline w-full sm:w-auto" aria-live="polite">
                  · {freshnessLine}
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={goToPublicProfile}
                className="inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent"
              >
                <ExternalLink className="h-4 w-4" /> Public profile
              </button>
              {setRoute && (
                <button
                  type="button"
                  onClick={() => setRoute({ name: "analytics" })}
                  className="text-sm text-muted-foreground hover:text-foreground px-2"
                >
                  My analytics
                </button>
              )}
              <div className="inline-flex rounded-lg border border-border bg-muted/40 p-0.5" role="group" aria-label="Time window">
                {(["7d", "30d", "90d"] as const).map((w) => (
                  <button
                    key={w}
                    type="button"
                    onClick={() => commitCrossUserWindow(w)}
                    className={`px-3 py-1.5 rounded-md text-xs font-medium tabular-nums transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary ${
                      windowParam === w ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </header>

        {!payload ? (
          <div className="rounded-xl border border-dashed border-border bg-muted/20 p-8 text-center">
            <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground/60 mb-3" />
            <p className="text-sm font-medium text-foreground">{CROSS_USER_ANALYTICS_EMPTY_TITLE}</p>
            <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">{CROSS_USER_ANALYTICS_EMPTY_BODY}</p>
            <button
              type="button"
              onClick={goToPublicProfile}
              className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border bg-secondary px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
            >
              <ExternalLink className="h-4 w-4" /> View public profile
            </button>
          </div>
        ) : windowPayloadStale ? (
          <div className="space-y-4 sm:space-y-6" data-page="analytics">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartSkeleton title="Engagement Rate" />
              <ChartSkeleton title="Posting Cadence" />
            </div>
            <ChartSkeleton title="Follower Growth" />
          </div>
        ) : (
          <div data-page="analytics" className="space-y-4 sm:space-y-6">
            <p className="text-xs text-muted-foreground -mt-1 mb-2 max-w-3xl">
              The <span className="tabular-nums">7d</span> / <span className="tabular-nums">30d</span> /{" "}
              <span className="tabular-nums">90d</span> control applies to every chart below. Each day is one bucket; series are built from{" "}
              <code className="text-[10px] bg-muted px-1 rounded">x_tweets</code> (engagement &amp; cadence) and{" "}
              <code className="text-[10px] bg-muted px-1 rounded">x_daily_snapshots</code> (followers), written by sync and backfill jobs.
            </p>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <EngagementChart
                points={engagementPoints}
                coverageDays={activeDaysEngagement}
                windowDays={windowDays}
                tweetCountWindow={payload.kpis.posts_total}
                noPostsInPeriod={noPostsEngagement}
                insufficientForTrend={insufficientEngagement}
                bucketLabel="Daily"
              />
              <PostingCadenceChart
                points={cadencePoints}
                activePostingDays={activeDaysCadence}
                tweetCountWindow={payload.kpis.posts_total}
                windowDays={windowDays}
                noPostsInPeriod={noPostsCadence}
                insufficientForTrend={insufficientCadence}
                bucketLabel="Daily"
              />
            </div>
            <FollowerGrowthChart
              points={followerPoints}
              coverageDays={followerCoverageDays}
              windowDays={windowDays}
              earliestDate={followerEarliestDate}
              insufficientData={followerInsufficient}
              bucketLabel="Daily"
            />
            <p className="text-xs text-muted-foreground">
              Only approved analytics are shown. No private data, pricing, or contact info.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
