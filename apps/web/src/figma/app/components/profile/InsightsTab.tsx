"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ProfileHeaderCard,
  ScoreCard,
  scoreToTier,
  SocialGraphCard,
  TopFollowersCard,
  AffiliatedAccountsCard,
  RecommendedAccountsCard,
  EmptyStateCard,
} from "../profile-dashboard";
import type { SocialGraphDataPoint } from "../profile-dashboard";
import type { ScoreBreakdownRow } from "../profile-dashboard";
import { BarChart3 } from "lucide-react";
import { computeLinkaryPower } from "@/lib/linkaryScore";

export interface InsightsTabProps {
  setRoute: (r: { name: string; data?: Record<string, unknown>; handle?: string }) => void;
  me: { id: string; username?: string | null; display_name?: string | null; bio?: string | null; avatar_url?: string | null; followers_total?: number | null; avg_engagement_rate?: number | null; created_at?: string | null; twitter_username?: string | null } | null;
  username?: string;
  getAuthHeaders?: () => Promise<HeadersInit>;
}

interface MeStatsResponse {
  reputationIndex?: number;
  socialPower?: number;
  ethos?: number | null;
  xscore?: number | null;
  reviews?: { avg: number; count: number };
  verifiedGigsCount?: number;
}

interface AnalyticsXResponse {
  snapshots?: Array<{ snapshot_date: string; followers_total: number | null; tweets_count?: number | null; engagement_rate?: number | null }>;
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

export default function InsightsTab({ setRoute, me, username, getAuthHeaders }: InsightsTabProps) {
  const isOwn = !username || (me && (me.username?.toLowerCase() === username.toLowerCase() || me.twitter_username?.toLowerCase().replace(/^@/, "") === username.toLowerCase().replace(/^@/, "")));
  const targetUsername = isOwn ? (me?.username ?? me?.twitter_username ?? "").replace(/^@/, "").toLowerCase() : username?.replace(/^@/, "").toLowerCase();

  const [meStats, setMeStats] = useState<MeStatsResponse | null>(null);
  const [analyticsX, setAnalyticsX] = useState<AnalyticsXResponse | null>(null);
  const [insights, setInsights] = useState<SocialInsightsResponse | null>(null);
  const [publicDto, setPublicDto] = useState<{ display_name?: string | null; username?: string | null; bio?: string | null; avatar_url?: string | null; linkaryPower?: number | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphSeries, setGraphSeries] = useState({ followers: true, score: true, influencers: false, projects: false, vc: false });
  const [topFollowersTab, setTopFollowersTab] = useState("influencers");
  const [seeAllModalOpen, setSeeAllModalOpen] = useState(false);
  const [recommended, setRecommended] = useState<Array<{ id: string; name: string; username: string; avatar_url: string | null; url?: string }>>([]);
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

  const fetchData = useCallback(async () => {
    if (!targetUsername && !isOwn) {
      setLoading(false);
      return;
    }
    setLoading(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const headers = getAuthHeaders ? await getAuthHeaders() : {};
    try {
      if (isOwn && me?.id) {
        const [statsRes, analyticsRes, insightsRes] = await Promise.all([
          fetch(`${origin}/api/profile/me-stats`, { headers }),
          fetch(`${origin}/api/analytics/x`, { headers }),
          fetch(`${origin}/api/social/insights?provider=x&username=${encodeURIComponent(targetUsername || "")}`, { headers }),
        ]);
        const statsData = statsRes.ok ? await statsRes.json() : null;
        const analyticsData = analyticsRes.ok ? await analyticsRes.json() : null;
        const insightsData = insightsRes.ok ? await insightsRes.json() : null;
        setMeStats(statsData);
        setAnalyticsX(analyticsData);
        setInsights(normalizeInsightsResponse(insightsData));
        setPublicDto(null);
        if (insightsData?.recommendedAccounts?.length) {
          setRecommended(
            (insightsData.recommendedAccounts as Array<{ id: string; name: string; username: string; avatar_url?: string | null }>).map((r) => ({
              id: r.id,
              name: r.name ?? r.username ?? "",
              username: r.username ?? "",
              avatar_url: r.avatar_url ?? null,
            }))
          );
        } else setRecommended([]);
      } else if (targetUsername) {
        const [dtoRes, insightsRes, searchRes] = await Promise.all([
          fetch(`${origin}/api/public/profile/${encodeURIComponent(targetUsername)}`),
          fetch(`${origin}/api/social/insights?provider=x&username=${encodeURIComponent(targetUsername)}`),
          fetch(`${origin}/api/search?q=${encodeURIComponent(targetUsername)}&filter=people`).catch(() => null),
        ]);
        const dto = dtoRes.ok ? await dtoRes.json() : null;
        const insightsData = insightsRes.ok ? await insightsRes.json() : null;
        setPublicDto(dto);
        setInsights(normalizeInsightsResponse(insightsData));
        setMeStats(null);
        setAnalyticsX(null);
        if (insightsData?.recommendedAccounts?.length) {
          setRecommended(
            (insightsData.recommendedAccounts as Array<{ id: string; name: string; username: string; avatar_url?: string | null }>).map((r) => ({
              id: r.id,
              name: r.name ?? r.username ?? "",
              username: r.username ?? "",
              avatar_url: r.avatar_url ?? null,
            }))
          );
        } else if (searchRes?.ok) {
          const searchData = await searchRes.json();
          const results = (searchData.results ?? []).slice(0, 3).map((r: { id: string; name: string; handleLabel?: string; url?: string; avatar?: string }) => ({
            id: r.id,
            name: r.name || (r.handleLabel ?? "").replace(/^@/, "") || "",
            username: (r.handleLabel ?? "").replace(/^@/, "") || (r.url ?? "").replace(/^\//, "") || r.id,
            avatar_url: r.avatar ?? null,
            url: r.url,
          }));
          setRecommended(results);
        } else setRecommended([]);
      }
    } catch (e) {
      console.error("[InsightsTab] fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [isOwn, me?.id, targetUsername, getAuthHeaders]);

  const handleRefreshInsights = useCallback(async () => {
    if (!getAuthHeaders || refreshDisabled || !targetUsername) return;
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
        await fetchData();
      }
    } finally {
      setRefreshLoading(false);
    }
  }, [getAuthHeaders, refreshDisabled, targetUsername, fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayName = isOwn ? (me?.display_name ?? null) : (publicDto?.display_name ?? null);
  const bio = isOwn ? (me?.bio ?? null) : (publicDto?.bio ?? null);
  const avatarUrl = isOwn ? (me?.avatar_url ?? null) : (publicDto?.avatar_url ?? null);
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
  if (chartData.length === 0 && analyticsX?.snapshots?.length) {
    analyticsX.snapshots.forEach((s: { snapshot_date?: string; followers_total?: number | null }) => {
      chartData.push({ date: s.snapshot_date?.slice(0, 10) ?? "", followers: s.followers_total ?? undefined, score: meStats?.reputationIndex ?? undefined });
    });
  }
  if (chartData.length === 0 && meStats?.reputationIndex != null) {
    chartData.push({ date: new Date().toISOString().slice(0, 10), score: meStats.reputationIndex });
  }

  const topFollowersItems = insights?.topFollowersByTier
    ? (insights.topFollowersByTier[topFollowersTab as keyof typeof insights.topFollowersByTier] ?? []) as Array<{ username: string; display_name: string | null; avatar_url: string | null; followers: number | null }>
    : [];

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

  if (loading && !meStats && !publicDto && !insights) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <p className="text-sm font-medium text-foreground">Loading insights…</p>
      </div>
    );
  }

  const island = "rounded-2xl border border-border bg-card shadow-sm overflow-hidden";

  return (
    <div className="space-y-6 pb-10">
      <ProfileHeaderCard
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
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card px-4 py-3 shadow-sm">
          <button
            type="button"
            onClick={handleRefreshInsights}
            disabled={refreshDisabled}
            className="rounded-lg border border-border bg-secondary px-3 py-2 text-sm font-medium text-foreground hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed"
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

      {/* Row 1: Linkary Score | Top Followers */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          <ScoreCard
            reputationIndex={reputationIndex}
            tierLabel={tierLabel}
            breakdown={breakdown}
            verifiedGigsLabel={isOwn ? `Verified gigs: ${verifiedGigsCount}` : "Data pending"}
            tips={tips}
          />
        </div>
        <div className={island}>
          <TopFollowersCard
            tabs={[{ id: "influencers", label: "Influencers" }, { id: "projects", label: "Projects" }, { id: "funds", label: "Funds" }]}
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

      {/* Row 2: Social Graph | Insights Summary */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          <SocialGraphCard
            data={chartData}
            seriesEnabled={graphSeries}
            onToggleSeries={(key) => setGraphSeries((prev) => ({ ...prev, [key]: !prev[key] }))}
          />
        </div>
        <div className={`${island} p-6`}>
          <h3 className="text-sm font-semibold text-foreground">Insights summary</h3>
          <dl className="mt-4 space-y-3">
            <div>
              <dt className="text-xs font-semibold text-foreground">Followers</dt>
              <dd className="mt-0.5 text-lg font-semibold text-foreground">
                {insightsProfile?.followers != null ? insightsProfile.followers.toLocaleString() : me?.followers_total != null ? me.followers_total.toLocaleString() : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">Connected X</dt>
              <dd className="mt-0.5 text-sm text-foreground">
                {isOwn && me?.twitter_username?.trim() ? `@${me.twitter_username.replace(/^@/, "")}` : isOwn ? "Not connected" : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">Data health</dt>
              <dd className="mt-1 flex flex-wrap gap-2">
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${topStatus === "hit" ? "bg-emerald-100 text-emerald-800" : topStatus === "stale" ? "bg-amber-100 text-amber-800" : "bg-secondary text-foreground"}`}>
                  Top followers: {topStatus ?? "—"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${feedStatus === "hit" ? "bg-emerald-100 text-emerald-800" : feedStatus === "stale" ? "bg-amber-100 text-amber-800" : "bg-secondary text-foreground"}`}>
                  Feed: {feedStatus ?? "—"}
                </span>
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${mentionsStatus === "hit" ? "bg-emerald-100 text-emerald-800" : mentionsStatus === "stale" ? "bg-amber-100 text-amber-800" : "bg-secondary text-foreground"}`}>
                  Mentions: {mentionsStatus ?? "—"}
                </span>
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold text-foreground">Last updated</dt>
              <dd className="mt-0.5 text-sm font-medium text-foreground">
                {formatRelative(cacheTop?.updatedAt ?? null)}
                {cacheTop?.updatedAt ? " (top followers)" : ""}
                {!cacheTop?.updatedAt && !cacheFeed?.updatedAt && !cacheMentions?.updatedAt ? "No cache yet" : ""}
              </dd>
            </div>
          </dl>
          <p className="mt-3 text-xs font-medium text-foreground">Mentions & account feed coming later.</p>
        </div>
      </div>

      {/* Row 3: Affiliated Accounts | Recommended Accounts */}
      <div className="grid gap-6 lg:grid-cols-2">
        <div className={island}>
          <AffiliatedAccountsCard accounts={insights?.affiliatedAccounts ?? []} emptyMessage="Nothing here yet" />
        </div>
        <div className={island}>
          <RecommendedAccountsCard
            accounts={recommended}
            onAccountClick={(u) => setRoute({ name: "profile", data: { username: u, tab: "insights" } })}
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
