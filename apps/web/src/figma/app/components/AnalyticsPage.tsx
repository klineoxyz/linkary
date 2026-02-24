import React, { useState, useEffect, useRef } from "react";
import { motion } from "motion/react";
import { supabase } from "@/lib/supabase";
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
  const rebuildPollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const initialSyncTriggered = useRef(false);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const fetchInitStatus = React.useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return null;
    const res = await fetch(`${base}/api/analytics/init-status`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      setInitStatus(json);
      return json as InitStatus;
    }
    return null;
  }, [base]);

  const fetchXAnalytics = React.useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const [res, summaryRes] = await Promise.all([
      fetch(`${base}/api/analytics/x`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${base}/api/analytics/x/summary`, { headers: { Authorization: `Bearer ${token}` } }),
    ]);
    if (res.ok) {
      const json = await res.json().catch(() => ({}));
      setXAnalyticsData({
        profile: json.profile ?? {},
        rollup: json.rollup ?? null,
        topDrivers: json.topDrivers ?? [],
        baseline: json.baseline ?? null,
        snapshots: Array.isArray(json.snapshots) ? json.snapshots : [],
        source: json.source ?? "fallback",
        freshness: json.freshness ?? undefined,
      });
    }
    if (summaryRes.ok) {
      const sum = await summaryRes.json().catch(() => ({}));
      setWindowSummary({ windows: sum.windows ?? {}, is_backfilling: !!sum.is_backfilling });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchXAnalytics();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [fetchXAnalytics]);

  useEffect(() => {
    fetchInitStatus();
  }, [fetchInitStatus]);

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

  const triggerRebuild = React.useCallback(async () => {
    setRebuildError(null);
    setRebuildLoading(true);
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
  }, [base, rebuildJob?.id, rebuildJob?.status, fetchXAnalytics]);

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

  const baseline = xAnalyticsData?.baseline ?? null;
  const bNum = (v: unknown) => (typeof v === "number" && !Number.isNaN(v) ? v : 0);
  const baselineFollowers = baseline ? bNum(baseline.followers_total) : 0;
  const baselineEngagement = baseline ? bNum(baseline.engagement_rate_proxy) : 0;
  const baselinePosts30 = baseline ? bNum(baseline.posts_30d) : 0;
  const baselineLikes30 = baseline ? bNum(baseline.avg_likes_30d) : 0;
  const baselineReplies30 = baseline ? bNum(baseline.avg_replies_30d) : 0;
  const baselineReach30 = baseline ? bNum(baseline.reach_proxy_30d) : 0;
  const pctSince = (current: number, base: number): string | undefined => {
    if (base === 0 || !Number.isFinite(base)) return undefined;
    const pct = ((current - base) / base) * 100;
    const sign = pct >= 0 ? "+" : "";
    return `${sign}${pct.toFixed(1)}% since joining`;
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
  const snapshotsForFollowerChart = snapshotsWithFilledFollowers.length >= 2 ? snapshotsWithFilledFollowers : snapshotsAsc;
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
  // Last 30 days of daily data for cadence and engagement charts (date -> value)
  const dayMap = (() => {
    const map = new Map<string, { posts: number; engagementPct: number | null }>();
    const today = new Date();
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dayStr = d.toISOString().slice(0, 10);
      map.set(dayStr, { posts: 0, engagementPct: null });
    }
    snapshotsAsc.forEach((s) => {
      const posts = typeof s.tweets_count === "number" && Number.isFinite(s.tweets_count) ? s.tweets_count : 0;
      let engagementPct: number | null = null;
      if (typeof s.engagement_rate === "number" && Number.isFinite(s.engagement_rate)) {
        engagementPct = s.engagement_rate;
      } else if (
        typeof s.likes_received === "number" &&
        Number.isFinite(s.likes_received) &&
        typeof s.tweets_count === "number" &&
        s.tweets_count > 0
      ) {
        // rough proxy: likes / tweets (no follower denominator)
        engagementPct = (s.likes_received / s.tweets_count) * 100;
      }
      if (map.has(s.snapshot_date)) map.set(s.snapshot_date, { posts, engagementPct });
    });
    return map;
  })();
  const last30DaysOrdered = Array.from(dayMap.entries()).sort((a, b) => a[0].localeCompare(b[0]));
  const cadenceValues = last30DaysOrdered.map(([, v]) => v.posts);
  const engagementValues = last30DaysOrdered.map(([, v]) => v.engagementPct);
  const hasCadenceData = cadenceValues.some((n) => n > 0);
  const hasEngagementChartData = engagementValues.some((v) => v != null && Number.isFinite(v));
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

  // Real deltas from baseline for rollup-backed KPIs (when we have both rollup and baseline)
  const engagementDelta30 = baselineEngagement > 0 && Number.isFinite(engagementRateByPeriod)
    ? ((engagementRateByPeriod - baselineEngagement) / baselineEngagement) * 100
    : null;
  const likesDelta30 = baselineLikes30 > 0 && Number.isFinite(avgLikesByPeriod)
    ? ((avgLikesByPeriod - baselineLikes30) / baselineLikes30) * 100
    : null;
  const repliesDelta30 = baselineReplies30 > 0 && Number.isFinite(avgRepliesByPeriod)
    ? ((avgRepliesByPeriod - baselineReplies30) / baselineReplies30) * 100
    : null;
  const postsDelta30 = baselinePosts30 > 0 && Number.isFinite(postsByPeriod)
    ? ((postsByPeriod - baselinePosts30) / baselinePosts30) * 100
    : null;
  const reachDelta30 = baselineReach30 > 0 && Number.isFinite(reachProxyByPeriod)
    ? ((reachProxyByPeriod - baselineReach30) / baselineReach30) * 100
    : null;

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
      delta7D: 0,
      delta30D: engagementDelta30 ?? 0,
      delta90D: 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && baselineEngagement >= 0 ? pctSince(engagementRateByPeriod, baselineEngagement || 0.01) : undefined,
    },
    {
      id: "likes",
      label: "Avg Likes/Post",
      value: xAnalyticsData ? String(Math.round(avgLikesByPeriod)) : "—",
      delta7D: 0,
      delta30D: likesDelta30 ?? 0,
      delta90D: 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && (baselineLikes30 > 0 || avgLikesByPeriod > 0) ? pctSince(avgLikesByPeriod, baselineLikes30 || 1) : undefined,
    },
    {
      id: "replies",
      label: "Avg Replies/Post",
      value: xAnalyticsData ? String(Math.round(avgRepliesByPeriod)) : "—",
      delta7D: 0,
      delta30D: repliesDelta30 ?? 0,
      delta90D: 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && (baselineReplies30 > 0 || avgRepliesByPeriod > 0) ? pctSince(avgRepliesByPeriod, baselineReplies30 || 1) : undefined,
    },
    {
      id: "frequency",
      label: `Posts (${periodLabel})`,
      value: xAnalyticsData ? String(postsByPeriod) : "—",
      delta7D: 0,
      delta30D: postsDelta30 ?? 0,
      delta90D: 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && (baselinePosts30 > 0 || postsByPeriod > 0) ? pctSince(postsByPeriod, baselinePosts30 || 1) : undefined,
    },
    {
      id: "reach",
      label: "Reach Proxy",
      value: xAnalyticsData
        ? (reachProxyByPeriod >= 1e6 ? `${(reachProxyByPeriod / 1e6).toFixed(1)}M` : reachProxyByPeriod >= 1e3 ? `${(reachProxyByPeriod / 1e3).toFixed(1)}K` : String(Math.round(reachProxyByPeriod)))
        : "—",
      delta7D: 0,
      delta30D: reachDelta30 ?? 0,
      delta90D: 0,
      signal: "good",
      insight: rollup ? "From rollup for selected period" : "Sync from Integrations to see trends",
      sparklineData: undefined,
      sinceJoining: baseline && (baselineReach30 > 0 || reachProxyByPeriod > 0) ? pctSince(reachProxyByPeriod, baselineReach30 || 1) : undefined,
    },
  ];

  const hasRealInsights = Boolean(rollup || hasRealFollowerHistory);
  const signals: Signal[] = hasRealInsights
    ? []
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
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-700 hover:text-gray-900 transition-all group"
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
                onClick={() => triggerRebuild()}
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
        {rebuildJob && (rebuildJob.status === "queued" || rebuildJob.status === "running" || rebuildJob.status === "done" || rebuildJob.status === "failed") && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 flex flex-wrap items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2 text-sm">
              <span className="text-gray-600">Rebuild status:</span>
              <span className="font-medium capitalize">{rebuildJob.status}</span>
              {rebuildJob.updated_at && (
                <span className="text-xs text-gray-500">
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
                onClick={() => triggerRebuild()}
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
          className="sticky top-0 z-40 rounded-3xl border border-white/10 bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-xl p-6"
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
                    <h1 className="text-2xl font-bold text-gray-900">{viewingEntity}</h1>
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
                              ? "bg-white/10 text-gray-900 border border-white/20"
                              : "text-gray-600 hover:text-gray-900 border border-transparent"
                          }`}
                        >
                          <option.icon className="w-3 h-3 stroke-[1.75]" />
                          {option.label}
                        </button>
                      ))}
                    </div>
                    
                    {/* Last Synced + Refresh */}
                    <div className="flex items-center gap-2 text-xs text-gray-600">
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
                        ? "text-gray-600 hover:text-gray-900 border border-white/10 hover:border-white/20"
                        : "text-gray-500 border border-white/5 cursor-not-allowed"
                    }`}
                  >
                    {platform.id === "x" ? (
                      <span className="text-base font-bold text-gray-900" aria-label="X">𝕏</span>
                    ) : (
                      platform.icon && <platform.icon className="w-4 h-4 stroke-[1.75]" />
                    )}
                    {platform.label}
                    {!platform.active && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-white/5 text-gray-500">Soon</span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 1.5: Search (brands: public profiles or approved/applicants) */}
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 pt-2 border-t border-white/10">
              <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-xl bg-white/5 border border-white/10 focus-within:border-white/20 transition-colors">
                <Search className="w-4 h-4 text-gray-500 stroke-[1.75]" />
                <input
                  type="search"
                  placeholder={entityType === "creator" ? "Search your analytics…" : "Search public profiles or approved applicants…"}
                  className="flex-1 min-w-0 bg-transparent text-sm text-gray-900 placeholder:text-gray-500 focus:outline-none"
                  aria-label="Search profiles"
                />
              </div>
              {entityType !== "creator" && (
                <p className="text-xs text-gray-500">
                  Brands can search all public profiles or limit to users who approved access or applied to your project.
                </p>
              )}
            </div>

            {/* Row 2: Global Time Period Selector */}
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-gray-600">Time Period:</span>
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
                        : "bg-white/5 border border-white/10 text-gray-600 hover:text-gray-900 hover:border-white/20"
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

            return (
              <motion.div
                key={kpi.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.05 }}
                className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6 hover:border-white/20 transition-all group"
              >
                {/* Signal Badge */}
                <div className={`absolute top-4 right-4 flex items-center gap-1.5 px-2 py-1 rounded-full border bg-gradient-to-r ${signalStyle.bg} ${signalStyle.border}`}>
                  <SignalIcon className={`w-3 h-3 ${signalStyle.text} stroke-[1.75]`} />
                  <span className={`text-xs font-medium ${signalStyle.text} capitalize`}>
                    {kpi.signal}
                  </span>
                </div>

                {/* Label */}
                <p className="text-sm font-medium text-gray-600 mb-2">{kpi.label}</p>

                {/* Value */}
                <div className="flex items-end gap-3 mb-3">
                  <h3 className="text-4xl font-bold text-gray-900">{kpi.value}</h3>
                  <div className="flex items-center gap-1 mb-2">
                    {isPositive ? (
                      <TrendingUp className="w-4 h-4 text-primary stroke-[1.75]" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-muted-foreground stroke-[1.75]" />
                    )}
                    <span className={`text-sm font-semibold ${isPositive ? "text-primary" : "text-muted-foreground"}`}>
                      {isPositive ? "+" : ""}{delta}%
                    </span>
                  </div>
                </div>

                {/* Delta Toggle */}
                <div className="flex items-center gap-2 mb-3">
                  <button
                    onClick={() => setTimePeriod("7D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "7D"
                        ? "bg-white/10 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    7D
                  </button>
                  <button
                    onClick={() => setTimePeriod("30D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "30D"
                        ? "bg-white/10 text-white"
                        : "text-gray-700 hover:text-gray-900"
                    }`}
                  >
                    30D
                  </button>
                  <button
                    onClick={() => setTimePeriod("90D")}
                    className={`px-2 py-1 rounded-md text-xs font-medium transition-all ${
                      timePeriod === "90D"
                        ? "bg-white/10 text-white"
                        : "text-gray-700 hover:text-gray-900"
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
                <p className="text-xs text-gray-600 leading-relaxed">{kpi.insight}</p>
                {kpi.sinceJoining && (
                  <p className="text-xs text-primary mt-2 font-medium">{kpi.sinceJoining}</p>
                )}
              </motion.div>
            );
          })}
        </div>

        {/* Data freshness: tweets, snapshots, aggregates */}
        {activePlatform === "x" && (
          <div className="text-xs text-gray-600 flex flex-wrap items-center gap-x-4 gap-y-1">
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

        {/* C) Signals Feed (Primary Section) */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8"
        >
          <div className="flex items-center gap-3 mb-6">
            <Sparkles className="w-6 h-6 text-primary stroke-[1.75]" />
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Signals</h2>
              <p className="text-sm text-gray-600 mt-1">
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
                    <div className="p-2 rounded-xl bg-white/10 border border-white/20 flex-shrink-0">
                      <SignalIcon className={`w-5 h-5 ${signalStyle.text} stroke-[1.75]`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-gray-900 font-semibold mb-2 leading-relaxed">{signal.title}</h3>
                      <div className="flex items-center justify-between">
                        <p className={`text-sm ${signalStyle.text} font-medium`}>{signal.metric}</p>
                        {signal.timestamp && (
                          <p className="text-xs text-gray-500">{signal.timestamp}</p>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-gray-600 group-hover:text-gray-900 group-hover:translate-x-1 transition-all flex-shrink-0 stroke-[1.75]" />
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
          className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-8"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <Target className="w-6 h-6 text-primary stroke-[1.75]" />
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Top Drivers (30D)</h2>
                <p className="text-sm text-gray-600 mt-1">
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
                <tr className="border-b border-white/10">
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Date
                  </th>
                  <th className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Type
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Likes
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Replies
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    Reposts
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
                    ER %
                  </th>
                  <th className="text-right text-xs font-semibold text-gray-600 uppercase tracking-wider pb-3">
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
                    className="border-b border-white/5 hover:bg-white/5 transition-colors group"
                  >
                    <td className="py-4 text-sm text-gray-900 font-medium">
                      {driver.date}{driver.time ? ` · ${driver.time}` : ""}
                    </td>
                    <td className="py-4">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium border ${getPostTypeColor(driver.postType)}`}>
                        {driver.postType.charAt(0).toUpperCase() + driver.postType.slice(1)}
                      </span>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <Heart className="w-3.5 h-3.5 text-primary stroke-[1.75]" />
                        {driver.likes.toLocaleString()}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-700">
                      <div className="flex items-center justify-end gap-1.5">
                        <MessageSquare className="w-3.5 h-3.5 text-primary stroke-[1.75]" />
                        {driver.replies}
                      </div>
                    </td>
                    <td className="py-4 text-right text-sm text-gray-700">
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
            <p className="text-sm text-gray-600 py-6">
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
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-primary stroke-[1.75]" />
                Follower Growth
              </h3>
              <div className="flex gap-2">
                {["7D", "30D", "90D"].map((range) => (
                  <button
                    key={range}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === timePeriod
                        ? "bg-accent text-primary border border-border"
                        : "text-gray-600 hover:text-gray-900 border border-white/10"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {snapshotsForFollowerChart.length >= 2 ? (
            <div className="flex gap-3">
              <div className="flex flex-col justify-between text-xs text-gray-500 py-2">
                {(() => {
                  const vals = snapshotsForFollowerChart.map((s) => Number(s.followers_total ?? 0));
                  const max = Math.max(...vals, 1);
                  return [1, 0.75, 0.5, 0.25, 0].map((pct) => Math.round(max * pct).toLocaleString());
                })()}
              </div>
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-0.5 border-l border-b border-white/10">
                  {snapshotsForFollowerChart.map((s, i) => {
                    const val = Number(s.followers_total ?? 0);
                    const max = Math.max(...snapshotsForFollowerChart.map((x) => Number(x.followers_total ?? 0)), 1);
                    const heightPct = (val / max) * 100;
                    return (
                      <motion.div
                        key={s.snapshot_date}
                        className="flex-1 min-w-[4px] rounded-t-md bg-gradient-to-t from-chart-1/80 to-chart-1/40 border-t border-chart-1/50 relative group"
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.3, delay: i * 0.02 }}
                        title={`${s.snapshot_date}: ${val.toLocaleString()}`}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                          {s.snapshot_date}: {val.toLocaleString()}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  <span>{snapshotsForFollowerChart[0]?.snapshot_date ?? ""}</span>
                  <span>{snapshotsForFollowerChart[snapshotsForFollowerChart.length - 1]?.snapshot_date ?? ""}</span>
                </div>
              </div>
            </div>
            ) : (
              <p className="text-sm text-gray-600 py-8">
                Sync from Integrations to see follower growth. Data is collected from the day you connect X.
              </p>
            )}
          </motion.div>

          {/* Engagement Rate Chart: real data from x_daily_snapshots when available */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.55 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Activity className="w-5 h-5 text-primary stroke-[1.75]" />
                Engagement Rate
              </h3>
              <div className="flex gap-2">
                {["7D", "30D", "90D"].map((range) => (
                  <button
                    key={range}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      range === "30D"
                        ? "bg-accent text-primary border border-border"
                        : "text-gray-600 hover:text-gray-900 border border-white/10"
                    }`}
                  >
                    {range}
                  </button>
                ))}
              </div>
            </div>

            {hasEngagementChartData ? (
            <div className="flex gap-3">
              <div className="flex flex-col justify-between text-xs text-gray-500 py-2">
                {(() => {
                  const valid = engagementValues.filter((v): v is number => v != null && Number.isFinite(v));
                  const max = valid.length ? Math.max(...valid, 0.01) : 5;
                  return [1, 0.75, 0.5, 0.25, 0].map((pct) => `${(max * pct).toFixed(1)}%`);
                })()}
              </div>
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-white/10">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-white/5" style={{ bottom: `${i * 25}%` }} />
                  ))}
                  {engagementValues.map((val, i) => {
                    const valid = engagementValues.filter((v): v is number => v != null && Number.isFinite(v));
                    const max = valid.length ? Math.max(...valid, 0.01) : 5;
                    const heightPct = val != null && Number.isFinite(val) ? (val / max) * 100 : 0;
                    return (
                      <motion.div
                        key={last30DaysOrdered[i]?.[0] ?? i}
                        className="flex-1 rounded-t-md bg-gradient-to-t from-chart-2 to-chart-2/70 border-t border-chart-1/50 relative group"
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {last30DaysOrdered[i]?.[0]}: {val != null && Number.isFinite(val) ? `${val.toFixed(1)}%` : "—"}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  <span>{last30DaysOrdered[0]?.[0] ?? "Day 1"}</span>
                  <span>{last30DaysOrdered[29]?.[0] ?? "Day 30"}</span>
                </div>
              </div>
            </div>
            ) : (
              <p className="text-sm text-gray-600 py-8">
                Sync from Integrations and run the backfill to see daily engagement. Data comes from your synced X tweets.
              </p>
            )}
          </motion.div>

          {/* Posting Cadence Chart: real data from x_daily_snapshots (tweets_count) when available */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-white/5 to-white/[0.02] backdrop-blur-xl p-6 lg:col-span-2"
          >
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary stroke-[1.75]" />
                Posting Cadence (30D)
              </h3>
            </div>

            {hasCadenceData ? (
            <div className="flex gap-3">
              <div className="flex flex-col justify-between text-xs text-gray-500 py-2">
                {(() => {
                  const max = Math.max(...cadenceValues, 1);
                  return [1, 0.75, 0.5, 0.25, 0].map((pct) => String(Math.round(max * pct)));
                })()}
              </div>
              <div className="flex-1">
                <div className="relative h-48 flex items-end gap-2 border-l border-b border-white/10">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className="absolute left-0 right-0 border-t border-white/5" style={{ bottom: `${i * 25}%` }} />
                  ))}
                  {cadenceValues.map((posts, i) => {
                    const max = Math.max(...cadenceValues, 1);
                    const heightPct = (posts / max) * 100;
                    const dateStr = last30DaysOrdered[i]?.[0];
                    const d = dateStr ? new Date(dateStr) : null;
                    const isWeekend = d ? (d.getDay() === 6 || d.getDay() === 0) : false;
                    return (
                      <motion.div
                        key={dateStr ?? i}
                        className={`flex-1 rounded-t-md bg-gradient-to-t border-t relative group ${
                          isWeekend ? "from-chart-3 to-chart-3/80 border-border" : "from-chart-4 to-chart-4/80 border-border"
                        }`}
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.02 }}
                      >
                        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-card border border-border rounded text-xs text-foreground opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                          {dateStr}: {posts} posts {isWeekend ? "(Weekend)" : ""}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-2 px-1">
                  <span>{last30DaysOrdered[0]?.[0] ?? "Day 1"}</span>
                  <span>{last30DaysOrdered[29]?.[0] ?? "Day 30"}</span>
                </div>
              </div>
            </div>
            ) : (
              <p className="text-sm text-gray-600 py-8">
                Sync from Integrations and run the backfill to see posting cadence. Data comes from your synced X tweets.
              </p>
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
            <h3 className="text-xl font-bold text-white mb-2 flex items-center justify-center gap-2">
              {activePlatform === "youtube" ? "YouTube" : "TikTok"} Analytics <FeatureStatusBadge status="coming-soon" />
            </h3>
            <p className="text-gray-600 max-w-md mx-auto">
              We're building {activePlatform === "youtube" ? "YouTube" : "TikTok"} integration with the same
              signals-first approach. Stay tuned!
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}