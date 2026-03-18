/**
 * GET /api/social/x/insights?username=...
 * Full payload (top followers, feed, mentions, series) — profile owner or CRON_SECRET only.
 * Public/cross-user callers use GET /api/social/insights (snapshot-only).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { buildSocialXInsightsPayload, type SocialInsightsResponse } from "@/lib/buildSocialXInsightsPayload";
import { resolveViewerUserId, isCronAuthorized } from "@/lib/resolveViewerUserId";
import { fail } from "@/lib/api-response";

export type {
  SocialInsightsResponse,
  SocialInsightsProfile,
  SocialInsightsSeriesPoint,
  CacheBucketMeta,
} from "@/lib/buildSocialXInsightsPayload";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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
    return NextResponse.json({ error: "Not configured" }, { status: 503 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey);
  const { data: profileRow } = await supabase
    .from("public_profile_view")
    .select("id")
    .or(`username.ilike.${username},twitter_username.ilike.${username}`)
    .maybeSingle();

  const profileId = (profileRow as { id: string } | null)?.id;
  if (!profileId) {
    const empty: SocialInsightsResponse = {
      profile: { username, followers: null, following: null, tweets: null, joinedAt: null },
      series: { followers: [], score: [] },
      topFollowersByTier: { influencers: [], projects: [], funds: [] },
      mentionsLastWeek: [],
      affiliatedAccounts: [],
      accountFeed: { actions: [], newFollowers: [] },
      recommendedAccounts: [],
      meta: {
        cache: {
          topFollowers: { status: "miss", updatedAt: null },
          feed: { status: "miss", updatedAt: null },
          mentions: { status: "miss", updatedAt: null },
        },
      },
    };
    return NextResponse.json(empty);
  }

  const viewerId = await resolveViewerUserId(request);
  const cronOk = isCronAuthorized(request);
  if (!cronOk && viewerId !== profileId) {
    return fail(
      "INSIGHTS_OWNER_ONLY",
      "Full X insights are only available to the profile owner. Use GET /api/social/insights for public snapshot data.",
      403
    );
  }

  const payload = await buildSocialXInsightsPayload(supabase, username);
  return NextResponse.json(payload);
}
