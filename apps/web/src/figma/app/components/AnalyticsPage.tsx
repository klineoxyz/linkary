import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import { motion } from "motion/react";
import useSWR from "swr";
import { supabase } from "@/lib/supabase";
import { authFetcher, SWR_DEDUP_MS } from "@/lib/swrAuthFetcher";
import {
  ArrowLeft,
  BarChart3,
  Sparkles,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Shield,
  Clock,
  Youtube,
  Video,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Heart,
  Repeat,
  Users,
  Activity,
  Calendar,
  Zap,
  Target,
  Search,
} from "lucide-react";
import FlipCard from "./FlipCard";
import { FeatureStatusBadge } from "./SharedComponents";

/**
 * Linkary Analytics Page - Signals-First Dashboard
 * Rich insights with numbers + AI-ready signal system
 * Platform-agnostic structure (X now, YouTube/TikTok later)
 */

function formatTimeAgo(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const sec = Math.floor((Date.now() - d.getTime()) / 1000);
  if (sec < 60) return "just now";
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

type SignalType = "good" | "watch" | "risk";
type PlatformType = "x" | "youtube" | "tiktok";
type VisibilityType = "public" | "shared" | "restricted";

interface KPITile {
  id: string;
  label: string;
  value: string;
  delta7D: number;
  delta30D: number;
  delta90D: number;
  signal: SignalType;
  insight: string;
  sparklineData?: number[];
  /** When baseline exists: e.g. "+12% since joining" */
  sinceJoining?: string;
}

interface Signal {
  id: string;
  type: SignalType;
  title: string;
  metric: string;
  timestamp?: string;
}

interface TopDriver {
  tweet_id?: string;
  date: string;
  time?: string;
  postType: "text" | "media" | "thread";
  likes: number;
  replies: number;
  reposts: number;
  engagementRate: number;
  /** When true, ER is >100% (e.g. viral tweet); show "100%+" */
  engagementOver100?: boolean;
  growthContribution?: string;
}

type Baseline = {
  baseline_at?: string;
  baseline_date?: string;
  followers_total?: number | null;
  engagement_rate_proxy?: number | null;
  posts_30d?: number | null;
  avg_likes_30d?: number | null;
  avg_replies_30d?: number | null;
  reach_proxy_30d?: number | null;
} | null;

type SnapshotPoint = {
  snapshot_date: string;
  followers_total: number | null;
  tweets_count?: number | null;
  likes_received?: number | null;
  engagement_rate?: number | null;
};
type DataStatus = {
  tweet_count_7d?: number;
  tweet_count_30d?: number;
  tweet_count_90d?: number;
  last_tweet_at?: string | null;
  rollup_updated_at?: string | null;
};

type XAnalyticsData = {
  profile: { followers_total?: number; avg_engagement_rate?: number; x_last_profile_sync_at?: string | null; x_last_tweets_sync_at?: string | null; twitter_username?: string | null };
  rollup: Record<string, unknown> | null;
  topDrivers: Array<{ tweet_id: string; tweeted_at: string | null; like_count: number; reply_count: number; repost_count: number; engagement_score: number }>;
  baseline: Baseline;
  snapshots?: SnapshotPoint[];
  source?: "worker" | "partial" | "fallback";
  freshness?: {
    tweets_last_synced_at: string | null;
    snapshot_max_day: string | null;
    aggregate_max_as_of: string | null;
  };
  data_status?: DataStatus | null;
  chart_points?: {
    follower_growth: Array<{ date: string; follower_delta: number | null }>;
    engagement_rate: Array<{ date: string; engagement_pct: number; posts: number }>;
    posting_cadence: Array<{ date: string; posts: number }>;
  } | null;
  potential_reach_label?: string;
  potential_reach_is_estimated?: boolean;
  engagement_rate_is_estimated?: boolean;
  data_freshness_at?: string | null;
  tweets_last_synced_at?: string | null;
  follower_last_synced_at?: string | null;
  follower_data_stale?: boolean;
  tweet_count_window?: number;
  follower_data_coverage_days?: number;
  follower_earliest_snapshot_date?: string | null;
  follower_window_days?: number;
  engagement_data_coverage_days?: number;
  engagement_rate_pct?: number | null;
  window_days?: number;
  debug?: {
    window_days?: number;
    window_start?: string;
    window_end?: string;
    latest_tweet_date?: string | null;
    latest_follower_snapshot_date?: string | null;
    chart_points_count?: { follower_growth?: number; engagement_rate?: number; posting_cadence?: number };
    tweet_count_window?: number;
    total_engagement_window?: number;
    total_impressions_window?: number;
    engagement_rate_is_estimated?: boolean;
    potential_reach_label?: string;
    potential_reach_is_estimated?: boolean;
    cadence_points_count?: number;
  };
  diagnostics?: {
    top_day_last30_from_x_tweets: {
      day: string;
      likes: number;
      replies: number;
      reposts: number;
      tweets_count: number;
      max_like_tweet_id: string | null;
    } | null;
    has_outlier_day: boolean;
  };
};

type RebuildJob = {
  id: string;
  status: string;
  updated_at?: string;
  last_error?: string | null;
};

type InitStatus = {
  ok: boolean;
  initialized: boolean;
  has90dAggregate: boolean;
  hasTodaySnapshot: boolean;
  snapshotDays: number;
  job: { status: string; attempts: number; last_error: string | null; run_after: string | null } | null;
} | null;

export default function AnalyticsPage({ setRoute }: { setRoute?: (route: any) => void }) {
  const [activePlatform, setActivePlatform] = useState<PlatformType>("x");
  const [timePeriod, setTimePeriod] = useState<"7D" | "30D" | "90D">("30D");
  const [viewingEntity, setViewingEntity] = useState("My Analytics");
  const [entityType, setEntityType] = useState<"creator" | "project" | "agency" | "company">("creator");
  const [visibility, setVisibility] = useState<VisibilityType>("public");
  const [xAnalyticsData, setXAnalyticsData] = useState<XAnalyticsData | null>(null);
  const [windowSummary, setWindowSummary] = useState<{ windows: Record<string, Record<string, unknown> | null>; is_backfilling: boolean } | null>(null);
  const [initStatus, setInitStatus] = useState<InitStatus>(null);
  const [retryingBackfill, setRetryingBackfill] = useState(false);
  const [rebuildJob, setRebuildJob] = useState<RebuildJob | null>(null);
  const [rebuildLoading, setRebuildLoading] = useState(false);
  const [rebuildError, setRebuildError] = useState<string | null>(null);
  const [rebuildQueuedToast, setRebuildQueuedToast] = useState(false);
  const [diagnosticsOpen, setDiagnosticsOpen] = useState(false);
  const [debugTruthOpen, setDebugTruthOpen] = useState(false);
  const searchParams = useSearchParams();
  const showDebugPanel = searchParams?.get("debug") === "1";
  const rebuildPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollupPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const rollupUpdatedAtBeforeRebuildRef = useRef<string | null>(null);
  const isDev = process.env.NODE_ENV !== "production";
  const initialSyncTriggered = useRef(false);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const swrOpts = { revalidateOnFocus: false, dedupingInterval: SWR_DEDUP_MS };
  // Analytics X data: key includes window so 7D/30D/90D switch fetches the correct chart_points from API; include debug=1 when ?debug=1
  const windowParam = timePeriod === "7D" ? "7d" : timePeriod === "30D" ? "30d" : "90d";
  const analyticsXKey = `/api/analytics/x?window=${windowParam}${showDebugPanel ? "&debug=1" : ""}`;
  const analyticsSwrOpts = { revalidateOnFocus: true, dedupingInterval: 30_000, refreshInterval: 90_000 };
  const { data: initSwr, mutate: mutateInit } = useSWR<InitStatus>(
    "/api/analytics/init-status",
    authFetcher as (url: string) => Promise<InitStatus>,
    swrOpts
  );
  const { data: xSwr, mutate: mutateX } = useSWR<Record<string, unknown>>(
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
        data_status: (xSwr.data_status as DataStatus) ?? null,
        chart_points: (xSwr.chart_points as XAnalyticsData["chart_points"]) ?? null,
        data_freshness_at: typeof xSwr.data_freshness_at === "string" ? xSwr.data_freshness_at : undefined,
        tweets_last_synced_at: typeof xSwr.tweets_last_synced_at === "string" ? xSwr.tweets_last_synced_at : undefined,
        follower_last_synced_at: typeof xSwr.follower_last_synced_at === "string" ? xSwr.follower_last_synced_at : undefined,
        follower_data_stale: xSwr.follower_data_stale === true,
        potential_reach_label: typeof xSwr.potential_reach_label === "string" ? xSwr.potential_reach_label : undefined,
        potential_reach_is_estimated: xSwr.potential_reach_is_estimated === true,
        engagement_rate_is_estimated: xSwr.engagement_rate_is_estimated === true,
        tweet_count_window: typeof xSwr.tweet_count_window === "number" ? xSwr.tweet_count_window : undefined,
        follower_data_coverage_days: typeof xSwr.follower_data_coverage_days === "number" ? xSwr.follower_data_coverage_days : undefined,
        follower_earliest_snapshot_date: typeof xSwr.follower_earliest_snapshot_date === "string" ? xSwr.follower_earliest_snapshot_date : undefined,
        follower_window_days: typeof xSwr.follower_window_days === "number" ? xSwr.follower_window_days : undefined,
        engagement_data_coverage_days: typeof xSwr.engagement_data_coverage_days === "number" ? xSwr.engagement_data_coverage_days : undefined,
        engagement_rate_pct: typeof (xSwr as Record<string, unknown>).engagement_rate_pct === "number" ? (xSwr as Record<string, unknown>).engagement_rate_pct as number : undefined,
        debug: xSwr.debug as XAnalyticsData["debug"],
        diagnostics: xSwr.diagnostics as XAnalyticsData["diagnostics"],
        ...(typeof (xSwr as Record<string, unknown>).window_days === "number" && { window_days: (xSwr as Record<string, unknown>).window_days as number }),
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

  // Poll analytics API every 15s for up to 2 min until rollup_updated_at changes (so charts update without manual refresh)
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

  // When user has X connected but no baseline yet, take initial snapshot so 7D/30D/90D have a baseline
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
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/x-sync`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) await fetchXAnalytics();
    })();
  }, [xAnalyticsData, fetchXAnalytics]);

  const rollup = xAnalyticsData?.rollup;
  const profile = xAnalyticsData?.profile ?? {};
  const followersTotal = typeof profile.followers_total === "number" ? profile.followers_total : 0;
  const profileEngagementRate = typeof profile.avg_engagement_rate === "number" ? profile.avg_engagement_rate : 0;
  const num = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
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

  const dataStatus = xAnalyticsData?.data_status ?? null;
  const tweetCountForWindow =
    dataStatus && timePeriod === "7D"
      ? (dataStatus.tweet_count_7d ?? 0)
      : dataStatus && timePeriod === "30D"
        ? (dataStatus.tweet_count_30d ?? 0)
        : dataStatus && timePeriod === "90D"
          ? (dataStatus.tweet_count_90d ?? 0)
          : null;

  // Chart points: only from API (no UI-derived arrays). Window is in the API key.
  const chartPoints = xAnalyticsData?.chart_points ?? null;
  const followerGrowthPoints = chartPoints?.follower_growth ?? [];
  const engagementRatePoints = chartPoints?.engagement_rate ?? [];
  const postingCadencePoints = chartPoints?.posting_cadence ?? [];

  const baseline = xAnalyticsData?.baseline ?? null;
  const bNum = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  const baselineFollowers = baseline ? bNum(baseline.followers_total) : 0;
  const baselineEngagement = baseline ? bNum(baseline.engagement_rate_proxy) : 0;
  const baselinePosts30 = baseline ? bNum(baseline.posts_30d) : 0;
  const baselineLikes30 = baseline ? bNum(baseline.avg_likes_30d) : 0;
  const baselineReplies30 = baseline ? bNum(baseline.avg_replies_30d) : 0;
  const baselineReach30 = baseline ? bNum(baseline.reach_proxy_30d) : 0;
  /** "Since joining" delta; capped to avoid absurd values when baseline is tiny. Max 2 decimals. */
  const pctSince = (current: number, base: number): string | undefined => {
    if (base === 0 || !Number.isFinite(base) || !Number.isFinite(current)) return undefined;
    const pct = ((current - base) / base) * 100;
    if (pct > 9999 || pct < -99) return undefined; // hide when baseline was effectively zero
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${Number(pct.toFixed(2))}% since joining`;
  };

  const snapshots = (xAnalyticsData?.snapshots ?? []).filter((s) => s.snapshot_date);
  const snapshotsAsc = [...snapshots].sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  // Forward-fill followers so past days don't show 0 when we only have today's count
  const snapshotsWithFilledFollowers: SnapshotPoint[] = snapshotsAsc.length
    ? (() => {
        let lastKnown = followersTotal;
        return snapshotsAsc.map((s) => {
          const v = s.followers_total;
          if (v != null && Number.isFinite(v)) lastKnown = Number(v);
          return { ...s, followers_total: s.followers_total ?? lastKnown };
        });
      })()
    : [];
  const snapshotsForFollowerChartBase = snapshotsWithFilledFollowers.length >= 2 ? snapshotsWithFilledFollowers : snapshotsAsc;
  const periodDays = timePeriod === "7D" ? 7 : timePeriod === "30D" ? 30 : 90;
  const followerChartCutoff = (() => {
    const d = new Date();
    d.setDate(d.getDate() - periodDays);
    return d.toISOString().slice(0, 10);
  })();
  const snapshotsForFollowerChart = snapshotsForFollowerChartBase.filter((s) => s.snapshot_date >= followerChartCutoff);
  const getSnapshotAt = (daysAgo: number): number | null => {
    const target = new Date();
    target.setDate(target.getDate() - daysAgo);
    const targetStr = target.toISOString().slice(0, 10);
    const onOrBefore = snapshotsAsc.filter((s) => s.snapshot_date <= targetStr);
    const point = onOrBefore.length ? onOrBefore[onOrBefore.length - 1] : null;
    if (!point) return null;
    const v = point.followers_total;
    return v != null && Number.isFinite(v) ? Number(v) : null;
  };
  const latestFollowerCount = snapshotsAsc.length
    ? (snapshotsAsc[snapshotsAsc.length - 1].followers_total ?? followersTotal)
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
  const followerSparklineFromSnapshots =
    snapshotsAsc.length >= 2
      ? snapshotsAsc.map((s) => (s.followers_total != null && Number.isFinite(s.followers_total) ? Number(s.followers_total) : 0))
      : undefined;
  const hasRealFollowerHistory = snapshots.length >= 2;

  // Real deltas from baseline (30d at join) for rollup-backed KPIs. Use same baseline for 7D/30D/90D so deltas show for selected period.
  const baseEng = baselineEngagement > 0 ? baselineEngagement : null;
  const baseLikes = baselineLikes30 > 0 ? baselineLikes30 : null;
  const baseReplies = baselineReplies30 > 0 ? baselineReplies30 : null;
  const basePosts = baselinePosts30 > 0 ? baselinePosts30 : null;
  const baseReach = baselineReach30 > 0 ? baselineReach30 : null;
  const pctVsBase = (current: number, base: number | null): number | null => {
    if (base == null || base === 0 || !Number.isFinite(current)) return null;
    return ((current - base) / base) * 100;
  };
  const engagementDelta7 = baseEng != null ? pctVsBase(engagementRate7d, baseEng) : null;
  const engagementDelta30 = baseEng != null ? pctVsBase(engagementRate30d, baseEng) : null;
  const engagementDelta90 = baseEng != null ? pctVsBase(engagementRate90d, baseEng) : null;
  const likesDelta7 = baseLikes != null ? pctVsBase(avgLikes7d, baseLikes) : null;
  const likesDelta30 = baseLikes != null ? pctVsBase(avgLikes30d, baseLikes) : null;
  const likesDelta90 = baseLikes != null ? pctVsBase(avgLikes90d, baseLikes) : null;
  const repliesDelta7 = baseReplies != null ? pctVsBase(avgReplies7d, baseReplies) : null;
  const repliesDelta30 = baseReplies != null ? pctVsBase(avgReplies30d, baseReplies) : null;
  const repliesDelta90 = baseReplies != null ? pctVsBase(avgReplies90d, baseReplies) : null;
  const postsDelta7 = basePosts != null ? pctVsBase(posts7d, basePosts) : null;
  const postsDelta30 = basePosts != null ? pctVsBase(posts30d, basePosts) : null;
  const postsDelta90 = basePosts != null ? pctVsBase(posts90d, basePosts) : null;
  const reachDelta7 = baseReach != null ? pctVsBase(reachProxy7d, baseReach) : null;
  const reachDelta30 = baseReach != null ? pctVsBase(reachProxy30d, baseReach) : null;
  const reachDelta90 = baseReach != null ? pctVsBase(reachProxy90d, baseReach) : null;

  // X KPIs: real data when available; no fake deltas or sparklines
  const xKPIs: KPITile[] = [
    {
      id: "followers",
      label: "Followers",
      value: xAnalyticsData ? followersTotal.toLocaleString() : "—",
      delta7D: (hasRealFollowerHistory || useWindowAggregates) && followersDelta7 != null ? followersDelta7 : 0,
      delta30D: (hasRealFollowerHistory || useWindowAggregates) && followersDelta30 != null ? followersDelta30 : 0,
      delta90D: (hasRealFollowerHistory || useWindowAggregates) && followersDelta90 != null ? followersDelta90 : 0,
      signal: "good",
      insight: hasRealFollowerHistory ? "From X profile sync" : "Sync from Integrations to see trends",
      sparklineData: followerSparklineFromSnapshots,
      sinceJoining: baseline && baselineFollowers > 0 ? pctSince(followersTotal, baselineFollowers) : undefined,
    },
    {
      id: "engagement",
      label: "Engagement Rate",
      value: xAnalyticsData ? `${Number(engagementRateByPeriod).toFixed(2)}%` : "—",
      delta7D: engagementDelta7 ?? 0,
      delta30D: engagementDelta30 ?? 0,
      delta90D: engagementDelta90 ?? 0,
      signal: "good",
      insight: rollup
        ? (xAnalyticsData?.engagement_rate_is_estimated
            ? "Window aggregate (engagement/impressions). Estimated from followers×posts when impressions missing."
            : "Window aggregate: total engagement ÷ total impressions for selected period.")
        : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && baselineEngagement > 0 ? pctSince(engagementRateByPeriod, baselineEngagement) : undefined,
    },
    {
      id: "likes",
      label: "Avg Likes/Post",
      value: xAnalyticsData ? String(Math.round(avgLikesByPeriod)) : "—",
      delta7D: likesDelta7 ?? 0,
      delta30D: likesDelta30 ?? 0,
      delta90D: likesDelta90 ?? 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && baselineLikes30 > 0 ? pctSince(avgLikesByPeriod, baselineLikes30) : undefined,
    },
    {
      id: "replies",
      label: "Avg Replies/Post",
      value: xAnalyticsData ? String(Math.round(avgRepliesByPeriod)) : "—",
      delta7D: repliesDelta7 ?? 0,
      delta30D: repliesDelta30 ?? 0,
      delta90D: repliesDelta90 ?? 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && baselineReplies30 > 0 ? pctSince(avgRepliesByPeriod, baselineReplies30) : undefined,
    },
    {
      id: "frequency",
      label: `Posts (${periodLabel})`,
      value: xAnalyticsData ? String(postsByPeriod) : "—",
      delta7D: postsDelta7 ?? 0,
      delta30D: postsDelta30 ?? 0,
      delta90D: postsDelta90 ?? 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && baselinePosts30 > 0 ? pctSince(postsByPeriod, baselinePosts30) : undefined,
    },
    {
      id: "reach",
      label: xAnalyticsData?.potential_reach_label ?? "Potential Reach",
      value: xAnalyticsData
        ? (reachProxyByPeriod >= 1e6 ? `${(reachProxyByPeriod / 1e6).toFixed(1)}M` : reachProxyByPeriod >= 1e3 ? `${(reachProxyByPeriod / 1e3).toFixed(1)}K` : String(Math.round(reachProxyByPeriod)))
        : "—",
      delta7D: reachDelta7 ?? 0,
      delta30D: reachDelta30 ?? 0,
      delta90D: reachDelta90 ?? 0,
      signal: "good",
      insight: rollup
        ? (xAnalyticsData?.potential_reach_is_estimated
            ? "Estimated max exposure (followers × posts); connect X for Total Impressions when impressions data is available."
            : "Sum of impressions for the selected window. From rollup for selected period.")
        : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && baselineReach30 > 0 ? pctSince(reachProxyByPeriod, baselineReach30) : undefined,
    },
  ];

  const hasRealInsights = Boolean(rollup || hasRealFollowerHistory);
  const signals: Signal[] = hasRealInsights
    ? [
        {
          id: "synced",
          type: "good" as SignalType,
          title: "Your X metrics are synced",
          metric: "View your 7D / 30D / 90D trends in the cards above. Connect more data in Integrations for richer signals.",
          timestamp: "",
        },
      ]
    : [
        {
          id: "no-data",
          type: "watch" as SignalType,
          title: "Connect X and sync from Integrations to see insights here.",
          metric: "Data is collected from the day you connect and sync.",
          timestamp: "",
        },
      ];

  // Dedupe by tweet_id; source: GET /api/analytics/x → x_top_drivers (profile_id, window_days=30)
  const rawTop = xAnalyticsData?.topDrivers ?? [];
  const byTweetId = new Map<string, typeof rawTop[0]>();
  for (const t of rawTop) {
    if (t?.tweet_id && !byTweetId.has(t.tweet_id)) byTweetId.set(t.tweet_id, t);
  }
  const topDrivers: (TopDriver & { tweet_id: string })[] = Array.from(byTweetId.entries()).map(([tweet_id, t]) => {
    const engagementScore = Number(t.engagement_score) || 0;
    const erPct = followersTotal > 0 ? (engagementScore / followersTotal) * 100 : 0;
    return {
      tweet_id,
      date: t.tweeted_at ? new Date(t.tweeted_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "",
      time: t.tweeted_at ? new Date(t.tweeted_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }) : "",
          postType: "text" as const,
          likes: t.like_count ?? 0,
          replies: t.reply_count ?? 0,
          reposts: t.repost_count ?? 0,
          engagementRate: Math.min(100, Math.round(erPct * 10) / 10),
          engagementOver100: erPct > 100,
        };
  });
  const hasTopDrivers = topDrivers.length > 0;

  const getSignalColor = (signal: SignalType) => {
    switch (signal) {
      case "good":
        return {
          bg: "from-primary/10 to-primary/5",
          border: "border-primary/30",
          text: "text-primary",
          icon: CheckCircle2,
        };
      case "watch":
        return {
          bg: "from-muted to-muted/80",
          border: "border-border",
          text: "text-muted-foreground",
          icon: Eye,
        };
      case "risk":
        return {
          bg: "from-muted to-muted/80",
          border: "border-border",
          text: "text-muted-foreground",
          icon: AlertTriangle,
        };
    }
  };

  const getPostTypeColor = (type: TopDriver["postType"]) => {
    switch (type) {
      case "thread":
        return "bg-chart-3/20 text-foreground border-border";
      case "media":
        return "bg-chart-2/20 text-foreground border-border";
      case "text":
        return "bg-chart-1/20 text-foreground border-border";
    }
  };

  const platforms = [
    { id: "x" as PlatformType, label: "X", icon: null, active: true },
    { id: "youtube" as PlatformType, label: "YouTube", icon: Youtube, active: false },
    { id: "tiktok" as PlatformType, label: "TikTok", icon: Video, active: false },
  ];

  const visibilityOptions = [
    { id: "public" as VisibilityType, label: "Public", icon: Eye },
    { id: "shared" as VisibilityType, label: "Shared", icon: Users },
    { id: "restricted" as VisibilityType, label: "Restricted", icon: Shield },
  ];

  return (
    <div className="min-h-screen pb-12">
      <div className="max-w-7xl mx-auto px-6 lg:px-10 space-y-10">
        {/* Back Button */}
        {setRoute && (
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.4 }}
            onClick={() => setRoute({ name: "dashboard" })}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:bg-muted/50 hover:border-primary/20 text-foreground hover:text-foreground transition-all group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform stroke-[1.75]" />
            Back to Dashboard
          </motion.button>
        )}

        {windowSummary?.is_backfilling && (profile?.twitter_username ?? "").toString().trim() ? (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-3 text-sm text-foreground flex flex-wrap items-center justify-between gap-2"
          >
            <span>
              {hasRealInsights
                ? "7D/30D/90D windows are being computed. Your latest stats are below. (For new accounts under 90 days, full windows appear shortly.)"
                : "Connect X in Integrations to load your data. 7D/30D/90D windows are backfilled automatically on login and when your profile is viewed."}
            </span>
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
                disabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
                className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-medium text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {rebuildLoading ? "Starting…" : "Rebuild analytics"}
              </button>
              <button
                type="button"
                onClick={() => fetchXAnalytics()}
                className="px-3 py-1.5 rounded-lg bg-primary/20 hover:bg-primary/30 text-primary font-medium text-sm transition-colors"
              >
                Refresh analytics
              </button>
            </div>
          </motion.div>
        ) : null}
        {rebuildQueuedToast && (rebuildJob?.status === "queued" || rebuildJob?.status === "running") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-primary/30 bg-primary/5 px-4 py-2 text-sm text-foreground"
          >
            Rebuild queued. Charts will update automatically when rollups are ready (polling every 15s).
          </motion.div>
        )}
        {rebuildJob && (rebuildJob.status === "queued" || rebuildJob.status === "running" || rebuildJob.status === "done" || rebuildJob.status === "failed") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-border bg-card px-4 py-3 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-muted-foreground">Rebuild status:</span>
              <span className="font-medium capitalize">{rebuildJob.status}</span>
              {rebuildJob.updated_at && (
                <span className="text-xs text-muted-foreground">
                  Last updated {formatTimeAgo(rebuildJob.updated_at)}
                </span>
              )}
            </div>
            {(rebuildJob.last_error || rebuildJob.status === "failed") && (
              <p className="text-xs text-destructive w-full">{rebuildJob.last_error ?? "Job failed."}</p>
            )}
            {rebuildJob.status === "failed" && (
              <button
                type="button"
                onClick={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
                disabled={rebuildLoading}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                Try again
              </button>
            )}
            {rebuildJob.status === "done" && (
              <button
                type="button"
                onClick={() => fetchXAnalytics()}
                className="px-3 py-1.5 rounded-lg border border-border text-sm font-medium"
              >
                Refresh data
              </button>
            )}
          </motion.div>
        )}
        {rebuildError && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive"
          >
            {rebuildError}
          </motion.div>
        )}
        {((initStatus?.ok && !initStatus?.initialized) || xAnalyticsData?.source === "partial") && (profile?.twitter_username ?? "").toString().trim() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-wrap items-center gap-3"
          >
            <Clock className="w-5 h-5 text-amber-600 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-amber-900 dark:text-amber-200">Building your 90-day history…</p>
              <p className="text-xs text-amber-800/80 dark:text-amber-200/80 mt-0.5">This can take a few minutes. You can refresh the page to check.</p>
            </div>
            <button
              type="button"
              onClick={() => { fetchInitStatus(); fetchXAnalytics(); }}
              className="px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-800 dark:text-amber-200 text-sm font-medium hover:bg-amber-500/20"
            >
              Refresh
            </button>
          </motion.div>
        )}
        {initStatus?.job?.status === "failed" && (profile?.twitter_username ?? "").toString().trim() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 flex flex-wrap items-center gap-3"
          >
            <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-destructive">Backfill didn’t complete</p>
              {initStatus.job?.last_error && <p className="text-xs text-muted-foreground mt-0.5 truncate">{initStatus.job.last_error}</p>}
            </div>
            <button
              type="button"
              onClick={handleRetryBackfill}
              disabled={retryingBackfill}
              className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
            >
              {retryingBackfill ? "Retrying…" : "Retry backfill"}
            </button>
          </motion.div>
        )}
        {xAnalyticsData?.source === "fallback" && initStatus?.initialized === true && (profile?.twitter_username ?? "").toString().trim() && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-muted bg-muted/50 p-3 flex items-center gap-2"
          >
            <Eye className="w-4 h-4 text-muted-foreground shrink-0" />
            <p className="text-xs text-muted-foreground">Your full history is still loading. Some metrics may be limited.</p>
          </motion.div>
        )}
        {/* A) Sticky Analytics Context Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="sticky top-0 z-40 rounded-3xl border border-border bg-gradient-to-br from-card to-muted/30 backdrop-blur-xl p-6"
        >
          <div className="flex flex-col gap-4">
            {/* Row 1: Context + Platform Tabs */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              {/* Left: Context */}
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-xl bg-accent border border-border">
                  <BarChart3 className="w-6 h-6 text-primary stroke-[1.75]" />
                </div>
                <div>
                  <div className="flex items-center gap-3">
                    <h1 className="text-2xl font-bold text-foreground">{viewingEntity}</h1>
                    <span className="px-3 py-1 rounded-full bg-accent text-foreground text-xs font-medium border border-border">
                      {entityType.charAt(0).toUpperCase() + entityType.slice(1)}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    {/* Visibility Selector */}
                    <div className="flex items-center gap-2">
                      {visibilityOptions.map((option) => (
                        <button
                          key={option.id}
                          onClick={() => setVisibility(option.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            visibility === option.id
                              ? "bg-muted/50 text-foreground border border-primary/20"
                              : "text-muted-foreground hover:text-foreground border border-transparent"
                          }`}
                        >
                          <option.icon className="w-3 h-3 stroke-[1.75]" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Last Synced + Refresh */}
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3 stroke-[1.75]" />
                      <span>
                        {profile.x_last_profile_sync_at || profile.x_last_tweets_sync_at
                          ? `Synced ${formatTimeAgo(profile.x_last_profile_sync_at || profile.x_last_tweets_sync_at || "")}`
                          : "Not synced (Settings → Integrations)"}
                      </span>
                      {(profile.x_last_profile_sync_at || profile.x_last_tweets_sync_at) && (
                        <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                      )}
                      <button
                        type="button"
                        onClick={() => fetchXAnalytics()}
                        className="text-primary hover:underline font-medium"
                      >
                        Refresh
                      </button>
                    </div>
                  </div>
                </div>
              </div>
              {/* Data status (owner-only truth check: tweets in window, last tweet, rollup updated) */}
              {activePlatform === "x" && dataStatus && (
                <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1 pt-1 border-t border-border/50 mt-2">
                  <span>Tweets in window: {timePeriod === "7D" ? (dataStatus.tweet_count_7d ?? "—") : timePeriod === "30D" ? (dataStatus.tweet_count_30d ?? "—") : (dataStatus.tweet_count_90d ?? "—")}</span>
                  <span>Window: {timePeriod}</span>
                  <span>Last tweet: {dataStatus.last_tweet_at ? formatTimeAgo(dataStatus.last_tweet_at) : "none"}</span>
                  <span>Rollup updated: {dataStatus.rollup_updated_at ? formatTimeAgo(dataStatus.rollup_updated_at) : "unknown"}</span>
                </div>
              )}

              {/* Right: Platform Tabs (X supported; other platforms can be added later) */}
              <div className="flex items-center gap-2">
                {platforms.map((platform) => (
                  <button
                    key={platform.id}
                    onClick={() => platform.active && setActivePlatform(platform.id)}
                    disabled={!platform.active}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all ${
                      activePlatform === platform.id && platform.active
                        ? "bg-primary text-primary-foreground border border-border"
                        : platform.active
                        ? "text-muted-foreground hover:text-foreground border border-border hover:border-primary/20"
                        : "text-muted-foreground border border-border/50 cursor-not-allowed"
                    }`}
                  >
                    {platform.id === "x" ? (
                      <span className="text-base font-bold text-foreground" aria-label="X">𝕏</span>
                    ) : (
                      platform.icon && <platform.icon className="w-4 h-4 stroke-[1.75]" />
                    )}
                    {platform.label}
                    {!platform.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-card text-muted-foreground">Soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 1.5: Search (brands: public profiles or approved/applicants) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-border">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-card border border-border focus-within:border-primary/20 transition-colors">
                <Search className="w-4 h-4 text-muted-foreground stroke-[1.75]" />
                <input
                  type="search"
                  placeholder={entityType === "creator" ? "Search your analytics…" : "Search public profiles or approved applicants…"}
                  className="flex-1 min-w-0 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
                  aria-label="Search profiles"
                />
              </div>
              {entityType !== "creator" && (
                <p className="text-xs text-muted-foreground">
                  Brands can search all public profiles or limit to users who approved access or applied to your project.
                </p>
              )}
            </div>

            {/* Row 2: Global Time Period Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-muted-foreground">Time Period:</span>
              <div className="flex items-center gap-2">
                {(["7D", "30D", "90D"] as const).map((period) => (
                  <motion.button
                    key={period}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setTimePeriod(period)}
                    className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                      timePeriod === period
                        ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30"
                        : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-primary/20"
                    }`}
                  >
                    {period === "7D" ? "Last 7 Days" : period === "30D" ? "Last 30 Days" : "Last 90 Days"}
                  </motion.button>
                ))}
              </div>
              
              {/* Period Summary */}
              <div className="ml-auto flex items-center gap-2 text-xs">
                <div className="px-3 py-1.5 rounded-lg bg-accent border border-border text-primary font-medium">
                  {timePeriod === "7D" ? "7 days" : timePeriod === "30D" ? "30 days" : "90 days"} of data
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* B) KPI Signal Tiles Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {xKPIs.map((kpi, index) => {
            const signalStyle = getSignalColor(kpi.signal);
            const SignalIcon = signalStyle.icon;
            const delta = timePeriod === "7D" ? kpi.delta7D : timePeriod === "30D" ? kpi.delta30D : kpi.delta90D;
            const isPositive = delta > 0;
            const isNegative = delta < 0;
            const deltaColor = isPositive ? "text-green-600" : isNegative ? "text-orange-800" : "text-muted-foreground";
            const DeltaIcon = isPositive ? TrendingUp : isNegative ? TrendingDown : null;

            return (
              <motion.div
                key={kpi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 backdrop-blur-xl p-6 hover:border-primary/20 transition-all group"
              >
                {/* Signal Badge */}
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border}`}>
                  <SignalIcon className={`w-3 h-3 ${signalStyle.text} stroke-[1.75]`} />
                  <span className={`text-xs font-medium ${signalStyle.text} capitalize`}>
                    {kpi.signal}
                  </span>
                </div>

                {/* Label */}
                <p className="text-sm font-medium text-muted-foreground mb-2">{kpi.label}</p>

                {/* Value */}
                <div className="flex items-end gap-3 mb-3">
                  <h3 className="text-4xl font-bold text-foreground">{kpi.value}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    {DeltaIcon && <DeltaIcon className={`w-4 h-4 ${deltaColor} stroke-[1.75]`} />}
                    <span className={`text-sm font-semibold ${deltaColor}`}>
                      {isPositive ? "+" : ""}{Number(delta).toFixed(2)}%
                    </span>
                  </div>
                </div>

                {/* Delta Toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setTimePeriod("7D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "7D"
                        ? "bg-muted/50 text-foreground"
                        : "text-foreground hover:text-foreground"
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setTimePeriod("30D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "30D"
                        ? "bg-muted/50 text-foreground"
                        : "text-foreground hover:text-foreground"
                    }`}
                  >
                    30D
                  </button>
                  <button
                    onClick={() => setTimePeriod("90D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "90D"
                        ? "bg-muted/50 text-foreground"
                        : "text-foreground hover:text-foreground"
                    }`}
                  >
                    90D
                  </button>
                </div>

                {/* Sparkline */}
                {kpi.sparklineData && (
                  <div className="relative h-12 mb-3 flex items-end gap-1">
                    {kpi.sparklineData.map((value, idx) => {
                      const maxValue = Math.max(...kpi.sparklineData!);
                      const height = (value / maxValue) * 100;
                      return (
                        <div
                          key={idx}
                          className="flex-1 rounded-t-sm bg-gradient-to-t from-chart-1/80 to-chart-1/40 border-t border-chart-1/50 transition-all duration-300 hover:from-chart-1 hover:to-chart-1/60"
                          style={{ height: `${height}%` }}
                        />
                      );
                    })}
                  </div>
                )}

                {/* Insight */}
                <p className="text-xs text-muted-foreground leading-relaxed">{kpi.insight}</p>
                {kpi.sinceJoining && (
                  <p className="text-xs text-primary mt-2 font-medium">{kpi.sinceJoining}</p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Freshness indicator: compact badge with status dot */}
        {activePlatform === "x" && (() => {
          const tweetsSync = xAnalyticsData?.tweets_last_synced_at ?? null;
          const followerSync = xAnalyticsData?.follower_last_synced_at ?? null;
          const syncDates = [tweetsSync, followerSync].filter(Boolean) as string[];
          const latestSync = syncDates.length ? syncDates.reduce((a, b) => (new Date(a) > new Date(b) ? a : b)) : undefined;
          const hoursAgo = latestSync ? (Date.now() - new Date(latestSync).getTime()) / 3600000 : null;
          const dotClass = hoursAgo == null ? "bg-muted-foreground/50" : hoursAgo > 48 ? "bg-destructive" : hoursAgo > 24 ? "bg-amber-500" : "bg-primary/70";
          return (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${dotClass}`} aria-hidden />
              <span>
                Data last synced:{" "}
                {latestSync ? formatTimeAgo(latestSync) : "Not synced yet"}
              </span>
            </div>
          );
        })()}

        {/* Data freshness: tweets, snapshots, aggregates */}
        {activePlatform === "x" && (
          <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-x-4 gap-y-1">
            <span>
              Tweets last synced:{" "}
              {xAnalyticsData?.freshness?.tweets_last_synced_at
                ? formatTimeAgo(xAnalyticsData.freshness.tweets_last_synced_at)
                : "Not ready yet, run Rebuild analytics"}
            </span>
            <span>
              Snapshots as of:{" "}
              {xAnalyticsData?.freshness?.snapshot_max_day ?? "Not ready yet, run Rebuild analytics"}
            </span>
            <span>
              Aggregates as of:{" "}
              {xAnalyticsData?.freshness?.aggregate_max_as_of ?? "Not ready yet, run Rebuild analytics"}
            </span>
          </div>
        )}

        {/* Outlier warning (when diagnostics indicate possible data error) */}
        {activePlatform === "x" && xAnalyticsData?.diagnostics?.has_outlier_day && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 flex flex-wrap items-center justify-between gap-2"
          >
            <p className="text-sm text-amber-900 dark:text-amber-200">
              Outlier detected in last 30 days. This may be provider data error. Click View tweet rows to inspect.
            </p>
            <a
              href={`/debug/x-tweets?day=${xAnalyticsData.diagnostics?.top_day_last30_from_x_tweets?.day ?? ""}`}
              className="px-3 py-1.5 rounded-lg border border-amber-500/50 text-amber-800 dark:text-amber-200 text-sm font-medium hover:bg-amber-500/20"
            >
              View tweet rows
            </a>
          </motion.div>
        )}

        {/* Debug truth panel (owner-only, ?debug=1): raw counts + points so we can verify without guessing */}
        {activePlatform === "x" && showDebugPanel && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setDebugTruthOpen((o) => !o)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <span>Debug (truth)</span>
              {debugTruthOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {debugTruthOpen && (
              <div className="px-4 pb-4 border-t border-border text-xs text-muted-foreground space-y-1 pt-3">
                <p><span className="font-semibold text-foreground">Window:</span> {timePeriod}</p>
                <p><span className="font-semibold text-foreground">Tweets:</span> {tweetCountForWindow ?? "—"}</p>
                <p><span className="font-semibold text-foreground">Last tweet:</span> {dataStatus?.last_tweet_at ? formatTimeAgo(dataStatus.last_tweet_at) : "none"}</p>
                <p><span className="font-semibold text-foreground">Rollup updated:</span> {dataStatus?.rollup_updated_at ? formatTimeAgo(dataStatus.rollup_updated_at) : "unknown"}</p>
                <p><span className="font-semibold text-foreground">Points:</span> growth {followerGrowthPoints.length}, engagement {engagementRatePoints.length}, cadence {postingCadencePoints.length}</p>
                {xAnalyticsData?.debug != null && (
                  <>
                    <p><span className="font-semibold text-foreground">window_days:</span> {xAnalyticsData.debug.window_days ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">window_start / window_end:</span> {xAnalyticsData.debug.window_start ?? "—"} → {xAnalyticsData.debug.window_end ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">latest_tweet_date:</span> {xAnalyticsData.debug.latest_tweet_date ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">latest_follower_snapshot_date:</span> {xAnalyticsData.debug.latest_follower_snapshot_date ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">chart_points_count:</span> growth {xAnalyticsData.debug.chart_points_count?.follower_growth ?? "—"}, engagement {xAnalyticsData.debug.chart_points_count?.engagement_rate ?? "—"}, cadence {xAnalyticsData.debug.chart_points_count?.posting_cadence ?? xAnalyticsData.debug.cadence_points_count ?? "—"} (cadence should be 7/30/90)</p>
                    <p><span className="font-semibold text-foreground">tweet_count_window:</span> {xAnalyticsData.debug.tweet_count_window ?? xAnalyticsData.tweet_count_window ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">follower_data_coverage_days / follower_window_days:</span> {xAnalyticsData.follower_data_coverage_days ?? "—"} / {xAnalyticsData.follower_window_days ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">follower_earliest_snapshot_date:</span> {xAnalyticsData.follower_earliest_snapshot_date ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">engagement_data_coverage_days:</span> {xAnalyticsData.engagement_data_coverage_days ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">total_engagement_window:</span> {xAnalyticsData.debug.total_engagement_window ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">total_impressions_window:</span> {xAnalyticsData.debug.total_impressions_window ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">engagement_rate_is_estimated:</span> {String(xAnalyticsData.debug.engagement_rate_is_estimated ?? false)}</p>
                    <p><span className="font-semibold text-foreground">potential_reach_label:</span> {xAnalyticsData.debug.potential_reach_label ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">potential_reach_is_estimated:</span> {String(xAnalyticsData.debug.potential_reach_is_estimated ?? false)}</p>
                  </>
                )}
                {(xAnalyticsData?.data_freshness_at != null || xAnalyticsData?.follower_data_stale != null) && (
                  <>
                    <p><span className="font-semibold text-foreground">data_freshness_at:</span> {xAnalyticsData.data_freshness_at ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">tweets_last_synced_at:</span> {xAnalyticsData.tweets_last_synced_at ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">follower_last_synced_at:</span> {xAnalyticsData.follower_last_synced_at ?? "—"}</p>
                    <p><span className="font-semibold text-foreground">follower_data_stale:</span> {String(xAnalyticsData.follower_data_stale ?? false)}</p>
                  </>
                )}
              </div>
            )}
          </motion.div>
        )}

        {/* Diagnostics panel (dev only) */}
        {activePlatform === "x" && isDev && xAnalyticsData?.diagnostics != null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="rounded-xl border border-border bg-card overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setDiagnosticsOpen((o) => !o)}
              className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-foreground hover:bg-muted/50"
            >
              <span>Diagnostics</span>
              {diagnosticsOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            {diagnosticsOpen && (
              <div className="px-4 pb-4 border-t border-border">
                <table className="w-full text-xs text-left border-collapse">
                  <tbody>
                    <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">has_outlier_day</th><td>{String(xAnalyticsData.diagnostics.has_outlier_day)}</td></tr>
                    {xAnalyticsData.diagnostics.top_day_last30_from_x_tweets && (
                      <>
                        <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">top_day</th><td>{xAnalyticsData.diagnostics.top_day_last30_from_x_tweets.day}</td></tr>
                        <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">likes</th><td>{xAnalyticsData.diagnostics.top_day_last30_from_x_tweets.likes}</td></tr>
                        <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">replies</th><td>{xAnalyticsData.diagnostics.top_day_last30_from_x_tweets.replies}</td></tr>
                        <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">reposts</th><td>{xAnalyticsData.diagnostics.top_day_last30_from_x_tweets.reposts}</td></tr>
                        <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">tweets_count</th><td>{xAnalyticsData.diagnostics.top_day_last30_from_x_tweets.tweets_count}</td></tr>
                        <tr><th className="py-1 pr-4 font-semibold text-muted-foreground">max_like_tweet_id</th><td className="font-mono">{xAnalyticsData.diagnostics.top_day_last30_from_x_tweets.max_like_tweet_id ?? "—"}</td></tr>
                      </>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </motion.div>
        )}

        {/* C) Signals Feed (Primary Section) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 backdrop-blur-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-primary stroke-[1.75]" />
            <div>
              <h2 className="text-2xl font-bold text-foreground">Signals</h2>
              <p className="text-sm text-muted-foreground mt-1">
                AI-detected insights from your analytics data
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {signals.map((signal, index) => {
              const signalStyle = getSignalColor(signal.type);
              const SignalIcon = signalStyle.icon;

              return (
                <motion.div
                  key={signal.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.05 }}
                  className={`group relative overflow-hidden rounded-2xl border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border} p-5 hover:scale-[1.01] transition-all cursor-pointer`}
                >
                  <div className="flex items-start gap-4">
                    <div className="p-2 rounded-xl bg-muted/50 border border-primary/20 flex-shrink-0">
                      <SignalIcon className={`w-5 h-5 ${signalStyle.text} stroke-[1.75]`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-foreground font-semibold mb-2 leading-relaxed">{signal.title}</h3>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${signalStyle.text} font-medium`}>{signal.metric}</p>
                        {signal.timestamp && (
                          <p className="text-xs text-muted-foreground">{signal.timestamp}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-foreground group-hover:translate-x-1 transition-all flex-shrink-0 stroke-[1.75]" />
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* D) What Changed (Top Drivers Panel) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 backdrop-blur-xl p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-primary stroke-[1.75]" />
              <div>
                <h2 className="text-2xl font-bold text-foreground">Top Drivers (30D)</h2>
                <p className="text-sm text-muted-foreground mt-1">
                  Posts that contributed most to your growth. Data from your synced X tweets (Integrations). Engagement uses likes, replies, and reposts only.
                </p>
              </div>
            </div>
          </div>

          {/* Table or empty state */}
          {hasTopDrivers ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    Type
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    Likes
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    Replies
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    Reposts
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    ER %
                  </th>
                  <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider pb-3">
                    Growth
                  </th>
                </tr>
              </thead>
              <tbody>
                {topDrivers.map((driver, index) => (
                  <motion.tr
                    key={driver.tweet_id ?? index}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: index * 0.05 }}
                    className="border-b border-border/50 hover:bg-card transition-colors group"
                  >
                    <td className="py-4 text-sm text-foreground font-medium">
                      {driver.date}{driver.time ? ` · ${driver.time}` : ""}
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getPostTypeColor(driver.postType)}`}>
                        {driver.postType.charAt(0).toUpperCase() + driver.postType.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-primary stroke-[1.75]" />
                        {driver.likes.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-primary stroke-[1.75]" />
                        {driver.replies}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-foreground">
                      <div className="flex items-center justify-end gap-1.5">
                        <Repeat className="w-3.5 h-3.5 text-primary stroke-[1.75]" />
                        {driver.reposts}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm font-semibold text-primary">
                      {driver.engagementOver100 ? "100%+" : `${driver.engagementRate}%`}
                    </td>
                    <td className="py-4 text-right text-sm font-semibold text-primary">
                      {driver.growthContribution ?? "\u2014"}
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : (
            <p className="text-sm text-muted-foreground py-6">
              No top drivers yet. Sync from Integrations to populate. Data is collected from the day you connect X.
            </p>
          )}
        </motion.div>

        {/* E) Trend Explorer (Secondary Charts) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Follower Growth Chart: real data from snapshots when available */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary stroke-[1.75]" />
                Follower Growth
              </h3>
              <div className="flex gap-2">
                {(["7D", "30D", "90D"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTimePeriod(range)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === timePeriod
                        ? "bg-accent text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-2">
              Coverage: {typeof xAnalyticsData?.follower_data_coverage_days === "number" && typeof xAnalyticsData?.follower_window_days === "number"
                ? `${xAnalyticsData.follower_data_coverage_days}/${xAnalyticsData.follower_window_days} days`
                : "—"}
            </p>
            {typeof xAnalyticsData?.follower_window_days === "number" &&
            xAnalyticsData.follower_window_days >= 30 &&
            typeof xAnalyticsData?.follower_data_coverage_days === "number" &&
            xAnalyticsData.follower_data_coverage_days < 10 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground mb-2">
                  Follower history is still building. We start showing trends after a few daily snapshots.
                </p>
                <p className="text-xs text-muted-foreground mb-2">
                  Snapshots so far: {xAnalyticsData.follower_data_coverage_days} days
                  {xAnalyticsData.follower_earliest_snapshot_date
                    ? ` · First snapshot: ${xAnalyticsData.follower_earliest_snapshot_date}`
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
                  disabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {rebuildLoading ? "Starting…" : "Refresh data"}
                </button>
              </div>
            ) : followerGrowthPoints.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">
                No data in this period.
              </p>
            ) : (
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-0.5 border-l border-b border-border">
                  {followerGrowthPoints.map((p, i) => {
                    const val = p.follower_delta;
                    const hasData = val !== null && val !== undefined;
                    const numericValues = followerGrowthPoints
                      .map((x) => x.follower_delta)
                      .filter((v): v is number => v != null && typeof v === "number");
                    const max = numericValues.length ? Math.max(...numericValues, 1) : 1;
                    const min = numericValues.length ? Math.min(...numericValues, 0) : 0;
                    const range = max - min || 1;
                    const heightPct = hasData ? Math.max(0, (((val as number) - min) / range) * 100) : 0;
                    const isNegative = hasData && (val as number) < 0;
                    if (!hasData) {
                      return (
                        <div
                          key={p.date}
                          className="flex-1 min-w-[4px] relative group"
                          title={`${p.date}: No snapshot`}
                        >
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                            {p.date}: No snapshot
                          </div>
                        </div>
                      );
                    }
                    return (
                      <motion.div
                        key={p.date}
                        className={`flex-1 min-w-[4px] rounded-t-md border-t relative group ${isNegative ? "bg-gradient-to-t from-destructive/60 to-destructive/30 border-destructive/50" : "bg-gradient-to-t from-chart-1/80 to-chart-1/40 border-chart-1/50"}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.3, delay: i * 0.02 }}
                        title={`${p.date}: ${(val as number) >= 0 ? "+" : ""}${(val as number).toLocaleString()}`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {p.date}: {(val as number) >= 0 ? "+" : ""}{(val as number).toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                  <span>{followerGrowthPoints[0]?.date ?? ""}</span>
                  <span>{followerGrowthPoints[followerGrowthPoints.length - 1]?.date ?? ""}</span>
                </div>
                {typeof xAnalyticsData?.follower_data_coverage_days === "number" &&
                  typeof xAnalyticsData?.window_days === "number" &&
                  xAnalyticsData.follower_data_coverage_days < xAnalyticsData.window_days &&
                  xAnalyticsData.follower_earliest_snapshot_date && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Historical follower data available since {xAnalyticsData.follower_earliest_snapshot_date}
                  </p>
                )}
              </div>
            </div>
            )}
          </motion.div>

          {/* Engagement Rate Chart: real data from x_daily_snapshots when available */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary stroke-[1.75]" />
                Engagement Rate
              </h3>
              <div className="flex gap-2">
                {(["7D", "30D", "90D"] as const).map((range) => (
                  <button
                    key={range}
                    type="button"
                    onClick={() => setTimePeriod(range)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === timePeriod
                        ? "bg-accent text-primary border border-border"
                        : "text-muted-foreground hover:text-foreground border border-border"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Coverage: {typeof xAnalyticsData?.engagement_data_coverage_days === "number" && typeof xAnalyticsData?.window_days === "number"
                ? `${xAnalyticsData.engagement_data_coverage_days}/${xAnalyticsData.window_days} days`
                : "—"}
            </p>

            {typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {timePeriod === "7D" ? "No posts in the last 7 days." : "No posts in the selected period."}
                </p>
                <button
                  type="button"
                  onClick={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
                  disabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {rebuildLoading ? "Starting…" : "Refresh data"}
                </button>
              </div>
            ) : typeof xAnalyticsData?.tweet_count_window === "number" &&
              xAnalyticsData.tweet_count_window > 0 &&
              typeof xAnalyticsData?.engagement_data_coverage_days === "number" &&
              xAnalyticsData.engagement_data_coverage_days <= 2 ? (
              <div className="py-8 px-4 rounded-xl border border-border bg-muted/20">
                <p className="text-sm font-medium text-foreground mb-2">Summary</p>
                <p className="text-sm text-muted-foreground">
                  Active days: {xAnalyticsData.engagement_data_coverage_days} / {xAnalyticsData.window_days ?? periodDays} · Posts: {xAnalyticsData.tweet_count_window}
                </p>
                {typeof xAnalyticsData?.engagement_rate_pct === "number" && (
                  <p className="text-sm text-muted-foreground mt-1">
                    Engagement rate (window): {xAnalyticsData.engagement_rate_pct.toFixed(1)}%
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-3">Not enough activity for a trend chart yet.</p>
              </div>
            ) : engagementRatePoints.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">
                No data in this period.
              </p>
            ) : (
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-border">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ bottom: `${i * 25}%` }} />
                  ))}
                  {engagementRatePoints.map((p, i) => {
                    const val = p.engagement_pct;
                    const valid = engagementRatePoints.map((x) => x.engagement_pct).filter((x): x is number => x != null && Number.isFinite(x));
                    const max = valid.length ? Math.max(...valid, 0.01) : 5;
                    const heightPct = val != null && Number.isFinite(val) ? (val / max) * 100 : 0;
                    return (
                      <motion.div
                        key={p.date}
                        className="flex-1 min-w-[4px] rounded-t-md bg-gradient-to-t from-chart-2 to-chart-2/70 border-t border-chart-1/50 relative group"
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {p.date}: {val != null && Number.isFinite(val) ? `${val.toFixed(1)}%` : "—"}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                  <span>{engagementRatePoints[0]?.date ?? ""}</span>
                  <span>{engagementRatePoints[engagementRatePoints.length - 1]?.date ?? ""}</span>
                </div>
                {typeof xAnalyticsData?.engagement_data_coverage_days === "number" && xAnalyticsData.engagement_data_coverage_days <= 1 && xAnalyticsData.engagement_data_coverage_days > 0 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Only {xAnalyticsData.engagement_data_coverage_days} active day{xAnalyticsData.engagement_data_coverage_days === 1 ? "" : "s"} in this period.
                  </p>
                )}
                {typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window >= 3 && xAnalyticsData.tweet_count_window < 5 && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Low posting activity during selected period
                  </p>
                )}
              </div>
            </div>
            )}
          </motion.div>

          {/* Posting Cadence Chart: real data from x_daily_snapshots (tweets_count) when available */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-card to-muted/20 backdrop-blur-xl p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary stroke-[1.75]" />
                Posting Cadence ({timePeriod})
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              Posts in window: {typeof xAnalyticsData?.tweet_count_window === "number" ? xAnalyticsData.tweet_count_window : "—"}
            </p>

            {typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window === 0 ? (
              <div className="py-10 text-center">
                <p className="text-sm text-muted-foreground mb-4">
                  {timePeriod === "7D" ? "No posts in the last 7 days." : "No posts in the selected period."}
                </p>
                <button
                  type="button"
                  onClick={() => triggerRebuild(dataStatus?.rollup_updated_at ?? null)}
                  disabled={rebuildLoading || rebuildJob?.status === "queued" || rebuildJob?.status === "running"}
                  className="px-4 py-2 rounded-lg text-sm font-medium border border-border bg-card text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
                >
                  {rebuildLoading ? "Starting…" : "Refresh data"}
                </button>
              </div>
            ) : typeof xAnalyticsData?.tweet_count_window === "number" && xAnalyticsData.tweet_count_window <= 2 ? (
              <div className="py-8 px-4 rounded-xl border border-border bg-muted/20">
                <p className="text-sm font-medium text-foreground mb-1">Posts in window: {xAnalyticsData.tweet_count_window}</p>
                <p className="text-sm text-muted-foreground">
                  Cadence: {(xAnalyticsData.tweet_count_window / (xAnalyticsData.window_days ?? periodDays)).toFixed(1)} posts/day
                </p>
                <p className="text-xs text-muted-foreground mt-2">Not enough activity for a trend chart yet.</p>
              </div>
            ) : postingCadencePoints.length === 0 ? (
              <p className="text-sm text-muted-foreground py-8">
                No data in this period.
              </p>
            ) : (
            <div className="flex gap-3">
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-border">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-border/50" style={{ bottom: `${i * 25}%` }} />
                  ))}
                  {postingCadencePoints.map((p, i) => {
                    const posts = p.posts ?? 0;
                    const max = Math.max(...postingCadencePoints.map((x) => x.posts ?? 0), 1);
                    const heightPct = (posts / max) * 100;
                    const d = p.date ? new Date(p.date) : null;
                    const isWeekend = d ? (d.getDay() === 6 || d.getDay() === 0) : false;
                    return (
                      <motion.div
                        key={p.date}
                        className={`flex-1 min-w-[4px] rounded-t-md bg-gradient-to-t border-t relative group ${
                          isWeekend ? "from-chart-3 to-chart-3/80 border-border" : "from-chart-4 to-chart-4/80 border-border"
                        }`}
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {p.date}: {posts} posts {isWeekend ? "(Weekend)" : ""}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
                  <span>{postingCadencePoints[0]?.date ?? ""}</span>
                  <span>{postingCadencePoints[postingCadencePoints.length - 1]?.date ?? ""}</span>
                </div>
              </div>
            </div>
            )}
          </motion.div>
        </div>

        {/* Platform-Specific Notice (for future YouTube/TikTok) */}
        {activePlatform !== "x" && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-accent to-muted backdrop-blur-xl p-8 text-center"
          >
            <Zap className="w-12 h-12 text-primary mx-auto mb-4 stroke-[1.75]" />
            <h3 className="text-xl font-bold text-foreground mb-2 flex items-center justify-center gap-2">
              {activePlatform === "youtube" ? "YouTube" : "TikTok"} Analytics <FeatureStatusBadge status="coming-soon" />
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              We're building {activePlatform === "youtube" ? "YouTube" : "TikTok"} integration with the same
              signals-first approach. Stay tuned!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}