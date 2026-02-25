/**
 * GET /api/social/x/insights?username=...
 * Social insights for profile dashboard. Filled from public_profile_view + x_daily_snapshots.
 * Optional: caches (x_top_followers_cache, etc.) when Phase 4 is active.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export interface SocialInsightsProfile {
  username: string;
  followers: number | null;
  following: number | null;
  tweets: number | null;
  joinedAt: string | null;
}

export interface SocialInsightsTopFollower {
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  followers: number | null;
  tier?: string;
}

export interface SocialInsightsSeriesPoint {
  date: string;
  value: number;
}

export interface SocialInsightsResponse {
  profile: SocialInsightsProfile;
  series: {
    followers: SocialInsightsSeriesPoint[];
    score: SocialInsightsSeriesPoint[];
  };
  topFollowersByTier: {
    influencers: SocialInsightsTopFollower[];
    projects: SocialInsightsTopFollower[];
    funds: SocialInsightsTopFollower[];
  };
  mentionsLastWeek: unknown[];
  affiliatedAccounts: unknown[];
  accountFeed: {
    actions: unknown[];
    newFollowers: unknown[];
  };
  recommendedAccounts: unknown[];
}

function norm(s: string): string {
  return s.trim().toLowerCase().replace(/^@/, "");
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const usernameParam = searchParams.get("username")?.trim();
  if (!usernameParam) {
    return NextResponse.json({ error: "username is required" }, { status: 400 });
  }

  const username = norm(usernameParam);
  if (!username) {
    return NextResponse.json({ error: "Invalid username" }, { status: 400 });
  }

  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json(
      { error: "Not configured" },
      { status: 503 }
    );
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);

  const { data: profileRow } = await supabase
    .from("public_profile_view")
    .select("id, username, twitter_username, followers_total, xscore, created_at")
    .or(`username.ilike.${username},twitter_username.ilike.${username}`)
    .maybeSingle();

  const p = profileRow as {
    id: string;
    username: string | null;
    twitter_username: string | null;
    followers_total: number | null;
    xscore: number | null;
    created_at: string | null;
  };

  if (!p?.id) {
    const empty: SocialInsightsResponse = {
      profile: {
        username,
        followers: null,
        following: null,
        tweets: null,
        joinedAt: null,
      },
      series: { followers: [], score: [] },
      topFollowersByTier: { influencers: [], projects: [], funds: [] },
      mentionsLastWeek: [],
      affiliatedAccounts: [],
      accountFeed: { actions: [], newFollowers: [] },
      recommendedAccounts: [],
    };
    return NextResponse.json(empty);
  }

  const handle = (p.username ?? p.twitter_username ?? "").toString().replace(/^@/, "").toLowerCase();
  const profileId = p.id;

  // Last 90 days of x_daily_snapshots for series + latest for profile pills
  const { data: snapshotRows } = await supabase
    .from("x_daily_snapshots")
    .select("day, followers, tweets_count")
    .eq("owner_type", "profile")
    .eq("owner_id", profileId)
    .order("day", { ascending: false })
    .limit(90);

  const snapshots = (snapshotRows ?? []) as Array<{
    day: string;
    followers: number | null;
    tweets_count: number | null;
  }>;
  const latestSnapshot = snapshots[0];
  const followersFromSnapshot =
    latestSnapshot?.followers != null && Number.isFinite(latestSnapshot.followers)
      ? latestSnapshot.followers
      : null;
  const tweetsFromSnapshot =
    latestSnapshot?.tweets_count != null && Number.isFinite(latestSnapshot.tweets_count)
      ? latestSnapshot.tweets_count
      : null;

  let following: number | null = null;
  const profile: SocialInsightsProfile = {
    username: handle,
    followers: followersFromSnapshot ?? (typeof p.followers_total === "number" ? p.followers_total : null),
    following,
    tweets: tweetsFromSnapshot,
    joinedAt: typeof p.created_at === "string" ? p.created_at : null,
  };

  const seriesFollowers: SocialInsightsSeriesPoint[] = snapshots
    .map((s) => ({
      date: s.day?.slice(0, 10) ?? "",
      value: typeof s.followers === "number" && Number.isFinite(s.followers) ? s.followers : 0,
    }))
    .filter((d) => d.date)
    .reverse();

  const scoreProxy = p.xscore != null && Number.isFinite(Number(p.xscore)) ? Number(p.xscore) : null;
  const seriesScore: SocialInsightsSeriesPoint[] =
    seriesFollowers.length > 0 && scoreProxy != null
      ? seriesFollowers.map((f) => ({ date: f.date, value: scoreProxy }))
      : [];

  const recommendedAccounts: Array<{ id: string; name: string; username: string; avatar_url: string | null }> = [];
  const { data: otherProfiles } = await supabase
    .from("public_profile_view")
    .select("id, username, display_name, avatar_url")
    .neq("id", profileId)
    .not("username", "is", null)
    .order("username", { ascending: true })
    .limit(5);
  if (otherProfiles?.length) {
    for (const row of otherProfiles as Array<{ id: string; username: string | null; display_name: string | null; avatar_url: string | null }>) {
      const u = (row.username ?? "").toString().replace(/^@/, "").toLowerCase();
      if (u) {
        recommendedAccounts.push({
          id: row.id,
          name: (row.display_name ?? u) as string,
          username: u,
          avatar_url: row.avatar_url ?? null,
        });
      }
    }
  }

  const response: SocialInsightsResponse = {
    profile,
    series: { followers: seriesFollowers, score: seriesScore },
    topFollowersByTier: {
      influencers: [],
      projects: [],
      funds: [],
    },
    mentionsLastWeek: [],
    affiliatedAccounts: [],
    accountFeed: { actions: [], newFollowers: [] },
    recommendedAccounts,
  };

  return NextResponse.json(response);
}
