import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type WindowParam = "7d" | "30d" | "90d";

/** GET: X analytics for current user. Uses x_daily_snapshots + x_window_aggregates (worker backfill); falls back to legacy tables. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const { searchParams } = new URL(request.url ?? "", "http://localhost");
  const windowRaw = (searchParams.get("window") ?? "30d").toLowerCase();
  const window: WindowParam = windowRaw === "7d" || windowRaw === "90d" ? windowRaw : "30d";
  const windowDays = window === "7d" ? 7 : window === "30d" ? 30 : 90;

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  // Window filters: UTC date ranges (tweeted_at gte), profile_id = user.id
  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString();
  const sevenDaysAgo = new Date(now);
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const sevenDaysAgoStr = sevenDaysAgo.toISOString();
  const ninetyDaysAgo = new Date(now);
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const ninetyDaysAgoStr = ninetyDaysAgo.toISOString();
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - windowDays);
  const windowStartStr = windowStart.toISOString().slice(0, 10);

  const [profileRes, legacyRollupRes, driversRes, baselineRes, legacySnapshotsRes, dailySnapshotsRes, windowAggsRes, tweetsLast30Res, tweetsCount90dRes, lastTweet90dRes] = await Promise.all([
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
      .select("day, followers, tweets_count, likes_received, engagement_rate")
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
    supabase
      .from("x_tweets")
      .select("tweet_id, tweeted_at, like_count, reply_count, repost_count")
      .eq("profile_id", user.id)
      .gte("tweeted_at", ninetyDaysAgoStr)
      .order("tweeted_at", { ascending: true }),
    supabase
      .from("x_tweets")
      .select("tweet_id", { count: "exact", head: true })
      .eq("profile_id", user.id)
      .gte("tweeted_at", ninetyDaysAgoStr),
    supabase
      .from("x_tweets")
      .select("tweeted_at")
      .eq("profile_id", user.id)
      .gte("tweeted_at", ninetyDaysAgoStr)
      .order("tweeted_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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
  // Dedupe by tweet_id (source: x_top_drivers for this profile, window_days=30)
  const rawDrivers = (driversRes.data ?? []) as Array<{
    tweet_id: string;
    tweeted_at: string | null;
    like_count: number;
    reply_count: number;
    repost_count: number;
    engagement_score: number;
  }>;
  const seenIds = new Set<string>();
  const topDrivers = rawDrivers.filter((d) => {
    if (seenIds.has(d.tweet_id)) return false;
    seenIds.add(d.tweet_id);
    return true;
  });
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

  type DailyRow = {
    day: string;
    followers: number | null;
    tweets_count?: number | null;
    likes_received?: number | null;
    engagement_rate?: number | null;
  };
  const dailyRows = (dailySnapshotsRes.data ?? []) as DailyRow[];
  const snapshotsFromDaily = dailyRows.map((r) => ({
    snapshot_date: r.day,
    followers_total: r.followers ?? null,
    tweets_count: r.tweets_count ?? null,
    likes_received: r.likes_received ?? null,
    engagement_rate: r.engagement_rate != null ? Number(r.engagement_rate) : null,
  }));
  const snapshots =
    snapshotsFromDaily.length > 0
      ? snapshotsFromDaily
      : legacySnapshots.map((s) => ({
          snapshot_date: s.day,
          followers_total: s.metrics?.followers_total ?? null,
          tweets_count: null as number | null,
          likes_received: null as number | null,
          engagement_rate: null as number | null,
        }));

  type WindowAgg = {
    window_days?: number;
    posts_count?: unknown;
    avg_likes_per_post?: unknown;
    avg_replies_per_post?: unknown;
    avg_engagement_rate?: unknown;
    reach_avg?: unknown;
    updated_at?: string | null;
  };
  const windowRows = (windowAggsRes.data ?? []) as WindowAgg[];
  type CountRes = { count?: number };
  const tweetsCount90d = (tweetsCount90dRes as CountRes)?.count ?? 0;
  const lastTweet90dRow = lastTweet90dRes.data as { tweeted_at?: string | null } | null;
  const lastTweet90dAt = lastTweet90dRow?.tweeted_at ?? null;
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
  // source = worker only when real 90d backfill is complete (avoids "false worker" from single daily cron row).
  // ready90 scoped by (owner_type, owner_id) above so org vs profile cannot collide.
  const ready90 = !!w90 || !!(profile?.analytics_initialized_at ?? null);
  const hasDaily = dailyRows.length > 0; // x_daily_snapshots exist (may be only today from cron)
  const source: "worker" | "partial" | "fallback" = ready90 ? "worker" : hasDaily ? "partial" : "fallback";

  const snapshotMaxDay =
    dailyRows.length > 0
      ? dailyRows.reduce((max, r) => (r.day > max ? r.day : max), dailyRows[0].day)
      : null;
  type Wa = { as_of?: string };
  const aggregateMaxAsOf =
    windowRows.length > 0
      ? (windowRows as Wa[]).reduce(
          (max, r) => (r.as_of && (max == null || r.as_of > max) ? r.as_of : max),
          null as string | null
        )
      : null;

  const LIKES_OUTLIER = 2000;
  const REPOSTS_OUTLIER = 500;
  type TweetRow = { tweet_id: string; tweeted_at: string; like_count: number; reply_count: number; repost_count: number };
  const tweetsLast30 = (tweetsLast30Res.data ?? []) as TweetRow[];
  const dayAgg = new Map<
    string,
    { likes: number; replies: number; reposts: number; tweets_count: number; max_like_tweet_id: string | null; max_like_count: number }
  >();
  for (const t of tweetsLast30) {
    const day = t.tweeted_at?.slice(0, 10) ?? "";
    if (!day) continue;
    const cur = dayAgg.get(day) ?? {
      likes: 0,
      replies: 0,
      reposts: 0,
      tweets_count: 0,
      max_like_tweet_id: null as string | null,
      max_like_count: 0,
    };
    const likeCount = Number(t.like_count) || 0;
    cur.likes += likeCount;
    cur.replies += Number(t.reply_count) || 0;
    cur.reposts += Number(t.repost_count) || 0;
    cur.tweets_count += 1;
    if (likeCount > cur.max_like_count) {
      cur.max_like_count = likeCount;
      cur.max_like_tweet_id = t.tweet_id ?? null;
    }
    dayAgg.set(day, cur);
  }
  let topDay: string | null = null;
  let topLikes = 0;
  for (const [day, agg] of dayAgg) {
    if (agg.likes > topLikes) {
      topLikes = agg.likes;
      topDay = day;
    }
  }
  const topDayAgg = topDay ? dayAgg.get(topDay) : null;
  const hasOutlierDay = Array.from(dayAgg.values()).some(
    (a) => a.likes > LIKES_OUTLIER || a.reposts > REPOSTS_OUTLIER
  );
  const diagnostics = {
    top_day_last30_from_x_tweets: topDay
      ? {
          day: topDay,
          likes: topDayAgg?.likes ?? 0,
          replies: topDayAgg?.replies ?? 0,
          reposts: topDayAgg?.reposts ?? 0,
          tweets_count: topDayAgg?.tweets_count ?? 0,
          max_like_tweet_id: topDayAgg?.max_like_tweet_id ?? null,
        }
      : null,
    has_outlier_day: hasOutlierDay,
  };

  // Data status: tweet counts per window and rollup freshness (for "Data status" line and empty-state logic)
  const tweetCount7d = tweetsLast30.filter((t) => (t.tweeted_at ?? "") >= sevenDaysAgoStr).length;
  const tweetCount30d = tweetsLast30.filter((t) => (t.tweeted_at ?? "") >= thirtyDaysAgoStr).length;
  const lastTweetAt30d = tweetsLast30.length > 0 ? tweetsLast30[tweetsLast30.length - 1]?.tweeted_at ?? null : null;
  const lastTweetAt = lastTweet90dAt ?? lastTweetAt30d ?? null;
  const rollupUpdatedAt =
    (windowRows.length > 0
      ? (windowRows as WindowAgg[]).reduce(
          (max, r) => (r.updated_at && (max == null || r.updated_at > max) ? r.updated_at : max),
          null as string | null
        )
      : null) ?? (legacyRollup && typeof (legacyRollup as { updated_at?: string }).updated_at === "string" ? (legacyRollup as { updated_at: string }).updated_at : null);

  const data_status = {
    tweet_count_7d: tweetCount7d,
    tweet_count_30d: tweetCount30d,
    tweet_count_90d: tweetsCount90d,
    last_tweet_at: lastTweetAt,
    rollup_updated_at: rollupUpdatedAt,
  };

  // Chart points: only real data, no zero-fill. Scoped to selected window.
  const snapshotsInWindow = snapshots.filter((s) => s.snapshot_date >= windowStartStr).sort((a, b) => a.snapshot_date.localeCompare(b.snapshot_date));
  const tweetsInWindow = tweetsLast30.filter((t) => (t.tweeted_at ?? "").slice(0, 10) >= windowStartStr);
  const dayAggForWindow = new Map<string, { posts: number; likes: number; replies: number; reposts: number }>();
  for (const t of tweetsInWindow) {
    const day = t.tweeted_at?.slice(0, 10) ?? "";
    if (!day) continue;
    const cur = dayAggForWindow.get(day) ?? { posts: 0, likes: 0, replies: 0, reposts: 0 };
    cur.posts += 1;
    cur.likes += Number(t.like_count) || 0;
    cur.replies += Number(t.reply_count) || 0;
    cur.reposts += Number(t.repost_count) || 0;
    dayAggForWindow.set(day, cur);
  }

  const follower_growth: Array<{ date: string; followers: number | null }> = snapshotsInWindow
    .filter((s) => s.followers_total != null)
    .map((s) => ({ date: s.snapshot_date, followers: s.followers_total ?? null }));

  const engagement_rate: Array<{ date: string; engagement_pct: number | null; posts: number }> = (() => {
    if (snapshotsInWindow.length > 0) {
      return snapshotsInWindow
        .filter((s) => (s.tweets_count ?? 0) > 0 || s.engagement_rate != null)
        .map((s) => {
          const posts = s.tweets_count ?? 0;
          let engagement_pct: number | null = s.engagement_rate != null && Number.isFinite(s.engagement_rate) ? Number(s.engagement_rate) : null;
          if (engagement_pct == null && posts > 0 && typeof s.likes_received === "number")
            engagement_pct = (s.likes_received / posts) * 100;
          return { date: s.snapshot_date, engagement_pct, posts };
        });
    }
    return Array.from(dayAggForWindow.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, agg]) => {
        const engagement_pct = agg.posts > 0 ? ((agg.likes + agg.replies + agg.reposts) / agg.posts) * 100 : null;
        return { date, engagement_pct, posts: agg.posts };
      });
  })();

  const posting_cadence: Array<{ date: string; posts: number }> = (() => {
    if (snapshotsInWindow.length > 0) {
      return snapshotsInWindow
        .filter((s) => (s.tweets_count ?? 0) > 0)
        .map((s) => ({ date: s.snapshot_date, posts: s.tweets_count ?? 0 }));
    }
    return Array.from(dayAggForWindow.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, agg]) => ({ date, posts: agg.posts }));
  })();

  const chart_points = {
    follower_growth,
    engagement_rate,
    posting_cadence,
  };

  return ok({
    profile: profile ?? {},
    rollup: rollup ?? null,
    topDrivers,
    baseline: baseline ?? null,
    snapshots,
    source,
    freshness: {
      tweets_last_synced_at: profile?.x_last_tweets_sync_at ?? null,
      snapshot_max_day: snapshotMaxDay,
      aggregate_max_as_of: aggregateMaxAsOf,
    },
    data_status,
    chart_points,
    diagnostics,
  });
}
