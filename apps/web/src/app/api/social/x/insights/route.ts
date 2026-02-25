/**
 * GET /api/social/x/insights?username=...
 * Social insights for profile dashboard. Stable contract for future twitterapi.io integration.
 * MVP: fill profile from existing profile + analytics; other sections empty with TODO for twitterapi.io.
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

export interface SocialInsightsResponse {
  profile: SocialInsightsProfile;
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
    .select("username, twitter_username, followers_total, created_at")
    .or(`username.ilike.${username},twitter_username.ilike.${username}`)
    .maybeSingle();

  if (!profileRow) {
    const empty: SocialInsightsResponse = {
      profile: {
        username,
        followers: null,
        following: null,
        tweets: null,
        joinedAt: null,
      },
      topFollowersByTier: { influencers: [], projects: [], funds: [] },
      mentionsLastWeek: [],
      affiliatedAccounts: [],
      accountFeed: { actions: [], newFollowers: [] },
      recommendedAccounts: [],
    };
    return NextResponse.json(empty);
  }

  const p = profileRow as {
    username: string | null;
    twitter_username: string | null;
    followers_total: number | null;
    created_at: string | null;
  };

  const handle = (p.username ?? p.twitter_username ?? "").toString().replace(/^@/, "").toLowerCase();

  // Following/tweets: not on public_profile_view. TODO: twitterapi.io integration later (cached tables + fetch routes).
  let following: number | null = null;
  let tweets: number | null = null;

  const profile: SocialInsightsProfile = {
    username: handle,
    followers: typeof p.followers_total === "number" ? p.followers_total : null,
    following,
    tweets,
    joinedAt: typeof p.created_at === "string" ? p.created_at : null,
  };

  // TODO: topFollowersByTier, mentionsLastWeek, affiliatedAccounts, accountFeed, recommendedAccounts — fill from twitterapi.io / cached tables when integrated.
  const response: SocialInsightsResponse = {
    profile,
    topFollowersByTier: {
      influencers: [],
      projects: [],
      funds: [],
    },
    mentionsLastWeek: [],
    affiliatedAccounts: [],
    accountFeed: { actions: [], newFollowers: [] },
    recommendedAccounts: [],
  };

  return NextResponse.json(response);
}
