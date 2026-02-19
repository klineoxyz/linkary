import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: X analytics for current user from DB only (no twitterapi.io). */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const [profileRes, rollupRes, driversRes, baselineRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("followers_total, avg_engagement_rate, x_last_profile_sync_at, x_last_tweets_sync_at, x_sync_status")
      .eq("id", user.id)
      .maybeSingle(),
    supabase.from("x_analytics_rollups").select("*").eq("profile_id", user.id).maybeSingle(),
    supabase
      .from("x_top_drivers")
      .select("tweet_id, tweeted_at, like_count, reply_count, repost_count, engagement_score")
      .eq("profile_id", user.id)
      .eq("window_days", 30)
      .order("engagement_score", { ascending: false })
      .limit(10),
    supabase
      .from("profile_analytics_baseline")
      .select("baseline_at, baseline_date, followers_total, engagement_rate_proxy, posts_30d, avg_likes_30d, avg_replies_30d, reach_proxy_30d")
      .eq("profile_id", user.id)
      .eq("platform", "x")
      .maybeSingle(),
  ]);

  const profile = profileRes.data as {
    followers_total?: number;
    avg_engagement_rate?: number;
    x_last_profile_sync_at?: string | null;
    x_last_tweets_sync_at?: string | null;
    x_sync_status?: string | null;
  } | null;
  const rollup = rollupRes.data as Record<string, unknown> | null;
  const topDrivers = (driversRes.data ?? []) as Array<{
    tweet_id: string;
    tweeted_at: string | null;
    like_count: number;
    reply_count: number;
    repost_count: number;
    engagement_score: number;
  }>;
  const baseline = baselineRes.data as {
    baseline_at?: string;
    baseline_date?: string;
    followers_total?: number | null;
    engagement_rate_proxy?: number | null;
    posts_30d?: number | null;
    avg_likes_30d?: number | null;
    avg_replies_30d?: number | null;
    reach_proxy_30d?: number | null;
  } | null;

  return NextResponse.json({
    profile: profile ?? {},
    rollup: rollup ?? null,
    topDrivers,
    baseline: baseline ?? null,
  });
}
