import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

type WindowParam = "7d" | "30d" | "90d";

/**
 * GET: X analytics for current user. Charts from x_tweets (engagement, cadence) and x_daily_snapshots (follower growth).
 * Identity: auth user id = profile id; API queries x_daily_snapshots by owner_type='profile', owner_id=user.id.
 *
 * DB proof queries (run in Supabase SQL for the logged-in user's profile id = auth.uid()):
 *   -- Snapshot counts per window (replace :profile_id with the profile id from session)
 *   SELECT COUNT(*) AS snapshot_count_7d  FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 6)::text  AND day <= CURRENT_DATE::text;
 *   SELECT COUNT(*) AS snapshot_count_30d FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 29)::text AND day <= CURRENT_DATE::text;
 *   SELECT COUNT(*) AS snapshot_count_90d FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id AND day >= (CURRENT_DATE - 89)::text AND day <= CURRENT_DATE::text;
 *   -- Sample 5 newest rows
 *   SELECT day, followers, tweets_count FROM x_daily_snapshots WHERE owner_type='profile' AND owner_id = :profile_id ORDER BY day DESC LIMIT 5;
 *   -- Tweet count in 90d
 *   SELECT COUNT(*) FROM x_tweets WHERE profile_id = :profile_id AND tweeted_at >= (NOW() - INTERVAL '90 days');
 */
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
  const debug = searchParams.get("debug") === "1";

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
  // Window: [today - (windowDays-1), today] inclusive so all charts end on TODAY and have exactly windowDays points
  const todayStr = now.toISOString().slice(0, 10);
  const windowStart = new Date(now);
  windowStart.setDate(windowStart.getDate() - (windowDays - 1));
  const windowStartStr = windowStart.toISOString().slice(0, 10);
  const windowEndStr = todayStr;
  const sevenWindowStartStr = (() => { const d = new Date(now); d.setDate(d.getDate() - 6); return d.toISOString().slice(0, 10); })();
  const thirtyWindowStartStr = (() => { const d = new Date(now); d.setDate(d.getDate() - 29); return d.toISOString().slice(0, 10); })();
  const ninetyWindowStartStr = (() => { const d = new Date(now); d.setDate(d.getDate() - 89); return d.toISOString().slice(0, 10); })();

  const [profileRes, driversRes, baselineRes, dailySnapshotsRes, windowAggsRes, tweetsLast30Res, tweetsCount90dRes, lastTweet90dRes] = await Promise.all([
    supabase
      .from("profiles")
      .select("followers_total, avg_engagement_rate, x_last_profile_sync_at, x_last_tweets_sync_at, x_sync_status, twitter_username, analytics_initialized_at")
      .eq("id", user.id)
      .maybeSingle(),
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
      .select("tweet_id, tweeted_at, like_count, reply_count, repost_count, quote_count, impression_count")
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

  type DailyRow = {
    day: string;
    followers: number | null;
    tweets_count?: number | null;
    likes_received?: number | null;
    engagement_rate?: number | null;
  };
  const rawDailyRows = (dailySnapshotsRes.data ?? []) as DailyRow[];
  // Normalize day to YYYY-MM-DD so window filtering is consistent (Postgres date returns as string)
  const dailyRows = rawDailyRows.map((r) => {
    const raw = r.day;
    const dayStr = typeof raw === "string" ? raw.slice(0, 10) : String(raw).slice(0, 10);
    return { ...r, day: dayStr };
  });
  const snapshots = dailyRows.map((r) => ({
    snapshot_date: r.day,
    followers_total: r.followers ?? null,
    tweets_count: r.tweets_count ?? null,
    likes_received: r.likes_received ?? null,
    engagement_rate: r.engagement_rate != null ? Number(r.engagement_rate) : null,
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
  type TweetRow = {
    tweet_id: string;
    tweeted_at: string;
    like_count: number;
    reply_count: number;
    repost_count: number;
    quote_count?: number | null;
    impression_count?: number | null;
  };
  const tweetsLast90 = (tweetsLast30Res.data ?? []) as TweetRow[];
  const dayAgg = new Map<
    string,
    { likes: number; replies: number; reposts: number; tweets_count: number; max_like_tweet_id: string | null; max_like_count: number }
  >();
  for (const t of tweetsLast90) {
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

  // Data status: tweet counts per window [start, today] inclusive (same boundaries as charts)
  const tweetCount7d = tweetsLast90.filter((t) => { const d = (t.tweeted_at ?? "").slice(0, 10); return d >= sevenWindowStartStr && d <= todayStr; }).length;
  const tweetCount30d = tweetsLast90.filter((t) => { const d = (t.tweeted_at ?? "").slice(0, 10); return d >= thirtyWindowStartStr && d <= todayStr; }).length;
  const tweetCount90d = tweetsLast90.filter((t) => { const d = (t.tweeted_at ?? "").slice(0, 10); return d >= ninetyWindowStartStr && d <= todayStr; }).length;
  const lastTweetAt30d = tweetsLast90.length > 0 ? tweetsLast90[tweetsLast90.length - 1]?.tweeted_at ?? null : null;
  const lastTweetAt = lastTweet90dAt ?? lastTweetAt30d ?? null;
  const rollupUpdatedAt =
    windowRows.length > 0
      ? (windowRows as WindowAgg[]).reduce(
          (max, r) => (r.updated_at && (max == null || r.updated_at > max) ? r.updated_at : max),
          null as string | null
        )
      : null;

  const data_status = {
    tweet_count_7d: tweetCount7d,
    tweet_count_30d: tweetCount30d,
    tweet_count_90d: tweetCount90d,
    last_tweet_at: lastTweetAt,
    rollup_updated_at: rollupUpdatedAt,
  };

  // Chart points: computed ONLY from x_tweets (engagement, cadence) and x_daily_snapshots (follower growth). Same window [windowStartStr, windowEndStr] ending TODAY.
  const tweetsInWindow = tweetsLast90.filter((t) => {
    const d = (t.tweeted_at ?? "").slice(0, 10);
    return d >= windowStartStr && d <= windowEndStr;
  });
  const dayAggForWindow = new Map<string, { posts: number; likes: number; replies: number; reposts: number; quotes: number; impressions: number }>();
  for (const t of tweetsInWindow) {
    const day = t.tweeted_at?.slice(0, 10) ?? "";
    if (!day) continue;
    const cur = dayAggForWindow.get(day) ?? { posts: 0, likes: 0, replies: 0, reposts: 0, quotes: 0, impressions: 0 };
    cur.posts += 1;
    cur.likes += Number(t.like_count) || 0;
    cur.replies += Number(t.reply_count) || 0;
    cur.reposts += Number(t.repost_count) || 0;
    cur.quotes += Number(t.quote_count) || 0;
    cur.impressions += Number(t.impression_count) || 0;
    dayAggForWindow.set(day, cur);
  }

  const followersTotal = profile?.followers_total != null && Number.isFinite(profile.followers_total) ? Number(profile.followers_total) : 0;

  // Per-window metrics (7, 30, 90) computed from x_tweets: engagement rate = total_engagement / total_impressions (or fallback), potential reach = total impressions or estimated.
  type WindowMetric = {
    tweet_count: number;
    total_engagement_window: number;
    total_likes_window: number;
    total_replies_window: number;
    total_impressions_window: number;
    engagement_rate_pct: number;
    engagement_rate_is_estimated: boolean;
    potential_reach_value: number;
    potential_reach_label: string;
    potential_reach_is_estimated: boolean;
    posting_cadence: number;
  };
  const windowStarts: { days: 7 | 30 | 90; startStr: string }[] = [
    { days: 7, startStr: sevenWindowStartStr },
    { days: 30, startStr: thirtyWindowStartStr },
    { days: 90, startStr: ninetyWindowStartStr },
  ];
  const windowMetrics: Record<string, WindowMetric> = {};
  for (const { days, startStr } of windowStarts) {
    const inWindow = tweetsLast90.filter((t) => {
      const d = (t.tweeted_at ?? "").slice(0, 10);
      return d >= startStr && d <= todayStr;
    });
    const tweet_count = inWindow.length;
    const total_likes_window = inWindow.reduce((s, t) => s + (Number(t.like_count) || 0), 0);
    const total_replies_window = inWindow.reduce((s, t) => s + (Number(t.reply_count) || 0), 0);
    const total_engagement_window =
      total_likes_window +
      total_replies_window +
      inWindow.reduce((s, t) => s + (Number(t.repost_count) || 0) + (Number(t.quote_count) || 0), 0);
    const total_impressions_window = inWindow.reduce((s, t) => s + (Number(t.impression_count) || 0), 0);
    const hasImpressions = total_impressions_window > 0;
    const engagement_rate_pct =
      hasImpressions
        ? (total_engagement_window / total_impressions_window) * 100
        : followersTotal > 0 && tweet_count > 0
          ? (total_engagement_window / (followersTotal * tweet_count)) * 100
          : 0;
    const engagement_rate_is_estimated = !hasImpressions;
    const potential_reach_value = hasImpressions ? total_impressions_window : followersTotal * tweet_count;
    const potential_reach_label = hasImpressions ? "Total Impressions" : "Estimated Max Exposure";
    const potential_reach_is_estimated = !hasImpressions;
    const posting_cadence = days > 0 ? tweet_count / days : 0;
    windowMetrics[String(days)] = {
      tweet_count,
      total_engagement_window,
      total_likes_window,
      total_replies_window,
      total_impressions_window,
      engagement_rate_pct,
      engagement_rate_is_estimated,
      potential_reach_value,
      potential_reach_label,
      potential_reach_is_estimated,
      posting_cadence,
    };
  }

  // Rollup: from x_window_aggregates when present, else computed from x_tweets (windowMetrics). Same response shape.
  // KPI fallback: avg_likes_* = sum(like_count)/tweet_count, avg_replies_* = sum(reply_count)/tweet_count (not total_engagement).
  const rollupFromWindowMetrics =
    !rollupFromWindows &&
    (windowMetrics["7"] || windowMetrics["30"] || windowMetrics["90"])
      ? ({
          posts_7d: windowMetrics["7"]?.tweet_count ?? 0,
          posts_30d: windowMetrics["30"]?.tweet_count ?? 0,
          posts_90d: windowMetrics["90"]?.tweet_count ?? 0,
          avg_likes_7d: windowMetrics["7"]?.tweet_count
            ? (windowMetrics["7"].total_likes_window ?? 0) / windowMetrics["7"].tweet_count
            : 0,
          avg_likes_30d: windowMetrics["30"]?.tweet_count
            ? (windowMetrics["30"].total_likes_window ?? 0) / windowMetrics["30"].tweet_count
            : 0,
          avg_likes_90d: windowMetrics["90"]?.tweet_count
            ? (windowMetrics["90"].total_likes_window ?? 0) / windowMetrics["90"].tweet_count
            : 0,
          avg_replies_7d: windowMetrics["7"]?.tweet_count
            ? (windowMetrics["7"].total_replies_window ?? 0) / windowMetrics["7"].tweet_count
            : 0,
          avg_replies_30d: windowMetrics["30"]?.tweet_count
            ? (windowMetrics["30"].total_replies_window ?? 0) / windowMetrics["30"].tweet_count
            : 0,
          avg_replies_90d: windowMetrics["90"]?.tweet_count
            ? (windowMetrics["90"].total_replies_window ?? 0) / windowMetrics["90"].tweet_count
            : 0,
          engagement_rate_7d: windowMetrics["7"]?.engagement_rate_pct ?? 0,
          engagement_rate_30d: windowMetrics["30"]?.engagement_rate_pct ?? 0,
          engagement_rate_90d: windowMetrics["90"]?.engagement_rate_pct ?? 0,
          reach_proxy_7d: windowMetrics["7"]?.potential_reach_value ?? 0,
          reach_proxy_30d: windowMetrics["30"]?.potential_reach_value ?? 0,
          reach_proxy_90d: windowMetrics["90"]?.potential_reach_value ?? 0,
        } as Record<string, unknown>)
      : null;
  const baseRollup = rollupFromWindows ?? rollupFromWindowMetrics;
  const rollup =
    baseRollup && typeof baseRollup === "object"
      ? {
          ...baseRollup,
          engagement_rate_7d: windowMetrics["7"]?.engagement_rate_pct ?? num((baseRollup as Record<string, unknown>).engagement_rate_7d),
          engagement_rate_30d: windowMetrics["30"]?.engagement_rate_pct ?? num((baseRollup as Record<string, unknown>).engagement_rate_30d),
          engagement_rate_90d: windowMetrics["90"]?.engagement_rate_pct ?? num((baseRollup as Record<string, unknown>).engagement_rate_90d),
          reach_proxy_7d: windowMetrics["7"]?.potential_reach_value ?? num((baseRollup as Record<string, unknown>).reach_proxy_7d),
          reach_proxy_30d: windowMetrics["30"]?.potential_reach_value ?? num((baseRollup as Record<string, unknown>).reach_proxy_30d),
          reach_proxy_90d: windowMetrics["90"]?.potential_reach_value ?? num((baseRollup as Record<string, unknown>).reach_proxy_90d),
        }
      : baseRollup;

  // Full window dates: [windowStartStr, windowEndStr] inclusive = exactly windowDays points ending TODAY
  const fullWindowDates: string[] = [];
  for (let i = 0; i < windowDays; i++) {
    const d = new Date(windowStart);
    d.setDate(d.getDate() + i);
    fullWindowDates.push(d.toISOString().slice(0, 10));
  }
  fullWindowDates.sort((a, b) => a.localeCompare(b));

  // Earliest snapshot date we have (dailyRows ordered by day desc, so last is earliest)
  const earliestSnapshotDate =
    dailyRows.length > 0
      ? dailyRows.reduce((min, r) => (r.day < min ? r.day : min), dailyRows[0].day)
      : null;
  // Limit follower chart to available history: no fabricated data before first snapshot
  const effectiveFollowerWindowStart =
    earliestSnapshotDate && earliestSnapshotDate > windowStartStr ? earliestSnapshotDate : windowStartStr;

  // Follower chart dates: only [effectiveFollowerWindowStart, windowEndStr] inclusive
  const followerChartDates: string[] = [];
  const effStart = new Date(effectiveFollowerWindowStart + "T12:00:00Z");
  const windowEnd = new Date(windowEndStr + "T12:00:00Z");
  for (let d = new Date(effStart); d <= windowEnd; d.setUTCDate(d.getUTCDate() + 1)) {
    followerChartDates.push(d.toISOString().slice(0, 10));
  }

  const dayBeforeFollowerWindow = (() => {
    const d = new Date(effectiveFollowerWindowStart + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  })();
  const dailyFollowerMap = new Map<string, number | null>();
  for (const r of dailyRows) {
    const day = r.day;
    if (day >= dayBeforeFollowerWindow && day <= windowEndStr)
      dailyFollowerMap.set(day, r.followers != null ? Number(r.followers) : null);
  }

  // Follower growth: follower_delta = today_followers - yesterday_followers; only dates we have snapshot coverage for
  const follower_growth: Array<{ date: string; follower_delta: number | null }> = followerChartDates.map((date) => {
    const todayVal = dailyFollowerMap.get(date);
    const prevDate = (() => {
      const d = new Date(date + "T12:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      return d.toISOString().slice(0, 10);
    })();
    const yesterdayVal = dailyFollowerMap.get(prevDate);
    if (todayVal == null || yesterdayVal == null || !Number.isFinite(todayVal) || !Number.isFinite(yesterdayVal))
      return { date, follower_delta: null };
    return { date, follower_delta: todayVal - yesterdayVal };
  });

  const follower_data_coverage_days = follower_growth.filter((p) => p.follower_delta !== null).length;
  const follower_window_days = follower_growth.length;
  const engagement_data_coverage_days = fullWindowDates.filter(
    (d) => (dayAggForWindow.get(d)?.posts ?? 0) > 0
  ).length;

  // Snapshot debug: rows in current window (for diagnosing low follower coverage)
  const snapshotRowsInWindow = dailyRows.filter((r) => r.day >= windowStartStr && r.day <= windowEndStr);
  const snapshot_rows_count_in_window = snapshotRowsInWindow.length;
  const distinct_snapshot_dates_in_window = new Set(snapshotRowsInWindow.map((r) => r.day)).size;
  const min_snapshot_date = snapshotRowsInWindow.length > 0 ? snapshotRowsInWindow.reduce((a, r) => (r.day < a ? r.day : a), snapshotRowsInWindow[0].day) : null;
  const max_snapshot_date = snapshotRowsInWindow.length > 0 ? snapshotRowsInWindow.reduce((a, r) => (r.day > a ? r.day : a), snapshotRowsInWindow[0].day) : null;

  // Engagement rate chart: daily engagement_rate = daily_engagement_sum / daily_impressions_sum; 0 if impressions = 0; full window
  const engagement_rate: Array<{ date: string; engagement_pct: number; posts: number }> = fullWindowDates.map((date) => {
    const agg = dayAggForWindow.get(date) ?? { likes: 0, replies: 0, reposts: 0, quotes: 0, impressions: 0, posts: 0 };
    const totalEng = agg.likes + agg.replies + agg.reposts + agg.quotes;
    const engagement_pct = agg.impressions > 0 ? (totalEng / agg.impressions) * 100 : 0;
    return { date, engagement_pct, posts: agg.posts ?? 0 };
  });

  // Posting cadence: posts per day; zero-fill; exactly windowDays points
  const posting_cadence: Array<{ date: string; posts: number }> = fullWindowDates.map((date) => ({
    date,
    posts: dayAggForWindow.get(date)?.posts ?? 0,
  }));

  const chart_points = {
    follower_growth,
    engagement_rate,
    posting_cadence,
  };

  // Server-only diagnostic log (no response change): compare to DB proof queries to find root cause
  const dailyMinDay = dailyRows.length > 0 ? dailyRows.reduce((a, r) => (r.day < a ? r.day : a), dailyRows[0].day) : null;
  const dailyMaxDay = dailyRows.length > 0 ? dailyRows.reduce((a, r) => (r.day > a ? r.day : a), dailyRows[0].day) : null;
  if (process.env.NODE_ENV !== "production" || debug) {
    console.log("[analytics/x]", {
      window: windowRaw,
      window_resolved: window,
      windowDays,
      user_id: user.id,
      profile_twitter: profile?.twitter_username ?? null,
      snapshot_rows_returned: dailyRows.length,
      snapshot_day_min: dailyMinDay,
      snapshot_day_max: dailyMaxDay,
      window_start: windowStartStr,
      window_end: windowEndStr,
      snapshot_rows_in_window: snapshot_rows_count_in_window,
      follower_growth_points: follower_growth.length,
      follower_data_coverage_days,
      tweets_in_window: tweetsInWindow.length,
      engagement_points: engagement_rate.length,
      cadence_points: posting_cadence.length,
    });
  }

  // Freshness: deterministic from x_tweets and x_daily_snapshots
  const latestTweetDate = lastTweet90dAt ? lastTweet90dAt.slice(0, 10) : null;
  const latestFollowerSnapshotDate = snapshotMaxDay;
  const yesterdayStr = (() => {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return y.toISOString().slice(0, 10);
  })();
  const follower_data_stale =
    latestFollowerSnapshotDate == null || latestFollowerSnapshotDate < yesterdayStr;
  const data_freshness_at = now.toISOString();
  const tweets_last_synced_at = profile?.x_last_tweets_sync_at ?? null;
  const follower_last_synced_at = profile?.x_last_profile_sync_at ?? null;

  const currentWindowMetric = windowMetrics[String(windowDays)];
  const tweet_count_window = currentWindowMetric?.tweet_count ?? data_status.tweet_count_7d ?? data_status.tweet_count_30d ?? data_status.tweet_count_90d ?? 0;
  const payload: Record<string, unknown> = {
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
    data_freshness_at,
    tweets_last_synced_at,
    follower_last_synced_at,
    follower_data_stale,
    data_status,
    chart_points,
    diagnostics,
    window_metrics: windowMetrics,
    window_days: windowDays,
    window_start: windowStartStr,
    window_end: windowEndStr,
    tweet_count: tweet_count_window,
    tweet_count_window,
    follower_data_coverage_days,
    follower_earliest_snapshot_date: earliestSnapshotDate,
    follower_window_days,
    snapshot_days_in_window: snapshot_rows_count_in_window,
    engagement_data_coverage_days,
    engagement_rate_pct: currentWindowMetric?.engagement_rate_pct ?? null,
    engagement_rate_is_estimated: currentWindowMetric?.engagement_rate_is_estimated ?? false,
    posting_cadence: currentWindowMetric?.posting_cadence ?? null,
    potential_reach_value: currentWindowMetric?.potential_reach_value ?? null,
    potential_reach_label: currentWindowMetric?.potential_reach_label ?? "Total Impressions",
    potential_reach_is_estimated: currentWindowMetric?.potential_reach_is_estimated ?? false,
  };
  const snapshot_count_7d = dailyRows.filter((r) => r.day >= sevenWindowStartStr && r.day <= todayStr).length;
  const snapshot_count_30d = dailyRows.filter((r) => r.day >= thirtyWindowStartStr && r.day <= todayStr).length;
  const snapshot_count_90d = dailyRows.filter((r) => r.day >= ninetyWindowStartStr && r.day <= todayStr).length;
  const whyEmptyHints: string[] = [];
  if (snapshot_count_90d === 0 && dailyRows.length === 0) {
    whyEmptyHints.push("No x_daily_snapshots. Run x-analytics-daily cron (or Worker sync_x_profiles_daily) and ensure TWITTERAPI_API_KEY + social_accounts X connected.");
  } else if (snapshot_count_90d === 0) {
    whyEmptyHints.push("No snapshots in 90d window. Snapshots exist but outside window; ensure cron runs daily so today is written.");
  }
  if ((data_status.tweet_count_90d ?? 0) === 0) {
    whyEmptyHints.push("No x_tweets in 90d. Run sync-x-tweets-weekly cron (or Worker sync_x_tweets_weekly), ensure profiles.is_indexed=true and profiles.twitter_username set.");
  }
  if (windowRows.length === 0 && whyEmptyHints.length > 0) {
    whyEmptyHints.push("No x_window_aggregates. Worker run_analytics_jobs must drain analytics_jobs (enqueued by backfill-x-90d-batch cron or Retry on analytics page).");
  }
  if (debug) {
    payload.debug = {
      window_days: windowDays,
      window_start: windowStartStr,
      window_end: windowEndStr,
      window_selected: window,
      latest_tweet_date: latestTweetDate,
      latest_follower_snapshot_date: latestFollowerSnapshotDate,
      snapshot_rows_count_in_window,
      snapshot_count_7d,
      snapshot_count_30d,
      snapshot_count_90d,
      tweet_count_7d: data_status.tweet_count_7d,
      tweet_count_30d: data_status.tweet_count_30d,
      tweet_count_90d: data_status.tweet_count_90d,
      distinct_snapshot_dates_in_window,
      min_snapshot_date,
      max_snapshot_date,
      follower_data_coverage_days,
      follower_earliest_snapshot_date: earliestSnapshotDate,
      follower_window_days,
      engagement_data_coverage_days,
      chart_points_count: {
        follower_growth: follower_growth.length,
        engagement_rate: engagement_rate.length,
        posting_cadence: posting_cadence.length,
      },
      min_max_dates: { window_start: windowStartStr, window_end: windowEndStr, snapshot_min: dailyMinDay, snapshot_max: dailyMaxDay },
      ...(whyEmptyHints.length > 0 ? { why_empty_hint: whyEmptyHints } : {}),
      ...(currentWindowMetric
        ? {
            tweet_count_window: currentWindowMetric.tweet_count,
            total_engagement_window: currentWindowMetric.total_engagement_window,
            total_impressions_window: currentWindowMetric.total_impressions_window,
            engagement_rate_is_estimated: currentWindowMetric.engagement_rate_is_estimated,
            potential_reach_label: currentWindowMetric.potential_reach_label,
            potential_reach_is_estimated: currentWindowMetric.potential_reach_is_estimated,
          }
        : {}),
    };
  }
  return ok(payload);
}
