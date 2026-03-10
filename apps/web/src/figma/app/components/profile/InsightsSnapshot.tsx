"use client";

import React, { useState, useEffect, useCallback } from "react";
import useSWR from "swr";
import {
  ProfileHeaderCard,
  ScoreCard,
  scoreToTier,
  SocialGraphCard,
  TopFollowersCard,
  TopFollowersByScoreTiersCard,
  AffiliatedAccountsCard,
  RecommendedAccountsCard,
  EmptyStateCard,
} from "../profile-dashboard";
import { TrustStrip } from "@/components/TrustStrip";
import type { SocialGraphDataPoint } from "../profile-dashboard";
import type { ScoreBreakdownRow } from "../profile-dashboard";
import { BarChart3 } from "lucide-react";
import { computeLinkaryPower } from "@/lib/linkaryScore";
import { authFetcher, SWR_DEDUP_MS } from "@/lib/swrAuthFetcher";
import { EthosPill } from "@/components/EthosPill";

const DEDUP_MS = 60_000;

export interface InsightsSnapshotProps {
  setRoute: (r: { name: string; data?: Record<string, unknown>; handle?: string }) => void;
  me: { id: string; username?: string | null; display_name?: string | null; bio?: string | null; avatar_url?: string | null; followers_total?: number | null; avg_engagement_rate?: number | null; created_at?: string | null; twitter_username?: string | null } | null;
  username?: string;
  getAuthHeaders?: () => Promise<HeadersInit>;
  /** When true, show only score/snapshot and link to /analytics (no duplicate deep analytics). */
  snapshotOnly?: boolean;
}

interface MeStatsResponse {
  reputationIndex?: number;
  socialPower?: number;
  ethos?: number | null;
  xscore?: number | null;
  reviews?: { avg: number; count: number };
  verifiedGigsCount?: number;
}

interface CacheBucketMeta {
  status: "hit" | "miss" | "stale";
  updatedAt: string | null;
}

interface SocialInsightsResponse {
  profile: { username: string; followers: number | null; following: number | null; tweets?: number | null; posts?: number | null; joinedAt: string | null };
  series?: { followers: Array<{ date: string; value: number }>; score: Array<{ date: string; value: number }> };
  topFollowersByTier: { influencers: unknown[]; projects: unknown[]; funds: unknown[] };
  mentionsLastWeek: unknown[];
  affiliatedAccounts: unknown[];
  accountFeed: { actions: unknown[]; newFollowers: unknown[] };
  recommendedAccounts?: unknown[];
  meta?: {
    cache?: {
      topFollowers?: CacheBucketMeta | { status: string; updatedAt?: string | null };
      feed?: CacheBucketMeta | { status: string; updatedAt?: string | null };
      mentions?: CacheBucketMeta | { status: string; updatedAt?: string | null };
    };
  };
}

function buildBreakdown(
  meStats: MeStatsResponse | null,
  profile: { followers_total?: number | null; avg_engagement_rate?: number | null } | null
): ScoreBreakdownRow[] {
  const ethos = meStats?.ethos ?? 0;
  const xscore = meStats?.xscore ?? 0;
  const followers = profile?.followers_total ?? 0;
  const engagementRate = profile?.avg_engagement_rate != null ? (profile.avg_engagement_rate > 1 ? profile.avg_engagement_rate / 100 : profile.avg_engagement_rate) : 0;
  const reviewsCount = meStats?.reviews?.count ?? 0;
  const ratingAvg = meStats?.reviews?.avg ?? 0;
  const verifiedGigs = meStats?.verifiedGigsCount ?? 0;
  const input = {
    ethosScore: ethos,
    xscore,
    followers: followers || undefined,
    engagementRate: engagementRate || undefined,
    verifiedReviewsCount: reviewsCount,
    ratingAvg: reviewsCount > 0 ? ratingAvg : undefined,
    verifiedGigsCount: verifiedGigs,
  };
  const { breakdown } = computeLinkaryPower(input);
  return [
    { label: "Followers", value: Math.round(breakdown.followerAuthority ?? 0), max: 100 },
    { label: "Engagement", value: Math.round(breakdown.engagement ?? 0), max: 100 },
    { label: "Verified gigs", value: Math.round(breakdown.verifiedGigs ?? 0), max: 100 },
    { label: "Reviews", value: Math.round(breakdown.reviews ?? 0), max: 100 },
    { label: "Influence", value: Math.round(breakdown.ethos ?? 0 + (breakdown.xscore ?? 0) / 2), max: 100 },
  ];
}

function buildTips(meStats: MeStatsResponse | null, profile: { twitter_username?: string | null; followers_total?: number | null } | null): string[] {
  const tips: string[] = [];
  if (!profile?.twitter_username?.trim()) tips.push("Connect X to unlock analytics and score components.");
  if ((meStats?.verifiedGigsCount ?? 0) === 0) tips.push("Complete a deal to add verified gigs to your score.");
  if ((meStats?.reviews?.count ?? 0) === 0) tips.push("Get verified reviews from completed collaborations.");
  return tips.slice(0, 3);
}

function normalizeInsightsResponse(data: SocialInsightsResponse | null): SocialInsightsResponse | null {
  if (!data?.profile) return data;
  const p = data.profile as { tweets?: number | null; posts?: number | null; [k: string]: unknown };
  const profile = { ...data.profile, tweets: p.tweets ?? p.posts ?? null } as SocialInsightsResponse["profile"];
  const cache = data.meta?.cache;
  type Status = "hit" | "miss" | "stale";
  const toBucket = (v: CacheBucketMeta | { status: string; updatedAt?: string | null } | undefined): CacheBucketMeta | undefined =>
    v && typeof v === "object" && "status" in v
      ? { status: (v.status === "hit" || v.status === "miss" || v.status === "stale" ? v.status : "miss") as Status, updatedAt: (v as { updatedAt?: string | null }).updatedAt ?? null }
      : undefined;
  return {
    ...data,
    profile,
    recommendedAccounts: data.recommendedAccounts ?? [],
    meta: cache
      ? {
          cache: {
            topFollowers: toBucket(cache.topFollowers) ?? { status: "miss" as const, updatedAt: null },
            feed: toBucket(cache.feed) ?? { status: "miss" as const, updatedAt: null },
            mentions: toBucket(cache.mentions) ?? { status: "miss" as const, updatedAt: null },
          },
        }
      : data.meta,
  } as SocialInsightsResponse;
}

async function publicFetcher(path: string): Promise<unknown> {
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const res = await fetch(`${base}${path}`);
  if (!res.ok) return null;
  return res.json();
}

export default function InsightsSnapshot({ setRoute, me, username, getAuthHeaders, snapshotOnly = false }: InsightsSnapshotProps) {
  const isOwn = !username || (me && (me.username?.toLowerCase() === username.toLowerCase() || me.twitter_username?.toLowerCase().replace(/^@/, "") === username.toLowerCase().replace(/^@/, "")));
  const targetUsername = isOwn ? (me?.username ?? me?.twitter_username ?? "").replace(/^@/, "").toLowerCase() : username?.replace(/^@/, "").toLowerCase();

  const swrOpts = { revalidateOnFocus: false, dedupingInterval: DEDUP_MS };

  const { data: meStatsData } = useSWR<MeStatsResponse | null>(
    isOwn && me?.id ? "/api/profile/me-stats" : null,
    authFetcher as (url: string) => Promise<MeStatsResponse | null>,
    { ...swrOpts, dedupingInterval: SWR_DEDUP_MS }
  );

  const insightsKey = targetUsername ? `/api/social/insights?provider=x&username=${encodeURIComponent(targetUsername)}` : null;
  const { data: insightsRaw, mutate: mutateInsights } = useSWR<SocialInsightsResponse | null>(
    insightsKey,
    publicFetcher as (url: string) => Promise<SocialInsightsResponse | null>,
    swrOpts
  );
  const insights = normalizeInsightsResponse(insightsRaw ?? null);

  const publicProfileKey = !isOwn && targetUsername ? `/api/public/profile/${encodeURIComponent(targetUsername)}` : null;
  const { data: publicDto } = useSWR<{ display_name?: string | null; username?: string | null; bio?: string | null; avatar_url?: string | null; linkaryPower?: number | null } | null>(
    publicProfileKey,
    publicFetcher as (url: string) => Promise<{ display_name?: string | null; username?: string | null; bio?: string | null; avatar_url?: string | null; linkaryPower?: number | null } | null>,
    swrOpts
  );

  const [graphSeries, setGraphSeries] = useState({ followers: true, score: true, influencers: false, projects: false, vc: false });
  const [topFollowersTab, setTopFollowersTab] = useState("influencers");
  const [affiliatedAmbassadorTab, setAffiliatedAmbassadorTab] = useState<"affiliated" | "ambassador">("affiliated");
  const [seeAllModalOpen, setSeeAllModalOpen] = useState(false);
  const [watchlistList, setWatchlistList] = useState<{ people: Array<{ entity_id: string }>; orgs: Array<{ entity_id: string }> } | null>(null);
  const [profileEntityIdForOther, setProfileEntityIdForOther] = useState<string | null>(null);
  const [watchlistToggling, setWatchlistToggling] = useState(false);
  const [lastRefreshAt, setLastRefreshAt] = useState<number>(0);
  const [refreshResetAt, setRefreshResetAt] = useState<string | null>(null);
  const [refreshLoading, setRefreshLoading] = useState(false);

  const COOLDOWN_MS = 5 * 60 * 1000;
  const isRefreshCooldown = lastRefreshAt > 0 && Date.now() - lastRefreshAt < COOLDOWN_MS;
  const isRefreshRateLimited = refreshResetAt != null && Date.now() < new Date(refreshResetAt).getTime();
  const refreshDisabled = refreshLoading || isRefreshCooldown || isRefreshRateLimited;

  const profileEntityId = isOwn ? (me?.id ?? null) : profileEntityIdForOther;
  const onWatchlist = watchlistList && profileEntityId ? watchlistList.people.some((p) => p.entity_id === profileEntityId) : false;

  const fetchWatchlistList = useCallback(async () => {
    if (!getAuthHeaders) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const headers = await getAuthHeaders();
    const res = await fetch(`${origin}/api/watchlist/list`, { headers });
    if (res.ok) {
      const data = await res.json();
      setWatchlistList({ people: data?.people ?? [], orgs: data?.orgs ?? [] });
    } else setWatchlistList(null);
  }, [getAuthHeaders]);

  useEffect(() => {
    if (me && getAuthHeaders) fetchWatchlistList();
    else setWatchlistList(null);
  }, [me, getAuthHeaders, fetchWatchlistList]);

  useEffect(() => {
    if (!getAuthHeaders || isOwn || !targetUsername) {
      setProfileEntityIdForOther(null);
      return;
    }
    let cancelled = false;
    (async () => {
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      const headers = await getAuthHeaders();
      const res = await fetch(`${origin}/api/watchlist/resolve?entity_type=profile&username=${encodeURIComponent(targetUsername)}`, { headers });
      if (cancelled) return;
      if (res.ok) {
        const data = await res.json();
        const id = data?.entity_id;
        setProfileEntityIdForOther(typeof id === "string" ? id : null);
      } else setProfileEntityIdForOther(null);
    })();
    return () => { cancelled = true; };
  }, [getAuthHeaders, isOwn, targetUsername]);

  const handleToggleWatchlist = useCallback(async () => {
    if (!profileEntityId || !getAuthHeaders || watchlistToggling) return;
    setWatchlistToggling(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`${origin}/api/watchlist/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers as Record<string, string>) },
        body: JSON.stringify({ entity_type: "profile", entity_id: profileEntityId }),
      });
      if (res.ok) await fetchWatchlistList();
    } finally {
      setWatchlistToggling(false);
    }
  }, [profileEntityId, getAuthHeaders, watchlistToggling, fetchWatchlistList]);

  const handleRefreshInsights = useCallback(async () => {
    if (!getAuthHeaders || refreshDisabled || !targetUsername || !isOwn) return;
    setRefreshLoading(true);
    setRefreshResetAt(null);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const headers = await getAuthHeaders();
    try {
      const res = await fetch(`${origin}/api/profile/refresh-x-insights`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(headers as Record<string, string>) },
      });
      const body = await res.json().catch(() => ({}));
      if (res.ok && body.ok) {
        setLastRefreshAt(Date.now());
        if (body.skipped && (body.reason === "GLOBAL_RATE_LIMIT" || body.reason === "RATE_LIMITED") && body.resetAt) setRefreshResetAt(body.resetAt);
        await mutateInsights();
      }
    } finally {
      setRefreshLoading(false);
    }
  }, [getAuthHeaders, refreshDisabled, targetUsername, isOwn, mutateInsights]);

  const recommended = (insights?.recommendedAccounts ?? []).length
    ? (insights!.recommendedAccounts as Array<{ id: string; name: string; username: string; avatar_url?: string | null }>).map((r) => ({
        id: r.id,
        name: r.name ?? r.username ?? "",
        username: r.username ?? "",
        avatar_url: r.avatar_url ?? null,
      }))
    : [];

  const displayName = isOwn ? (me?.display_name ?? null) : (publicDto?.display_name ?? null);
  const bio = isOwn ? (me?.bio ?? null) : (publicDto?.bio ?? null);
  const avatarUrl = isOwn ? (me?.avatar_url ?? null) : (publicDto?.avatar_url ?? null);
  const meStats = meStatsData ?? null;
  const reputationIndex = isOwn ? (meStats?.reputationIndex ?? 0) : (publicDto?.linkaryPower ?? 0);
  const verifiedGigsCount = meStats?.verifiedGigsCount ?? 0;
  const insightsProfile = insights?.profile;
  const breakdown = isOwn ? buildBreakdown(meStats, me ?? null) : (publicDto?.linkaryPower != null ? [{ label: "Overall score", value: publicDto.linkaryPower, max: 100 }] : []);
  const tips = isOwn ? buildTips(meStats, me ?? null) : [];
  const tierLabel = scoreToTier(isOwn ? (meStats?.reputationIndex ?? 0) : (publicDto?.linkaryPower ?? 0));

  const chartData: SocialGraphDataPoint[] = [];
  const insightsSeries = insights?.series;
  if (insightsSeries?.followers?.length || insightsSeries?.score?.length) {
    const dateSet = new Set<string>();
    (insightsSeries.followers ?? []).forEach((p: { date: string }) => dateSet.add(p.date));
    (insightsSeries.score ?? []).forEach((p: { date: string }) => dateSet.add(p.date));
    const dates = [...dateSet].sort();
    const followersByDate = new Map<string, number>((insightsSeries.followers ?? []).map((p: { date: string; value: number }) => [p.date, p.value]));
    const scoreByDate = new Map<string, number>((insightsSeries.score ?? []).map((p: { date: string; value: number }) => [p.date, p.value]));
    dates.forEach((date) => chartData.push({ date, followers: followersByDate.get(date), score: scoreByDate.get(date) }));
  }

  const topFollowersItems = insights?.topFollowersByTier
    ? (insights.topFollowersByTier[topFollowersTab as keyof typeof insights.topFollowersByTier] ?? []) as Array<{ username: string; display_name: string | null; avatar_url: string | null; followers: number | null }>
    : [];
  const allTopFollowersForTiers = React.useMemo(() => {
    const t = insights?.topFollowersByTier;
    if (!t) return [];
    const inf = (Array.isArray(t.influencers) ? t.influencers : []) as Array<{ username?: string; display_name?: string | null; avatar_url?: string | null; followers?: number | null; tier?: string | null; score?: number | null }>;
    const proj = (Array.isArray(t.projects) ? t.projects : []) as Array<{ username?: string; display_name?: string | null; avatar_url?: string | null; followers?: number | null; tier?: string | null; score?: number | null }>;
    const funds = (Array.isArray(t.funds) ? t.funds : []) as Array<{ username?: string; display_name?: string | null; avatar_url?: string | null; followers?: number | null; tier?: string | null; score?: number | null }>;
    return [...inf, ...proj, ...funds];
  }, [insights?.topFollowersByTier]);

  const cacheTop = insights?.meta?.cache?.topFollowers && typeof insights.meta.cache.topFollowers === "object" ? insights.meta.cache.topFollowers : undefined;
  const cacheFeed = insights?.meta?.cache?.feed && typeof insights.meta.cache.feed === "object" ? insights.meta.cache.feed : undefined;
  const cacheMentions = insights?.meta?.cache?.mentions && typeof insights.meta.cache.mentions === "object" ? insights.meta.cache.mentions : undefined;
  const topStatus = cacheTop?.status as "hit" | "miss" | "stale" | undefined;
  const feedStatus = cacheFeed?.status as "hit" | "miss" | "stale" | undefined;
  const mentionsStatus = cacheMentions?.status as "hit" | "miss" | "stale" | undefined;

  function formatRelative(iso: string | null | undefined): string {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      if (isNaN(d.getTime())) return "—";
      const sec = Math.floor((Date.now() - d.getTime()) / 1000);
      if (sec < 60) return "just now";
      if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
      if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
      if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
      return d.toLocaleDateString();
    } catch {
      return "—";
    }
  }

  const loading = (insightsKey && insightsRaw === undefined) || (isOwn && me?.id && meStatsData === undefined) || (publicProfileKey && publicDto === undefined);
  if (loading && !meStats && !publicDto && !insights) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-foreground">Loading insights…</p>
      </div>
    );
  }

  const island = "rounded-2xl border border-border bg-card shadow-sm overflow-hidden";

  const xHandleForStrip = isOwn && me?.twitter_username?.trim()
    ? `@${me.twitter_username.replace(/^@/, "")}`
    : (publicDto && targetUsername ? `@${targetUsername}` : null);

  if (snapshotOnly) {
    return (
      <div className="space-y-6 pb-10">
        <ProfileHeaderCard
          variant="light"
          displayName={displayName ?? null}
          username={targetUsername ? `@${targetUsername}` : "@"}
          bio={bio}
          avatarUrl={avatarUrl}
          followers={insightsProfile?.followers ?? me?.followers_total ?? null}
          following={insightsProfile?.following ?? null}
          tweets={insightsProfile?.tweets ?? null}
          joinedAt={insightsProfile?.joinedAt ?? me?.created_at ?? null}
          onWatchlist={me && profileEntityId ? onWatchlist : undefined}
          onToggleWatchlist={me && profileEntityId ? handleToggleWatchlist : undefined}
        />
        <TrustStrip
          score={reputationIndex ?? null}
          tierLabel={tierLabel || null}
          verifiedGigsCount={isOwn ? verifiedGigsCount : undefined}
          reviewsAvg={isOwn && meStats?.reviews?.count ? (meStats.reviews.avg ?? null) : undefined}
          reviewsCount={isOwn && meStats?.reviews ? meStats.reviews.count : undefined}
          xHandle={xHandleForStrip}
          variant="insights"
        />
        <div className={`${island} p-6`}>
          <h3 className="text-sm font-semibold text-foreground mb-2">Credibility snapshot</h3>
          <p className="text-sm text-muted-foreground mb-4">Score and key stats above. For full X analytics, time-series, top followers, and backfill, use the Analytics page.</p>
          <a href="/app/analytics" className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90">
            <BarChart3 className="h-4 w-4" />
            See full analytics
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      <ProfileHeaderCard
        variant="light"
        displayName={displayName ?? null}
        username={targetUsername ? `@${targetUsername}` : "@"}
        bio={bio}
        avatarUrl={avatarUrl}
        followers={insightsProfile?.followers ?? me?.followers_total ?? null}
        following={insightsProfile?.following ?? null}
        tweets={insightsProfile?.tweets ?? null}
        joinedAt={insightsProfile?.joinedAt ?? me?.created_at ?? null}
        onWatchlist={me && profileEntityId ? onWatchlist : undefined}
        onToggleWatchlist={me && profileEntityId ? handleToggleWatchlist : undefined}
      />

      <TrustStrip
        score={reputationIndex ?? null}
        tierLabel={tierLabel || null}
        verifiedGigsCount={isOwn ? verifiedGigsCount : undefined}
        reviewsAvg={isOwn && meStats?.reviews?.count ? (meStats.reviews.avg ?? null) : undefined}
        reviewsCount={isOwn && meStats?.reviews ? meStats.reviews.count : undefined}
        xHandle={xHandleForStrip}
        variant="insights"
      />

      {isOwn && !me?.twitter_username?.trim() && (
        <div className={`${island} p-6`}>
          <h3 className="text-sm font-semibold text-foreground">X insights</h3>
          <EmptyStateCard
            title="Connect X to start insights"
            message="Link your X account in Integrations to see top followers and score here."
            icon={<BarChart3 className="h-10 w-10" />}
            className="mt-3 border-0 bg-transparent p-0"
            actionLabel="Go to Integrations"
            onAction={() => setRoute({ name: "integrations" })}
          />
        </div>
      )}

      {isOwn && me?.twitter_username?.trim() && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm text-foreground">
          <button
            type="button"
            onClick={handleRefreshInsights}
            disabled={refreshDisabled}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-semibold text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {refreshLoading ? "Refreshing…" : isRefreshRateLimited ? "Rate limited" : isRefreshCooldown ? "Refresh (cooldown)" : "Refresh insights"}
          </button>
          {isRefreshRateLimited && refreshResetAt && (
            <span className="text-xs font-medium text-foreground">
              Try again after {new Date(refreshResetAt).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </span>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          <ScoreCard
            variant="light"
            reputationIndex={reputationIndex}
            tierLabel={tierLabel}
            breakdown={breakdown}
            verifiedGigsLabel={isOwn ? `Verified gigs: ${verifiedGigsCount}` : "Data pending"}
            tips={tips}
          />
        </div>
        <div className={island}>
          <TopFollowersCard
            variant="light"
            tabs={[{ id: "influencers", label: "Creators" }, { id: "projects", label: "Projects" }, { id: "funds", label: "Brands" }]}
            activeTab={topFollowersTab}
            onTabChange={setTopFollowersTab}
            items={topFollowersItems}
            sampleLabel={topFollowersItems.length > 0 ? "Sample" : null}
            onSeeAll={() => setSeeAllModalOpen(true)}
            emptyMessage="Nothing here yet"
            cacheStatus={topStatus}
            updatedAt={cacheTop?.updatedAt ?? undefined}
          />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          {chartData.length > 0 ? (
            <SocialGraphCard
              variant="light"
              data={chartData}
              seriesEnabled={graphSeries}
              onToggleSeries={(key) => setGraphSeries((prev) => ({ ...prev, [key]: !prev[key as keyof typeof prev] }))}
            />
          ) : (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-foreground">Social graph</h3>
              <EmptyStateCard
                title="No series data yet"
                message="Insights snapshot uses cached social data only. Connect X and refresh insights, or wait for the next cache update."
                icon={<BarChart3 className="h-10 w-10" />}
                className="mt-3 border-0 bg-transparent p-0"
              />
            </div>
          )}
        </div>
        <div className={island}>
          <TopFollowersByScoreTiersCard variant="light" items={allTopFollowersForTiers} emptyMessage="No top followers data yet. Connect X and refresh insights." />
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          <div className="p-6">
            <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
              <h3 className="text-sm font-semibold text-foreground">Partners</h3>
              <div className="flex rounded-lg border border-border bg-muted/30 p-0.5">
                <button
                  type="button"
                  onClick={() => setAffiliatedAmbassadorTab("affiliated")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${affiliatedAmbassadorTab === "affiliated" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Affiliated
                </button>
                <button
                  type="button"
                  onClick={() => setAffiliatedAmbassadorTab("ambassador")}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${affiliatedAmbassadorTab === "ambassador" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                >
                  Ambassador
                </button>
              </div>
            </div>
            {affiliatedAmbassadorTab === "affiliated" ? (
              <div className="mt-3">
                {(insights?.affiliatedAccounts ?? []).length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border bg-muted/20 px-4 py-6 text-center text-sm text-muted-foreground">Nothing here yet</p>
                ) : (
                  <ul className="space-y-2">
                    {(insights?.affiliatedAccounts ?? []).map((a: unknown, i: number) => (
                      <li key={i} className="rounded-xl bg-secondary border border-border px-3 py-2 text-xs font-medium text-foreground">
                        {JSON.stringify(a)}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center">
                <p className="text-sm font-medium text-foreground">Ambassador programs</p>
                <p className="mt-1 text-xs text-muted-foreground">Nothing here yet. Ambassador relations appear when you join programs.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          <RecommendedAccountsCard
            variant="light"
            accounts={recommended}
            onAccountClick={(u) => setRoute({ name: "userInsights", data: { username: u }, handle: u })}
            emptyMessage="Nothing here yet"
          />
        </div>
      </div>

      {seeAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSeeAllModalOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl border border-border bg-card p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-foreground">Top followers</h3>
            <p className="mt-2 text-xs font-medium text-foreground">Nothing here yet</p>
            <button type="button" className="mt-4 rounded-lg bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent" onClick={() => setSeeAllModalOpen(false)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}
