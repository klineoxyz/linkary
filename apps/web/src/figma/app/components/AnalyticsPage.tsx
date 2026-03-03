"use client";

import React, { useState, useEffect, useRef, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { authFetcher, SWR_DEDUP_MS } from "@/lib/swrAuthFetcher";
import {
  AnalyticsHeader,
  KpiGrid,
  FollowerGrowthChart,
  EngagementChart,
  PostingCadenceChart,
  TopDriversTable,
  ChartSkeleton,
  aggregateFollowerGrowthToWeekly,
  aggregateEngagementToWeekly,
  aggregatePostingCadenceToWeekly,
} from "@/figma/app/components/analytics";
import type {
  WindowPeriod,
  XAnalyticsData,
  KpiCardData,
  KpiDelta,
  TopDriverRow,
} from "@/figma/app/components/analytics";

type SnapshotPoint = {
  snapshot_date: string;
  followers_total: number | null;
  tweets_count?: number | null;
  likes_received?: number | null;
  engagement_rate?: number | null;
};

type RebuildJob = { id: string; status: string; updated_at?: string; last_error?: string | null };
type InitStatus = {
  ok: boolean;
  initialized: boolean;
  has90dAggregate: boolean;
  hasTodaySnapshot: boolean;
  snapshotDays: number;
  job: { status: string; attempts: number; last_error: string | null; run_after: string | null } | null;
} | null;

export default function AnalyticsPage({ setRoute }: { setRoute?: (route: { name: string }) => void }) {
  const [timePeriod, setTimePeriod] = useState<WindowPeriod>("30D");
  const [xAnalyticsData, setXAnalyticsData] = useState<XAnalyticsData | null>(null);
  const [windowSummary, setWindowSummary] = useState<{ windows: Record<string, Record<string, unknown> | null>; is_backfilling: boolean } | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>(null);
  const [retryingBackfill, setRetryingBackfill] = useState(false);
  const [rebuildJob, setRebuildJob] = useState<RebuildJob | null>(null);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [rebuildQueuedToast, setRebuildQueuedToast] = useState(false);
  const searchParams = useSearchParams();
  const showDebugPanel = searchParams?.get("debug") === "1";
  const rebuildPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollupUpdatedAtBeforeRebuildRef = useRef<string | null>(null);
  const initialSyncTriggered = useRef(false);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const swrOpts = { revalidateOnFocus: false, dedupingInterval: SWR_DEDUP_MS };
  const windowParam = timePeriod === "7D" ? "7d" : timePeriod === "30D" ? "30d" : "90d";
  const analyticsXKey = `/api/analytics/x?window=${windowParam}${showDebugPanel ? "&debug=1" : ""}`;
  const analyticsSwrOpts = { revalidateOnFocus: true, dedupingInterval: 30_000, refreshInterval: 90_000 };

  const { data: initSwr, mutate: mutateInit } = useSWR<InitStatus>(
    "/api/analytics/init-status",
    authFetcher as (url: string) => Promise<InitStatus>,
    swrOpts
  );
  const { data: xSwr, error: xError, isLoading: xLoading, mutate: mutateX } = useSWR<Record<string, unknown>>(
    analyticsXKey,
    authFetcher as (url: string) => Promise<Record<string, unknown>>,
    analyticsSwrOpts
  );
  const { data: summarySwr, mutate: mutateSummary } = useSWR<{ windows?: Record<string, Record<string, unknown> | null>; is_backfilling?: boolean }>(
    "/api/analytics/x/summary",
    authFetcher as (url: string) => Promise<{ windows?: Record<string, Record<string, unknown> | null>; is_backfilling?: boolean }>,
    analyticsSwrOpts
  );

  useEffect(() => {
    if (initSwr) setInitStatus(initSwr);
  }, [initSwr]);
  useEffect(() => {
    if (xSwr && typeof xSwr === "object") {
      setXAnalyticsData({
        profile: (xSwr.profile as XAnalyticsData["profile"]) ?? {},
        rollup: (xSwr.rollup as XAnalyticsData["rollup"]) ?? null,
        topDrivers: Array.isArray(xSwr.topDrivers) ? (xSwr.topDrivers as XAnalyticsData["topDrivers"]) : [],
        baseline: (xSwr.baseline as XAnalyticsData["baseline"]) ?? null,
        snapshots: Array.isArray(xSwr.snapshots) ? (xSwr.snapshots as SnapshotPoint[]) : [],
        source: (xSwr.source as XAnalyticsData["source"]) ?? "fallback",
        freshness: xSwr.freshness as XAnalyticsData["freshness"],
        data_status: (xSwr.data_status as XAnalyticsData["data_status"]) ?? null,
        chart_points: (xSwr.chart_points as XAnalyticsData["chart_points"]) ?? null,
        tweets_last_synced_at: typeof xSwr.tweets_last_synced_at === "string" ? xSwr.tweets_last_synced_at : undefined,
        follower_last_synced_at: typeof xSwr.follower_last_synced_at === "string" ? xSwr.follower_last_synced_at : undefined,
        follower_data_stale: xSwr.follower_data_stale === true,
        potential_reach_label: typeof xSwr.potential_reach_label === "string" ? xSwr.potential_reach_label : undefined,
        potential_reach_is_estimated: xSwr.potential_reach_is_estimated === true,
        engagement_rate_is_estimated: xSwr.engagement_rate_is_estimated === true,
        tweet_count_window: typeof xSwr.tweet_count_window === "number" ? xSwr.tweet_count_window : undefined,
        follower_data_coverage_days: typeof xSwr.follower_data_coverage_days === "number" ? xSwr.follower_data_coverage_days : undefined,
        follower_earliest_snapshot_date: typeof xSwr.follower_earliest_snapshot_date === "string" ? xSwr.follower_earliest_snapshot_date : undefined,
        follower_first_day: typeof (xSwr as Record<string, unknown>).follower_first_day === "string" ? (xSwr as Record<string, unknown>).follower_first_day as string : undefined,
        follower_window_days: typeof xSwr.follower_window_days === "number" ? xSwr.follower_window_days : undefined,
        snapshot_days_in_window: typeof (xSwr as Record<string, unknown>).snapshot_days_in_window === "number" ? (xSwr as Record<string, unknown>).snapshot_days_in_window as number : undefined,
        engagement_data_coverage_days: typeof xSwr.engagement_data_coverage_days === "number" ? xSwr.engagement_data_coverage_days : undefined,
        engagement_rate_pct: typeof (xSwr as Record<string, unknown>).engagement_rate_pct === "number" ? (xSwr as Record<string, unknown>).engagement_rate_pct as number : undefined,
        window_days: typeof (xSwr as Record<string, unknown>).window_days === "number" ? (xSwr as Record<string, unknown>).window_days as number : undefined,
        debug: xSwr.debug as XAnalyticsData["debug"],
        diagnostics: xSwr.diagnostics as XAnalyticsData["diagnostics"],
      });
    }
  }, [xSwr]);
  useEffect(() => {
    if (summarySwr && typeof summarySwr === "object") {
      setWindowSummary({ windows: summarySwr.windows ?? {}, is_backfilling: !!summarySwr.is_backfilling });
    }
  }, [summarySwr]);

  const fetchInitStatus = React.useCallback(async () => {
    await mutateInit();
  }, [mutateInit]);

  const fetchXAnalytics = React.useCallback(async () => {
    await mutateX();
  }, [mutateX]);

  const handleRetryBackfill = React.useCallback(async () => {
    setRetryingBackfill(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      const res = await fetch(`${base}/api/analytics/backfill-90`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) await fetchInitStatus();
    }
    setRetryingBackfill(false);
  }, [base, fetchInitStatus]);

  const triggerRebuild = React.useCallback(async (currentRollupUpdatedAt?: string | null) => {
    setRebuildError(null);
    setRebuildLoading(true);
    rollupUpdatedAtBeforeRebuildRef.current = currentRollupUpdatedAt ?? null;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setRebuildLoading(false);
      return;
    }
    try {
      const res = await fetch(`${base}/api/analytics/x/rebuild`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        setRebuildError(json.message ?? "Failed to start rebuild");
        setRebuildLoading(false);
        return;
      }
      const jobPayload = json.job;
      if (jobPayload) {
        setRebuildJob({
          id: jobPayload.id,
          status: jobPayload.status,
          updated_at: jobPayload.created_at,
          last_error: null,
        });
        setRebuildQueuedToast(true);
      }
    } catch (e) {
      setRebuildError(e instanceof Error ? e.message : "Request failed");
      setRebuildLoading(false);
      return;
    }
    setRebuildLoading(false);
  }, [base]);

  useEffect(() => {
    if (!rebuildJob || (rebuildJob.status !== "queued" && rebuildJob.status !== "running")) return;
    const poll = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${base}/api/analytics/x/job`, { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json().catch(() => ({}));
      const job = json.job;
      if (job) {
        setRebuildJob({
          id: job.id,
          status: job.status,
          updated_at: job.updated_at,
          last_error: job.last_error ?? null,
        });
        if (job.status === "done") {
          if (rebuildPollRef.current) {
            clearInterval(rebuildPollRef.current);
            rebuildPollRef.current = null;
          }
          fetchXAnalytics();
          mutateSummary();
        }
        if (job.status === "failed") {
          if (rebuildPollRef.current) {
            clearInterval(rebuildPollRef.current);
            rebuildPollRef.current = null;
          }
        }
      }
    };
    rebuildPollRef.current = setInterval(poll, 5000);
    poll();
    return () => {
      if (rebuildPollRef.current) {
        clearInterval(rebuildPollRef.current);
        rebuildPollRef.current = null;
      }
    };
  }, [base, rebuildJob?.id, rebuildJob?.status, fetchXAnalytics, mutateSummary]);

  useEffect(() => {
    if (!rebuildJob || (rebuildJob.status !== "queued" && rebuildJob.status !== "running")) return;
    let iterations = 0;
    const MAX_ITERATIONS = 8;
    const pollRollup = async () => {
      iterations += 1;
      try {
        const body = await (authFetcher as (url: string) => Promise<Record<string, unknown>>)(analyticsXKey);
        const next = (body?.data_status as { rollup_updated_at?: string | null } | undefined)?.rollup_updated_at ?? null;
        if (next !== rollupUpdatedAtBeforeRebuildRef.current || iterations >= MAX_ITERATIONS) {
          if (rollupPollRef.current) {
            clearInterval(rollupPollRef.current);
            rollupPollRef.current = null;
          }
          await mutateX();
          await mutateSummary();
          setRebuildQueuedToast(false);
        }
      } catch {
        if (iterations >= MAX_ITERATIONS && rollupPollRef.current) {
          clearInterval(rollupPollRef.current);
          rollupPollRef.current = null;
        }
      }
    };
    rollupPollRef.current = setInterval(pollRollup, 15_000);
    pollRollup();
    return () => {
      if (rollupPollRef.current) {
        clearInterval(rollupPollRef.current);
        rollupPollRef.current = null;
      }
    };
  }, [rebuildJob?.id, rebuildJob?.status, analyticsXKey, mutateX, mutateSummary]);

  useEffect(() => {
    if (!xAnalyticsData || initialSyncTriggered.current) return;
    const profile = xAnalyticsData.profile ?? {};
    const hasXHandle = (profile.twitter_username ?? "").toString().trim().replace(/^@/, "").length > 0;
    const neverSynced = !profile.x_last_profile_sync_at;
    const noBaseline = !xAnalyticsData.baseline;
    if (!hasXHandle || (!neverSynced && !noBaseline)) return;
    initialSyncTriggered.current = true;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      const res = await fetch(`${base}/api/x-sync`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) await fetchXAnalytics();
    })();
  }, [xAnalyticsData, fetchXAnalytics]);

  const profile = xAnalyticsData?.profile ?? {};
  const rollup = xAnalyticsData?.rollup;
  const baseline = xAnalyticsData?.baseline ?? null;
  const dataStatus = xAnalyticsData?.data_status ?? null;
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  const bNum = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  const followersTotal = typeof profile.followers_total === "number" ? profile.followers_total : 0;
  const profileEngagementRate = typeof profile.avg_engagement_rate === "number" ? profile.avg_engagement_rate : 0;

  const posts7d = rollup ? num(rollup.posts_7d) : 0;
  const posts30d = rollup ? num(rollup.posts_30d) : 0;
  const posts90d = rollup ? num(rollup.posts_90d) : 0;
  const avgLikes7d = rollup ? num(rollup.avg_likes_7d) : 0;
  const avgLikes30d = rollup ? num(rollup.avg_likes_30d) : 0;
  const avgLikes90d = rollup ? num(rollup.avg_likes_90d) : 0;
  const avgReplies7d = rollup ? num(rollup.avg_replies_7d) : 0;
  const avgReplies30d = rollup ? num(rollup.avg_replies_30d) : 0;
  const avgReplies90d = rollup ? num(rollup.avg_replies_90d) : 0;
  const engagementRate7d = rollup ? num(rollup.engagement_rate_7d) : profileEngagementRate;
  const engagementRate30d = rollup ? num(rollup.engagement_rate_30d) : profileEngagementRate;
  const engagementRate90d = rollup ? num(rollup.engagement_rate_90d) : profileEngagementRate;
  const reachProxy7d = rollup ? num(rollup.reach_proxy_7d) : 0;
  const reachProxy30d = rollup ? num(rollup.reach_proxy_30d) : 0;
  const reachProxy90d = rollup ? num(rollup.reach_proxy_90d) : 0;

  const postsByPeriod = timePeriod === "7D" ? posts7d : timePeriod === "30D" ? posts30d : posts90d;
  const avgLikesByPeriod = timePeriod === "7D" ? avgLikes7d : timePeriod === "30D" ? avgLikes30d : avgLikes90d;
  const avgRepliesByPeriod = timePeriod === "7D" ? avgReplies7d : timePeriod === "30D" ? avgReplies30d : avgReplies90d;
  const engagementRateByPeriod = timePeriod === "7D" ? engagementRate7d : timePeriod === "30D" ? engagementRate30d : engagementRate90d;
  const reachProxyByPeriod = timePeriod === "7D" ? reachProxy7d : timePeriod === "30D" ? reachProxy30d : reachProxy90d;
  const periodLabel = timePeriod === "7D" ? "7D" : timePeriod === "30D" ? "30D" : "90D";

  const snapshots = (xAnalyticsData?.snapshots ?? []).filter((s) => s.snapshot_date);
  const snapshotsAsc = useMemo(() => [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date)), [snapshots]);
  const getSnapshotAt = (daysAgo: number): number | null => {
    const target = new Date();
    target.setDate(target.getDate() - daysAgo);
    const targetStr = target.toISOString().slice(0, 10);
    const candidates = snapshotsAsc.filter(
      (s) => s.snapshot_date <= targetStr && s.followers_total != null && Number.isFinite(Number(s.followers_total))
    );
    const last = candidates.length ? candidates[candidates.length - 1] : null;
    return last ? Number(last.followers_total) : null;
  };
  const snapshotsWithFollowers = snapshotsAsc.filter((s) => s.followers_total != null && Number.isFinite(Number(s.followers_total)));
  const latestFollowerCount = snapshotsWithFollowers.length
    ? Number(snapshotsWithFollowers[snapshotsWithFollowers.length - 1].followers_total)
    : followersTotal;
  const pctDelta = (current: number, past: number | null): number | null => {
    if (past == null || past === 0 || !Number.isFinite(current)) return null;
    return ((current - past) / past) * 100;
  };
  const win7 = windowSummary?.windows?.["7"] as Record<string, unknown> | undefined;
  const win30 = windowSummary?.windows?.["30"] as Record<string, unknown> | undefined;
  const win90 = windowSummary?.windows?.["90"] as Record<string, unknown> | undefined;
  const pctFromWindow = (w: Record<string, unknown> | undefined): number | null => {
    if (!w || w.followers_delta == null || w.followers_start == null) return null;
    const start = Number(w.followers_start);
    const delta = Number(w.followers_delta);
    if (start === 0 || !Number.isFinite(start)) return null;
    return (delta / start) * 100;
  };
  const realDelta7 = pctDelta(latestFollowerCount, getSnapshotAt(7));
  const realDelta30 = pctDelta(latestFollowerCount, getSnapshotAt(30));
  const realDelta90 = pctDelta(latestFollowerCount, getSnapshotAt(90));
  const useWindowAggregates = win7 || win30 || win90;
  const followersDelta7 = useWindowAggregates ? (pctFromWindow(win7) ?? realDelta7) : realDelta7;
  const followersDelta30 = useWindowAggregates ? (pctFromWindow(win30) ?? realDelta30) : realDelta30;
  const followersDelta90 = useWindowAggregates ? (pctFromWindow(win90) ?? realDelta90) : realDelta90;
  const hasRealFollowerHistory = snapshots.length >= 2;

  const baselineFollowers = baseline ? bNum(baseline.followers_total) : 0;
  const baselineEngagement = baseline ? bNum(baseline.engagement_rate_proxy) : 0;
  const baselinePosts30 = baseline ? bNum(baseline.posts_30d) : 0;
  const baselineLikes30 = baseline ? bNum(baseline.avg_likes_30d) : 0;
  const baselineReplies30 = baseline ? bNum(baseline.avg_replies_30d) : 0;
  const baselineReach30 = baseline ? bNum(baseline.reach_proxy_30d) : 0;
  const pctVsBase = (current: number, base: number | null): KpiDelta => {
    if (base == null || base === 0 || !Number.isFinite(current)) return null;
    return ((current - base) / base) * 100;
  };

  const followersDeltaForPeriod: KpiDelta = timePeriod === "7D" ? (hasRealFollowerHistory || useWindowAggregates ? followersDelta7 : null) : timePeriod === "30D" ? (hasRealFollowerHistory || useWindowAggregates ? followersDelta30 : null) : (hasRealFollowerHistory || useWindowAggregates ? followersDelta90 : null);
  const engagementDelta7 = baselineEngagement > 0 ? pctVsBase(engagementRate7d, baselineEngagement) : null;
  const engagementDelta30 = baselineEngagement > 0 ? pctVsBase(engagementRate30d, baselineEngagement) : null;
  const engagementDelta90 = baselineEngagement > 0 ? pctVsBase(engagementRate90d, baselineEngagement) : null;
  const likesDelta7 = baselineLikes30 > 0 ? pctVsBase(avgLikes7d, baselineLikes30) : null;
  const likesDelta30 = baselineLikes30 > 0 ? pctVsBase(avgLikes30d, baselineLikes30) : null;
  const likesDelta90 = baselineLikes30 > 0 ? pctVsBase(avgLikes90d, baselineLikes30) : null;
  const repliesDelta7 = baselineReplies30 > 0 ? pctVsBase(avgReplies7d, baselineReplies30) : null;
  const repliesDelta30 = baselineReplies30 > 0 ? pctVsBase(avgReplies30d, baselineReplies30) : null;
  const repliesDelta90 = baselineReplies30 > 0 ? pctVsBase(avgReplies90d, baselineReplies30) : null;
  const postsDelta7 = baselinePosts30 > 0 ? pctVsBase(posts7d, baselinePosts30) : null;
  const postsDelta30 = baselinePosts30 > 0 ? pctVsBase(posts30d, baselinePosts30) : null;
  const postsDelta90 = baselinePosts30 > 0 ? pctVsBase(posts90d, baselinePosts30) : null;
  const reachDelta7 = baselineReach30 > 0 ? pctVsBase(reachProxy7d, baselineReach30) : null;
  const reachDelta30 = baselineReach30 > 0 ? pctVsBase(reachProxy30d, baselineReach30) : null;
  const reachDelta90 = baselineReach30 > 0 ? pctVsBase(reachProxy90d, baselineReach30) : null;

  const engagementDeltaForPeriod: KpiDelta = timePeriod === "7D" ? engagementDelta7 : timePeriod === "30D" ? engagementDelta30 : engagementDelta90;
  const likesDeltaForPeriod: KpiDelta = timePeriod === "7D" ? likesDelta7 : timePeriod === "30D" ? likesDelta30 : likesDelta90;
  const repliesDeltaForPeriod: KpiDelta = timePeriod === "7D" ? repliesDelta7 : timePeriod === "30D" ? repliesDelta30 : repliesDelta90;
  const postsDeltaForPeriod: KpiDelta = timePeriod === "7D" ? postsDelta7 : timePeriod === "30D" ? postsDelta30 : postsDelta90;
  const reachDeltaForPeriod: KpiDelta = timePeriod === "7D" ? reachDelta7 : timePeriod === "30D" ? reachDelta30 : reachDelta90;

  const hasRollup = !!rollup;
  const noPostsInWindow = postsByPeriod === 0;
  const kpiCards: KpiCardData[] = useMemo(() => {
    const badge = (delta: KpiDelta, hasData: boolean) => (delta !== null && hasData ? "Active" : "Building");
    const helperDeltaNeedsPrior = "Delta needs prior period.";
    const helperNoPosts = "No posts in this window.";
    return [
      {
        id: "followers",
        label: "Followers",
        value: xAnalyticsData ? followersTotal.toLocaleString() : "—",
        delta: followersDeltaForPeriod,
        helper: followersDeltaForPeriod === null ? "Need prior period." : hasRealFollowerHistory ? "From X profile sync" : "Sync from Integrations to see trends",
        badge: badge(followersDeltaForPeriod, !!(hasRealFollowerHistory || useWindowAggregates)),
      },
      {
        id: "engagement",
        label: "Engagement Rate",
        value: noPostsInWindow || !xAnalyticsData ? "—" : `${Number(engagementRateByPeriod).toFixed(2)}%`,
        delta: engagementDeltaForPeriod,
        helper: noPostsInWindow ? helperNoPosts : (engagementDeltaForPeriod === null ? helperDeltaNeedsPrior : hasRollup ? "Window aggregate for selected period" : "Sync from Integrations to see trends"),
        badge: noPostsInWindow ? "Building" : badge(engagementDeltaForPeriod, !!hasRollup),
        estimated: !noPostsInWindow && xAnalyticsData?.engagement_rate_is_estimated === true,
      },
      {
        id: "likes",
        label: "Avg Likes/Post",
        value: noPostsInWindow || !xAnalyticsData ? "—" : String(Math.round(avgLikesByPeriod)),
        delta: likesDeltaForPeriod,
        helper: noPostsInWindow ? helperNoPosts : (likesDeltaForPeriod === null ? helperDeltaNeedsPrior : hasRollup ? "From rollup for selected period" : "Sync from Integrations to see trends"),
        badge: noPostsInWindow ? "Building" : badge(likesDeltaForPeriod, !!hasRollup),
      },
      {
        id: "replies",
        label: "Avg Replies/Post",
        value: noPostsInWindow || !xAnalyticsData ? "—" : String(Math.round(avgRepliesByPeriod)),
        delta: repliesDeltaForPeriod,
        helper: noPostsInWindow ? helperNoPosts : (repliesDeltaForPeriod === null ? helperDeltaNeedsPrior : hasRollup ? "From rollup for selected period" : "Sync from Integrations to see trends"),
        badge: noPostsInWindow ? "Building" : badge(repliesDeltaForPeriod, !!hasRollup),
      },
      {
        id: "posts",
        label: `Posts (${periodLabel})`,
        value: !xAnalyticsData ? "—" : String(postsByPeriod),
        delta: postsDeltaForPeriod,
        helper: noPostsInWindow ? helperNoPosts : (postsDeltaForPeriod === null ? helperDeltaNeedsPrior : hasRollup ? "From rollup for selected period" : "Sync from Integrations to see trends"),
        badge: noPostsInWindow ? "Building" : badge(postsDeltaForPeriod, !!hasRollup),
      },
      {
        id: "reach",
        label: "Potential Reach",
        value: noPostsInWindow || !xAnalyticsData
          ? "—"
          : (reachProxyByPeriod >= 1e6 ? `${(reachProxyByPeriod / 1e6).toFixed(1)}M` : reachProxyByPeriod >= 1e3 ? `${(reachProxyByPeriod / 1e3).toFixed(1)}K` : String(Math.round(reachProxyByPeriod))),
        delta: reachDeltaForPeriod,
        helper: noPostsInWindow ? helperNoPosts : (reachDeltaForPeriod === null ? helperDeltaNeedsPrior : hasRollup ? "Impressions or estimated for window" : "Sync from Integrations to see trends"),
        badge: noPostsInWindow ? "Building" : badge(reachDeltaForPeriod, !!hasRollup),
        estimated: !noPostsInWindow && xAnalyticsData?.potential_reach_is_estimated === true,
      },
    ];
  }, [
    xAnalyticsData,
    noPostsInWindow,
    followersTotal,
    followersDeltaForPeriod,
    hasRealFollowerHistory,
    useWindowAggregates,
    engagementRateByPeriod,
    engagementDeltaForPeriod,
    hasRollup,
    avgLikesByPeriod,
    likesDeltaForPeriod,
    avgRepliesByPeriod,
    repliesDeltaForPeriod,
    periodLabel,
    postsByPeriod,
    postsDeltaForPeriod,
    reachProxyByPeriod,
    reachDeltaForPeriod,
  ]);

  const chartPoints = xAnalyticsData?.chart_points ?? null;
  const periodDays = timePeriod === "7D" ? 7 : timePeriod === "30D" ? 30 : 90;
  const useWeeklyForCharts = periodDays === 90;
  const followerGrowthPoints = useMemo(() => {
    const raw = chartPoints?.follower_growth ?? [];
    return useWeeklyForCharts ? aggregateFollowerGrowthToWeekly(raw) : raw;
  }, [chartPoints?.follower_growth, useWeeklyForCharts]);
  const engagementRatePoints = useMemo(() => {
    const raw = chartPoints?.engagement_rate ?? [];
    return useWeeklyForCharts ? aggregateEngagementToWeekly(raw) : raw;
  }, [chartPoints?.engagement_rate, useWeeklyForCharts]);
  const postingCadencePoints = useMemo(() => {
    const raw = chartPoints?.posting_cadence ?? [];
    return useWeeklyForCharts ? aggregatePostingCadenceToWeekly(raw) : raw;
  }, [chartPoints?.posting_cadence, useWeeklyForCharts]);
  const followerCoverageDays = typeof xAnalyticsData?.follower_data_coverage_days === "number" ? xAnalyticsData.follower_data_coverage_days : 0;
  const followerInsufficient = followerGrowthPoints.length < 3;

  const rawTop = xAnalyticsData?.topDrivers ?? [];
  const topDriversRows: TopDriverRow[] = useMemo(() => {
    const byTweetId = new Map<string, (typeof rawTop)[0]>();
    for (const t of rawTop) {
      if (t?.tweet_id && !byTweetId.has(t.tweet_id)) byTweetId.set(t.tweet_id, t);
    }
    return Array.from(byTweetId.entries()).map(([tweet_id, t]) => {
      const engagementScore = Number(t.engagement_score) || 0;
      const erPct = followersTotal > 0 ? (engagementScore / followersTotal) * 100 : 0;
      return {
        tweet_id,
        date: t.tweeted_at ? new Date(t.tweeted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
        time: t.tweeted_at ? new Date(t.tweeted_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : undefined,
        likes: t.like_count ?? 0,
        replies: t.reply_count ?? 0,
        reposts: t.repost_count ?? 0,
        engagementRate: Math.min(100, Math.round(erPct * 10) / 10),
        engagementOver100: erPct > 100,
      };
    });
  }, [rawTop, followersTotal]);

  const bucketLabel: "Daily" | "Weekly" = periodDays === 90 ? "Weekly" : "Daily";

  const signalsList = useMemo(() => {
    const list: Array<{ id: string; title: string; metric: string }> = [];
    if (xAnalyticsData && postsByPeriod > 0 && periodDays > 0) {
      const perDay = (postsByPeriod / periodDays).toFixed(1);
      const perWeek = periodDays >= 7 ? (postsByPeriod / (periodDays / 7)).toFixed(1) : null;
      list.push({
        id: "cadence",
        title: "Posts in window",
        metric: `${postsByPeriod} posts · ${perDay}/day${perWeek ? ` · ${perWeek}/week` : ""}.`,
      });
    }
    if (xAnalyticsData && !noPostsInWindow && typeof engagementRateByPeriod === "number" && Number.isFinite(engagementRateByPeriod)) {
      list.push({
        id: "engagement",
        title: "Engagement rate",
        metric: `${Number(engagementRateByPeriod).toFixed(2)}% in ${periodLabel}${xAnalyticsData?.engagement_rate_is_estimated ? " (est.)" : ""}.`,
      });
    }
    if (xAnalyticsData && !noPostsInWindow && engagementDeltaForPeriod !== null && Number.isFinite(engagementDeltaForPeriod)) {
      const dir = engagementDeltaForPeriod >= 0 ? "up" : "down";
      list.push({
        id: "er-trend",
        title: "ER vs prior period",
        metric: `${dir} ${Math.abs(engagementDeltaForPeriod).toFixed(0)}%.`,
      });
    }
    const best = topDriversRows.length > 0 ? topDriversRows.reduce((a, b) => (b.engagementRate > a.engagementRate ? b : a), topDriversRows[0]) : null;
    if (best && best.engagementRate > 0) {
      list.push({
        id: "best-er",
        title: "Best post ER",
        metric: best.engagementOver100 ? "100%+." : `${best.engagementRate}%.`,
      });
    }
    const snapDays = xAnalyticsData?.follower_data_coverage_days ?? xAnalyticsData?.snapshot_days_in_window;
    const windowDaysVal = xAnalyticsData?.follower_window_days ?? periodDays;
    if (xAnalyticsData && typeof snapDays === "number" && snapDays > 0 && typeof windowDaysVal === "number") {
      list.push({
        id: "follower-growth",
        title: "Follower snapshot coverage",
        metric: `${snapDays}/${windowDaysVal}d (days with follower data).`,
      });
    }
    if (followersDeltaForPeriod !== null && Number.isFinite(followersDeltaForPeriod)) {
      const dir = followersDeltaForPeriod >= 0 ? "up" : "down";
      list.push({
        id: "follower-delta",
        title: "Follower trend",
        metric: `${dir} ${Math.abs(followersDeltaForPeriod).toLocaleString()} in ${periodLabel}.`,
      });
    }
    const activeDays = xAnalyticsData?.engagement_data_coverage_days ?? (postingCadencePoints.filter((p) => (p.posts ?? 0) > 0).length);
    if (xAnalyticsData && typeof activeDays === "number" && periodDays > 0) {
      list.push({
        id: "consistency",
        title: "Active days",
        metric: `${activeDays}/${periodDays}d in window.`,
      });
    }
    if (topDriversRows.some((r) => r.engagementOver100)) {
      list.push({
        id: "top-er",
        title: "Top driver",
        metric: "At least one post drove 100%+ ER.",
      });
    }
    return list.slice(0, 6);
  }, [
    xAnalyticsData,
    noPostsInWindow,
    engagementRateByPeriod,
    periodLabel,
    postsByPeriod,
    periodDays,
    topDriversRows,
    engagementDeltaForPeriod,
    followersDeltaForPeriod,
    postingCadencePoints,
  ]);

  const showRebuildRunning = rebuildJob?.status === "running";
  const showRebuildQueued = rebuildJob?.status === "queued";
  const showError =
    (rebuildJob?.status === "failed" && (rebuildJob?.last_error || true)) ||
    !!rebuildError ||
    !!xError ||
    (initStatus?.job?.status === "failed" && (profile?.twitter_username ?? "").toString().trim());
  const rawError = rebuildJob?.status === "failed"
    ? (rebuildJob?.last_error ?? "Rebuild failed.")
    : rebuildError
      ? rebuildError
      : xError
        ? (xError instanceof Error ? xError.message : "Could not load analytics.")
        : initStatus?.job?.status === "failed"
          ? (initStatus.job?.last_error ?? "Backfill didn't complete.")
          : null;
  const errorMessage = rawError && (rawError.length > 80 || /error:|exception|at \s+\w+\./.test(rawError))
    ? (rebuildJob?.status === "failed" ? "Rebuild failed. Try again." : xError ? "Could not load analytics. Try again." : "Something went wrong. Try again.")
    : rawError;
  const onRetry = rebuildJob?.status === "failed" || rebuildError
    ? () => triggerRebuild(dataStatus?.rollup_updated_at ?? null)
    : xError
      ? () => mutateX()
      : () => handleRetryBackfill();

  return (
    <div className="min-h-screen bg-background" data-page="analytics">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 space-y-6">
        {/* Single status row: rebuild running | queued | error (only one at a time) */}
        {showRebuildRunning && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-muted-foreground">Rebuild running</span>
            <span className="text-xs text-muted-foreground">Charts will update when ready.</span>
          </div>
        )}
        {!showRebuildRunning && showRebuildQueued && (
          <div className="rounded-lg border border-border bg-card px-3 py-2 flex items-center gap-2 text-sm text-muted-foreground">
            Rebuild queued.
          </div>
        )}
        {!showRebuildRunning && !showRebuildQueued && showError && errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 flex items-center justify-between gap-2 text-sm">
            <span className="text-destructive truncate">{errorMessage}</span>
            <button
              type="button"
              onClick={onRetry}
              disabled={rebuildLoading || retryingBackfill}
              className="shrink-0 px-2 py-1 rounded-md bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary"
            >
              {retryingBackfill ? "Retrying…" : "Retry"}
            </button>
          </div>
        )}

        <AnalyticsHeader
          tweetsSyncedAt={xAnalyticsData?.tweets_last_synced_at ?? null}
          followersSyncedAt={xAnalyticsData?.follower_last_synced_at ?? null}
          followerDataStale={xAnalyticsData?.follower_data_stale}
          windowPeriod={timePeriod}
          onWindowChange={setTimePeriod}
          onRefresh={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
          refreshLoading={rebuildLoading}
          refreshDisabled={rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
          setRoute={setRoute}
        />

        {/* Key Signals first (above KPIs) */}
        <div className="rounded-xl border border-border bg-card p-4" data-page="analytics">
          <h3 className="text-sm font-semibold text-foreground mb-2">Key Signals</h3>
          {signalsList.length === 0 ? (
            <div>
              <p className="text-sm text-muted-foreground">Connect X in Integrations and post to see engagement and cadence signals here.</p>
              <a href="/settings/integrations" className="mt-2 inline-block text-xs text-muted-foreground hover:text-foreground underline underline-offset-2">Connect in Integrations</a>
            </div>
          ) : (
            <ul className="space-y-2">
              {signalsList.map((s) => (
                <li key={s.id} className="text-sm">
                  <span className="font-medium text-foreground">{s.title}</span>
                  <span className="text-muted-foreground"> · {s.metric}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <KpiGrid cards={kpiCards} loading={xLoading} />

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {xLoading ? (
            <>
              <ChartSkeleton title="Follower Growth" />
              <ChartSkeleton title="Engagement Rate" />
            </>
          ) : (
          <>
          <FollowerGrowthChart
            points={followerGrowthPoints}
            coverageDays={xAnalyticsData?.follower_data_coverage_days ?? xAnalyticsData?.snapshot_days_in_window}
            windowDays={xAnalyticsData?.follower_window_days}
            earliestDate={xAnalyticsData?.follower_earliest_snapshot_date}
            insufficientData={followerInsufficient}
            bucketLabel={bucketLabel}
            onRefresh={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
            refreshDisabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
          />
          <EngagementChart
            points={engagementRatePoints}
            coverageDays={xAnalyticsData?.engagement_data_coverage_days}
            windowDays={xAnalyticsData?.window_days ?? periodDays}
            tweetCountWindow={xAnalyticsData?.tweet_count_window}
            noPostsInPeriod={typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window === 0}
            insufficientForTrend={engagementRatePoints.length < 3}
            summaryMessage={
              typeof xAnalyticsData?.engagement_data_coverage_days === "number" && xAnalyticsData.engagement_data_coverage_days <= 2
                ? `Active days: ${xAnalyticsData.engagement_data_coverage_days} / ${xAnalyticsData.window_days ?? periodDays}. Not enough for trend chart yet.${typeof xAnalyticsData?.engagement_rate_pct === "number" ? ` Window ER: ${xAnalyticsData.engagement_rate_pct.toFixed(1)}%.` : ""}`
                : undefined
            }
            bucketLabel={bucketLabel}
            onRefresh={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
            refreshDisabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
          />
          </>
          )}
        </div>

        {xLoading ? (
          <ChartSkeleton title="Posting Cadence" />
        ) : (
        <PostingCadenceChart
          points={postingCadencePoints}
          tweetCountWindow={xAnalyticsData?.tweet_count_window}
          windowDays={xAnalyticsData?.window_days ?? periodDays}
          noPostsInPeriod={typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window === 0}
          insufficientForTrend={postingCadencePoints.length < 3}
          summaryMessage={
            typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window <= 2
              ? `Posts in window: ${xAnalyticsData.tweet_count_window}. Cadence: ${(xAnalyticsData.tweet_count_window / (xAnalyticsData.window_days ?? periodDays)).toFixed(1)} posts/day. Not enough for trend chart yet.`
              : undefined
          }
          bucketLabel={bucketLabel}
          onRefresh={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
          refreshDisabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
        />
        )}

        <TopDriversTable
          rows={topDriversRows}
          postsInWindow={postsByPeriod}
          periodLabel={periodLabel}
        />

        {showDebugPanel && (() => {
          const rawFollower = chartPoints?.follower_growth ?? [];
          const rawEngagement = chartPoints?.engagement_rate ?? [];
          const rawCadence = chartPoints?.posting_cadence ?? [];
          const nonZeroFollower = rawFollower.filter((p) => p.follower_delta != null && Number.isFinite(p.follower_delta)).length;
          const nonZeroEngagement = rawEngagement.filter((p) => (p.engagement_pct > 0 || (p.posts ?? 0) > 0)).length;
          const nonZeroCadence = rawCadence.filter((p) => (p.posts ?? 0) > 0).length;
          const firstF = rawFollower[0]?.date ?? "—";
          const lastF = rawFollower.length ? rawFollower[rawFollower.length - 1]?.date ?? "—" : "—";
          const firstE = rawEngagement[0]?.date ?? "—";
          const lastE = rawEngagement.length ? rawEngagement[rawEngagement.length - 1]?.date ?? "—" : "—";
          const firstC = rawCadence[0]?.date ?? "—";
          const lastC = rawCadence.length ? rawCadence[rawCadence.length - 1]?.date ?? "—" : "—";
          const verdict = rawFollower.length >= 3 || rawEngagement.length >= 3 || rawCadence.length >= 3
            ? "API returns enough points. UI shows them (or weekly buckets for 90D)."
            : "API returned few points. Check backend/DB if 90D data expected.";
          return (
            <details className="rounded-xl border border-border bg-card overflow-hidden" data-page="analytics">
              <summary className="px-4 py-3 text-sm font-medium cursor-pointer">Debug (data truth)</summary>
              <div className="px-4 pb-4 pt-2 border-t border-border text-xs text-muted-foreground space-y-2 font-mono">
                <p>Window: {timePeriod} ({windowParam})</p>
                <p>Raw lengths: follower_growth={rawFollower.length}, engagement_rate={rawEngagement.length}, posting_cadence={rawCadence.length}</p>
                <p>Rendered lengths (after 90D weekly agg): {followerGrowthPoints.length}, {engagementRatePoints.length}, {postingCadencePoints.length}</p>
                <p>First / last: FG {firstF} to {lastF} · ER {firstE} to {lastE} · Cadence {firstC} to {lastC}</p>
                <p>Non-zero points: FG {nonZeroFollower}, ER {nonZeroEngagement}, Cadence {nonZeroCadence}</p>
                <p>Coverage: snapshot_days_in_window={xAnalyticsData?.snapshot_days_in_window ?? "—"}, follower_data_coverage_days={xAnalyticsData?.follower_data_coverage_days ?? "—"}, engagement_data_coverage_days={xAnalyticsData?.engagement_data_coverage_days ?? "—"}</p>
                <p>KPI rollup: followers={followersTotal}, posts={postsByPeriod}, ER={Number(engagementRateByPeriod).toFixed(2)}%, reach={reachProxyByPeriod}, avgLikes={Math.round(avgLikesByPeriod)}, avgReplies={Math.round(avgRepliesByPeriod)}</p>
                <p>Snapshots 7d/30d/90d: {String((xAnalyticsData?.debug as Record<string, unknown> | undefined)?.snapshot_count_7d ?? "—")} / {String((xAnalyticsData?.debug as Record<string, unknown> | undefined)?.snapshot_count_30d ?? "—")} / {String((xAnalyticsData?.debug as Record<string, unknown> | undefined)?.snapshot_count_90d ?? "—")}</p>
                {Array.isArray((xAnalyticsData?.debug as Record<string, unknown> | undefined)?.why_empty_hint) && (
                  <div className="pt-1">
                    <span className="font-medium text-amber-600 dark:text-amber-400">Why empty:</span>
                    <ul className="list-disc pl-4 mt-0.5">
                      {((xAnalyticsData?.debug as Record<string, unknown>).why_empty_hint as string[]).map((h, i) => (
                        <li key={i}>{h}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {(xAnalyticsData?.debug as Record<string, unknown> | undefined)?.conclusion && (
                  <p className="pt-2 border-t border-border font-semibold text-foreground">
                    Conclusion: {String((xAnalyticsData?.debug as Record<string, unknown>).conclusion)}
                  </p>
                )}
                <p className="pt-2 border-t border-border font-semibold text-foreground">Verdict: {verdict}</p>
              </div>
            </details>
          );
        })()}
      </div>
    </div>
  );
}
