"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
  ProfileHeaderCard,
  ScoreCard,
  scoreToTier,
  SocialGraphCard,
  TopFollowersCard,
  AccountFeedCard,
  MentionsCard,
  AffiliatedAccountsCard,
  RecommendedAccountsCard,
  EmptyStateCard,
} from "./profile-dashboard";
import type { SocialGraphDataPoint } from "./profile-dashboard";
import type { ScoreBreakdownRow } from "./profile-dashboard";
import { Bot, BarChart3 } from "lucide-react";
import { computeLinkaryPower } from "@/lib/linkaryScore";

interface ProfileDashboardPageProps {
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

interface SocialInsightsResponse {
  profile: { username: string; followers: number | null; following: number | null; tweets: number | null; joinedAt: string | null };
  topFollowersByTier: { influencers: unknown[]; projects: unknown[]; funds: unknown[] };
  mentionsLastWeek: unknown[];
  affiliatedAccounts: unknown[];
  accountFeed: { actions: unknown[]; newFollowers: unknown[] };
  recommendedAccounts: unknown[];
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

export default function ProfileDashboardPage({ setRoute, me, username, getAuthHeaders }: ProfileDashboardPageProps) {
  const isOwn = !username || (me && (me.username?.toLowerCase() === username.toLowerCase() || me.twitter_username?.toLowerCase().replace(/^@/, "") === username.toLowerCase().replace(/^@/, "")));
  const targetUsername = isOwn ? (me?.username ?? me?.twitter_username ?? "").replace(/^@/, "").toLowerCase() : username?.replace(/^@/, "").toLowerCase();

  const [meStats, setMeStats] = useState<MeStatsResponse | null>(null);
  const [analyticsX, setAnalyticsX] = useState<AnalyticsXResponse | null>(null);
  const [insights, setInsights] = useState<SocialInsightsResponse | null>(null);
  const [publicDto, setPublicDto] = useState<{ display_name?: string | null; username?: string | null; bio?: string | null; avatar_url?: string | null; linkaryPower?: number | null; analytics?: { snapshot?: { followers?: number | null } | null } } | null>(null);
  const [loading, setLoading] = useState(true);
  const [graphSeries, setGraphSeries] = useState({ followers: true, score: true, influencers: false, projects: false, vc: false });
  const [topFollowersTab, setTopFollowersTab] = useState("influencers");
  const [accountFeedTab, setAccountFeedTab] = useState<"actions" | "newFollowers">("actions");
  const [seeAllModalOpen, setSeeAllModalOpen] = useState(false);
  const [recommended, setRecommended] = useState<Array<{ id: string; name: string; username: string; avatar_url: string | null; url?: string }>>([]);

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
          fetch(`${origin}/api/social/x/insights?username=${encodeURIComponent(targetUsername || "")}`, { headers }),
        ]);
        const statsData = statsRes.ok ? await statsRes.json() : null;
        const analyticsData = analyticsRes.ok ? await analyticsRes.json() : null;
        const insightsData = insightsRes.ok ? await insightsRes.json() : null;
        setMeStats(statsData);
        setAnalyticsX(analyticsData);
        setInsights(insightsData);
        setPublicDto(null);
      } else if (targetUsername) {
        const [dtoRes, insightsRes, searchRes] = await Promise.all([
          fetch(`${origin}/api/public/profile/${encodeURIComponent(targetUsername)}`),
          fetch(`${origin}/api/social/x/insights?username=${encodeURIComponent(targetUsername)}`),
          fetch(`${origin}/api/search?q=${encodeURIComponent(targetUsername)}&filter=people`).catch(() => null),
        ]);
        const dto = dtoRes.ok ? await dtoRes.json() : null;
        const insightsData = insightsRes.ok ? await insightsRes.json() : null;
        setPublicDto(dto);
        setInsights(insightsData);
        setMeStats(null);
        setAnalyticsX(null);
        if (searchRes?.ok) {
          const searchData = await searchRes.json();
          const results = (searchData.results ?? []).slice(0, 3).map((r: { id: string; name: string; handleLabel?: string; url?: string; avatar?: string }) => ({
            id: r.id,
            name: r.name || (r.handleLabel ?? "").replace(/^@/, "") || "",
            username: (r.handleLabel ?? "").replace(/^@/, "") || (r.url ?? "").replace(/^\//, "") || r.id,
            avatar_url: r.avatar ?? null,
            url: r.url,
          }));
          setRecommended(results);
        } else {
          setRecommended([]);
        }
      }
    } catch (e) {
      console.error("[ProfileDashboard] fetch error", e);
    } finally {
      setLoading(false);
    }
  }, [isOwn, me?.id, targetUsername, getAuthHeaders]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const displayName = isOwn ? (me?.display_name ?? null) : (publicDto?.display_name ?? null);
  const bio = isOwn ? (me?.bio ?? null) : (publicDto?.bio ?? null);
  const avatarUrl = isOwn ? (me?.avatar_url ?? null) : (publicDto?.avatar_url ?? null);
  const reputationIndex = isOwn ? (meStats?.reputationIndex ?? 0) : (publicDto?.linkaryPower ?? 0);
  const verifiedGigsCount = meStats?.verifiedGigsCount ?? 0;
  const insightsProfile = insights?.profile;
  const breakdown = isOwn
    ? buildBreakdown(meStats, me ?? null)
    : (publicDto?.linkaryPower != null ? [{ label: "Overall score", value: publicDto.linkaryPower, max: 100 }] : []);
  const tips = isOwn ? buildTips(meStats, me ?? null) : [];
  const tierLabel = scoreToTier(isOwn ? (meStats?.reputationIndex ?? 0) : (publicDto?.linkaryPower ?? 0));

  const chartData: SocialGraphDataPoint[] = [];
  if (analyticsX?.snapshots?.length) {
    analyticsX.snapshots.forEach((s) => {
      chartData.push({
        date: s.snapshot_date?.slice(0, 10) ?? "",
        followers: s.followers_total ?? undefined,
        score: meStats?.reputationIndex ?? undefined,
      });
    });
  }
  if (chartData.length === 0 && meStats?.reputationIndex != null) {
    chartData.push({ date: new Date().toISOString().slice(0, 10), score: meStats.reputationIndex });
  }

  const topFollowersItems = insights?.topFollowersByTier
    ? (insights.topFollowersByTier[topFollowersTab as keyof typeof insights.topFollowersByTier] ?? []) as Array<{ username: string; display_name: string | null; avatar_url: string | null; followers: number | null }>
    : [];

  if (loading && !meStats && !publicDto && !insights) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <p className="text-sm text-white/50">Loading dashboard…</p>
      </div>
    );
  }

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
        watchlistButton={
          <button
            type="button"
            className="rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm font-medium text-white/80 hover:bg-white/15 disabled:opacity-50"
            disabled
          >
            Watchlist
          </button>
        }
      />

      <ScoreCard
        reputationIndex={reputationIndex}
        tierLabel={tierLabel}
        breakdown={breakdown}
        verifiedGigsLabel={isOwn ? `Verified gigs: ${verifiedGigsCount}` : "Data pending"}
        tips={tips}
      />

      <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/8 to-white/[0.03] p-6">
        <h3 className="text-sm font-semibold text-white/90">Bot followers</h3>
        <EmptyStateCard title="Coming soon" message="No blur, no gating." icon={<Bot className="h-10 w-10" />} className="mt-3 border-0 bg-transparent p-0" />
      </div>

      <SocialGraphCard
        data={chartData}
        seriesEnabled={graphSeries}
        onToggleSeries={(key) => setGraphSeries((prev) => ({ ...prev, [key]: !prev[key] }))}
      />

      <TopFollowersCard
        tabs={[
          { id: "influencers", label: "Influencers" },
          { id: "projects", label: "Projects" },
          { id: "funds", label: "Funds" },
        ]}
        activeTab={topFollowersTab}
        onTabChange={setTopFollowersTab}
        items={topFollowersItems}
        sampleLabel={topFollowersItems.length > 0 ? "Sample" : null}
        onSeeAll={() => setSeeAllModalOpen(true)}
        emptyMessage="Nothing here yet"
      />

      <AccountFeedCard
        activeTab={accountFeedTab}
        onTabChange={setAccountFeedTab}
        actions={insights?.accountFeed?.actions ?? []}
        newFollowers={insights?.accountFeed?.newFollowers ?? []}
        emptyMessage="Coming soon (twitterapi.io feed)"
      />

      <MentionsCard mentions={insights?.mentionsLastWeek ?? []} emptyMessage="Coming soon (twitterapi.io mentions)" />

      <AffiliatedAccountsCard accounts={insights?.affiliatedAccounts ?? []} emptyMessage="Nothing here yet" />

      <RecommendedAccountsCard
        accounts={recommended}
        onAccountClick={(u) => setRoute({ name: "profileDashboard", data: { username: u } })}
        emptyMessage="Nothing here yet"
      />

      {seeAllModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={() => setSeeAllModalOpen(false)}>
          <div className="max-h-[80vh] w-full max-w-md overflow-auto rounded-2xl border border-white/10 bg-slate-900 p-6 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-white/90">Top followers</h3>
            <p className="mt-2 text-xs text-white/50">Nothing here yet</p>
            <button type="button" className="mt-4 rounded-lg bg-white/10 px-3 py-2 text-sm text-white/80 hover:bg-white/15" onClick={() => setSeeAllModalOpen(false)}>
              Close
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
