import type { SupabaseClient } from "@supabase/supabase-js";
import type { TweetRaw } from "./twitterapi.js";

function engagementScore(
  likeCount: number,
  replyCount: number,
  repostCount: number,
  quoteCount: number
): number {
  return likeCount + 2 * replyCount + repostCount + quoteCount;
}

type TweetRow = {
  tweet_id: string;
  tweeted_at: string;
  like_count: number;
  reply_count: number;
  repost_count: number;
  quote_count: number;
};

export async function computeAndUpsertRollups(
  supabase: SupabaseClient,
  profileId: string,
  followersTotal: number
): Promise<void> {
  const now = new Date();
  const nowMs = now.getTime();
  const day = 24 * 60 * 60 * 1000;
  const window7 = new Date(nowMs - 7 * day).toISOString();
  const window30 = new Date(nowMs - 30 * day).toISOString();
  const window90 = new Date(nowMs - 90 * day).toISOString();

  const { data: rows } = await supabase
    .from("x_tweets")
    .select("tweet_id, tweeted_at, like_count, reply_count, repost_count, quote_count")
    .eq("profile_id", profileId)
    .order("tweeted_at", { ascending: false });

  const tweets = (rows ?? []) as TweetRow[];

  function forWindow(windowStart: string) {
    const inWindow = tweets.filter((t) => t.tweeted_at >= windowStart);
    const n = inWindow.length;
    if (n === 0) {
      return {
        posts: 0,
        avgLikes: 0,
        avgReplies: 0,
        engagementRate: 0,
        reachProxy: 0,
        inWindow: [] as TweetRow[],
      };
    }
    const avgLikes = inWindow.reduce((s, t) => s + (t.like_count ?? 0), 0) / n;
    const avgReplies = inWindow.reduce((s, t) => s + (t.reply_count ?? 0), 0) / n;
    const engagementScoreSum = inWindow.reduce(
      (s, t) =>
        s +
        engagementScore(
          t.like_count ?? 0,
          t.reply_count ?? 0,
          t.repost_count ?? 0,
          t.quote_count ?? 0
        ),
      0
    );
    const engagementRate =
      followersTotal > 0 ? (engagementScoreSum / n / followersTotal) * 100 : 0;
    const reachProxy = Math.round(followersTotal * (engagementRate / 100) * 1.5);
    return {
      posts: n,
      avgLikes,
      avgReplies,
      engagementRate,
      reachProxy,
      inWindow,
    };
  }

  const w7 = forWindow(window7);
  const w30 = forWindow(window30);
  const w90 = forWindow(window90);

  await supabase.from("x_analytics_rollups").upsert(
    {
      profile_id: profileId,
      updated_at: now.toISOString(),
      posts_7d: w7.posts,
      posts_30d: w30.posts,
      posts_90d: w90.posts,
      avg_likes_7d: Math.round(w7.avgLikes * 100) / 100,
      avg_likes_30d: Math.round(w30.avgLikes * 100) / 100,
      avg_likes_90d: Math.round(w90.avgLikes * 100) / 100,
      avg_replies_7d: Math.round(w7.avgReplies * 100) / 100,
      avg_replies_30d: Math.round(w30.avgReplies * 100) / 100,
      avg_replies_90d: Math.round(w90.avgReplies * 100) / 100,
      engagement_rate_7d: Math.round(w7.engagementRate * 100) / 100,
      engagement_rate_30d: Math.round(w30.engagementRate * 100) / 100,
      engagement_rate_90d: Math.round(w90.engagementRate * 100) / 100,
      reach_proxy_7d: w7.reachProxy,
      reach_proxy_30d: w30.reachProxy,
      reach_proxy_90d: w90.reachProxy,
    },
    { onConflict: "profile_id" }
  );

  const top30 = w30.inWindow
    .map((t) => ({
      ...t,
      score: engagementScore(
        t.like_count ?? 0,
        t.reply_count ?? 0,
        t.repost_count ?? 0,
        t.quote_count ?? 0
      ),
    }))
    .sort((a, b) => (b as { score: number }).score - (a as { score: number }).score)
    .slice(0, 10);

  for (const t of top30) {
    const row = t as TweetRow & { score: number };
    await supabase.from("x_top_drivers").upsert(
      {
        profile_id: profileId,
        window_days: 30,
        tweet_id: row.tweet_id,
        tweeted_at: row.tweeted_at,
        like_count: row.like_count ?? 0,
        reply_count: row.reply_count ?? 0,
        repost_count: row.repost_count ?? 0,
        engagement_score: row.score,
      },
      { onConflict: "profile_id,window_days,tweet_id" }
    );
  }
}

function parseTweetCreatedAt(createdAt: string | undefined): string | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export async function insertXTweets(
  supabase: SupabaseClient,
  profileId: string,
  tweets: TweetRaw[]
): Promise<number> {
  let inserted = 0;
  for (const t of tweets) {
    const tweetId = String(t.id ?? "").trim();
    if (!tweetId) continue;
    const tweetedAt = parseTweetCreatedAt(t.createdAt);
    if (!tweetedAt) continue;
    const { error } = await supabase.from("x_tweets").upsert(
      {
        profile_id: profileId,
        tweet_id: tweetId,
        tweeted_at: tweetedAt,
        text: (t.text ?? "").slice(0, 500) || null,
        like_count: Math.max(0, Number(t.likeCount) || 0),
        reply_count: Math.max(0, Number(t.replyCount) || 0),
        repost_count: Math.max(0, Number(t.retweetCount) || 0),
        quote_count: Math.max(0, Number(t.quoteCount) || 0),
        impression_count: typeof t.viewCount === "number" ? t.viewCount : null,
        raw: t as unknown as Record<string, unknown>,
      },
      { onConflict: "profile_id,tweet_id", ignoreDuplicates: true }
    );
    if (!error) inserted += 1;
  }
  return inserted;
}
