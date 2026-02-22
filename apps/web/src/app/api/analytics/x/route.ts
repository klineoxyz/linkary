import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** GET: X analytics for current user. Uses x_daily_snapshots + x_window_aggregates (worker backfill); falls back to legacy tables. */
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

  const [profileRes, legacyRollupRes, driversRes, baselineRes, legacySnapshotsRes, dailySnapshotsRes, windowAggsRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("followers_total, avg_engagement_rate, x_last_profile_sync_at, x_last_tweets_sync_at, x_sync_status, twitter_username, analytics_initialized_at")
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
    supabase
      .from("analytics_snapshots")
      .select("day, metrics")
      .eq("owner_type", "profile")
      .eq("owner_id", user.id)
      .eq("platform", "x")
      .eq("window_days", 1)
      .order("day", { ascending: false })
      .limit(90),
    supabase
      .from("x_daily_snapshots")
      .select("day, followers")
      .eq("owner_type", "profile")
      .eq("owner_id", user.id)
      .order("day", { ascending: false })
      .limit(90),
    supabase
      .from("x_window_aggregates")
      .select("*")
      .eq("owner_type", "profile")
      .eq("owner_id", user.id)
      .in("window_days", [7, 30, 90])
      .order("as_of", { ascending: false }),
  ]);

  const profile = profileRes.data as {
    followers_total?: number;
    avg_engagement_rate?: number;
    x_last_profile_sync_at?: string | null;
    x_last_tweets_sync_at?: string | null;
    x_sync_status?: string | null;
    twitter_username?: string | null;
    analytics_initialized_at?: string | null;
  } | null;
  const legacyRollup = legacyRollupRes.data as Record<string, unknown> | null;
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

  type LegacySnapshotRow = { day: string; metrics?: { followers_total?: number } | null };
  const legacySnapshots = (legacySnapshotsRes.data ?? []) as LegacySnapshotRow[];

  type DailyRow = { day: string; followers: number | null };
  const dailyRows = (dailySnapshotsRes.data ?? []) as DailyRow[];
  const snapshotsFromDaily = dailyRows.map((r) => ({ snapshot_date: r.day, followers_total: r.followers ?? null }));
  const snapshots =
    snapshotsFromDaily.length > 0
      ? snapshotsFromDaily
      : legacySnapshots.map((s) => ({
          snapshot_date: s.day,
          followers_total: s.metrics?.followers_total ?? null,
        }));

  type WindowAgg = {
    window_days?: number;
    posts_count?: unknown;
    avg_likes_per_post?: unknown;
    avg_replies_per_post?: unknown;
    avg_engagement_rate?: unknown;
    reach_avg?: unknown;
  };
  const windowRows = (windowAggsRes.data ?? []) as WindowAgg[];
  const byWindow = windowRows.reduce(
    (acc, r) => {
      const w = Number(r.window_days);
      if (!(w in acc)) acc[w] = r;
      return acc;
    },
    {} as Record<number, WindowAgg>
  );
  const w7 = byWindow[7];
  const w30 = byWindow[30];
  const w90 = byWindow[90];
  const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
  const rollupFromWindows =
    w7 || w30 || w90
      ? ({
          posts_7d: w7 ? num(w7.posts_count) : 0,
          posts_30d: w30 ? num(w30.posts_count) : 0,
          posts_90d: w90 ? num(w90.posts_count) : 0,
          avg_likes_7d: w7 ? num(w7.avg_likes_per_post) : 0,
          avg_likes_30d: w30 ? num(w30.avg_likes_per_post) : 0,
          avg_likes_90d: w90 ? num(w90.avg_likes_per_post) : 0,
          avg_replies_7d: w7 ? num(w7.avg_replies_per_post) : 0,
          avg_replies_30d: w30 ? num(w30.avg_replies_per_post) : 0,
          avg_replies_90d: w90 ? num(w90.avg_replies_per_post) : 0,
          engagement_rate_7d: w7 ? num(w7.avg_engagement_rate) : 0,
          engagement_rate_30d: w30 ? num(w30.avg_engagement_rate) : 0,
          engagement_rate_90d: w90 ? num(w90.avg_engagement_rate) : 0,
          reach_proxy_7d: w7 ? num(w7.reach_avg) : 0,
          reach_proxy_30d: w30 ? num(w30.reach_avg) : 0,
          reach_proxy_90d: w90 ? num(w90.reach_avg) : 0,
        } as Record<string, unknown>)
      : null;
  const rollup = rollupFromWindows ?? legacyRollup;
  // source = worker only when real 90d backfill is complete (avoids "false worker" from single daily cron row)
  const ready90 = !!w90 || !!(profile?.analytics_initialized_at ?? null);
  const hasDaily = dailyRows.length > 0; // x_daily_snapshots exist (may be only today from cron)
  const source: "worker" | "partial" | "fallback" = ready90 ? "worker" : hasDaily ? "partial" : "fallback";

  return NextResponse.json({
    profile: profile ?? {},
    rollup: rollup ?? null,
    topDrivers,
    baseline: baseline ?? null,
    snapshots,
    source,
  });
}
