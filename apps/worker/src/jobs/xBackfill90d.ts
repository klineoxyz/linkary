/**
 * Run one x_backfill_90d job: ingest tweets into x_tweets, then fill x_daily_snapshots, compute x_window_aggregates.
 * Job is only marked done when tweets were upserted or verified no-op (no tweets).
 */
import { SupabaseClient } from "@supabase/supabase-js";
import { ingestXTweets } from "../lib/ingestXTweets.js";
import { getUserInfo, getRecentTweets } from "../lib/twitterapi.js";
import { sleep } from "../lib/utils.js";

const MAX_TWEETS = 1000;
const DELAY_MS = 400;

function toDay(iso: string): string {
  return iso.slice(0, 10);
}

export type JobRow = {
  id: string;
  job_type: string;
  owner_type: string;
  owner_id: string;
  payload: { username?: string; user_id?: string } | null;
};

export type RunResult = { ok: boolean; upserted?: number; verifiedNoOp?: boolean; error?: string };

export async function runXBackfill90d(
  supabase: SupabaseClient,
  job: JobRow
): Promise<RunResult> {
  const username = job.payload?.username;
  if (!username || job.owner_type !== "profile" || !job.owner_id) {
    return { ok: false, error: "no_x_handle" };
  }

  const handle = username.trim().replace(/^@/, "").toLowerCase();
  if (!handle) return { ok: false, error: "no_x_handle" };

  const result = await ingestXTweets(supabase, {
    profile_id: job.owner_id,
    twitter_username: handle,
    maxTweets: MAX_TWEETS,
  });
  if (result.fetched > 0 && result.upserted === 0) {
    return {
      ok: false,
      error:
        "Tweet fetch returned rows but no upserts. conflict_target=profile_id,tweet_id. Check table schema and payload.",
    };
  }
  if (result.fetched === 0) {
    console.log("[X_TWEETS] verified no new tweets");
  }

  const userInfo = await getUserInfo(handle);
  await sleep(200);
  const followersToday = userInfo?.followers ?? null;

  const tweets = await getRecentTweets(handle, MAX_TWEETS);
  await sleep(DELAY_MS);

  const now = new Date();
  const todayStr = toDay(now.toISOString());
  const startDate90 = new Date(now);
  startDate90.setDate(startDate90.getDate() - 89);
  const startDate90Str = toDay(startDate90.toISOString());

  const dayMap = new Map<
    string,
    { tweets_count: number; likes_received: number; replies_received: number; retweets_received: number; quotes_received: number }
  >();

  for (const t of tweets) {
    const createdAt = t.createdAt;
    if (!createdAt) continue;
    const d = new Date(createdAt);
    if (isNaN(d.getTime())) continue;
    const day = toDay(d.toISOString());
    if (day < startDate90Str || day > todayStr) continue;
    const existing = dayMap.get(day) ?? {
      tweets_count: 0,
      likes_received: 0,
      replies_received: 0,
      retweets_received: 0,
      quotes_received: 0,
    };
    existing.tweets_count += 1;
    existing.likes_received += Math.max(0, Number(t.likeCount) || 0);
    existing.replies_received += Math.max(0, Number(t.replyCount) || 0);
    existing.retweets_received += Math.max(0, Number(t.retweetCount) || 0);
    existing.quotes_received += Math.max(0, Number(t.quoteCount) || 0);
    dayMap.set(day, existing);
  }

  const zeroBucket = {
    tweets_count: 0,
    likes_received: 0,
    replies_received: 0,
    retweets_received: 0,
    quotes_received: 0,
  };
  const full90Days: string[] = [];
  for (let i = 0; i < 90; i++) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    full90Days.push(toDay(d.toISOString()));
  }
  full90Days.sort((a, b) => a.localeCompare(b));

  for (const day of full90Days) {
    const agg = dayMap.get(day) ?? zeroBucket;
    const { error } = await supabase.from("x_daily_snapshots").upsert(
      {
        owner_type: "profile",
        owner_id: job.owner_id,
        day,
        followers: day === todayStr ? followersToday : null,
        tweets_count: agg.tweets_count,
        likes_received: agg.likes_received,
        replies_received: agg.replies_received,
        retweets_received: agg.retweets_received,
        raw: { quotes_received: agg.quotes_received },
      },
      { onConflict: "owner_type,owner_id,day" }
    );
    if (error) return { ok: false, error: error.message };
  }

  const asOf = todayStr;

  for (const windowDays of [7, 30, 90]) {
    const start = new Date(now);
    start.setDate(start.getDate() - (windowDays - 1));
    const startStr = toDay(start.toISOString());

    const { data: rows } = await supabase
      .from("x_daily_snapshots")
      .select("day, followers, tweets_count, likes_received, replies_received, retweets_received, raw")
      .eq("owner_type", "profile")
      .eq("owner_id", job.owner_id)
      .gte("day", startStr)
      .lte("day", todayStr)
      .order("day", { ascending: true });

    const list = (rows ?? []) as Array<{
      day: string;
      followers: number | null;
      tweets_count: number | null;
      likes_received: number | null;
      replies_received: number | null;
      retweets_received: number | null;
      raw?: { quotes_received?: number } | null;
    }>;

    let followersStart: number | null = null;
    let followersEnd: number | null = null;
    let totalLikes = 0;
    let totalReplies = 0;
    let totalRetweets = 0;
    let totalQuotes = 0;
    let totalPosts = 0;

    for (const r of list) {
      if (r.followers != null) {
        if (followersStart == null) followersStart = r.followers;
        followersEnd = r.followers;
      }
      totalLikes += r.likes_received ?? 0;
      totalReplies += r.replies_received ?? 0;
      totalRetweets += r.retweets_received ?? 0;
      totalQuotes += r.raw?.quotes_received ?? 0;
      totalPosts += r.tweets_count ?? 0;
    }

    const totalEngagement = totalLikes + totalReplies + totalRetweets + totalQuotes;
    const followersEndSafe = followersEnd ?? followersStart ?? 1;
    const avgEngagement =
      totalPosts > 0 && followersEndSafe > 0
        ? Math.min(100, (totalEngagement / totalPosts / followersEndSafe) * 100)
        : null;
    const reachAvg =
      totalPosts > 0 && followersEnd != null
        ? totalPosts * followersEnd
        : null;

    const agg = {
      owner_type: "profile",
      owner_id: job.owner_id,
      window_days: windowDays,
      as_of: asOf,
      followers_start: followersStart,
      followers_end: followersEnd,
      followers_delta:
        followersStart != null && followersEnd != null ? followersEnd - followersStart : null,
      avg_engagement_rate: avgEngagement,
      avg_likes_per_post: totalPosts > 0 ? totalLikes / totalPosts : null,
      avg_replies_per_post: totalPosts > 0 ? totalReplies / totalPosts : null,
      avg_retweets_per_post: totalPosts > 0 ? totalRetweets / totalPosts : null,
      reach_avg: reachAvg,
      posts_count: totalPosts,
      updated_at: new Date().toISOString(),
    };

    const { error: aggErr } = await supabase.from("x_window_aggregates").upsert(agg, {
      onConflict: "owner_type,owner_id,window_days,as_of",
    });
    if (aggErr) return { ok: false, error: aggErr.message };
  }

  // Set only after x_daily_snapshots and x_window_aggregates succeeded (no finally — never set on failure).
  if (job.owner_type === "profile" && job.owner_id) {
    await supabase
      .from("profiles")
      .update({ analytics_initialized_at: new Date().toISOString(), updated_at: new Date().toISOString() })
      .eq("id", job.owner_id);
  }

  return {
    ok: true,
    upserted: result.upserted,
    verifiedNoOp: result.fetched === 0,
  };
}
