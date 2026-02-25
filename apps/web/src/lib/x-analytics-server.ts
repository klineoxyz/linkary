/**
 * Server-only X analytics: twitterapi.io fetch, tweet storage, rollup computation.
 * Use from API routes or cron only. Never expose TWITTERAPI_API_KEY to client.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";

const TWITTERAPI_BASE = "https://api.twitterapi.io";

export type ProfileRow = {
  id: string;
  twitter_username: string | null;
  followers_total: number;
};

/** Create Supabase client with service role (bypasses RLS). Use only in cron/backend. */
export function createServiceSupabase(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL required");
  return createClient(url, key);
}

/** Fetch user info from twitterapi.io (Get User by Username). */
export async function fetchXUserInfo(
  userName: string,
  apiKey: string
): Promise<{ followers?: number; following?: number; statusesCount?: number; favouritesCount?: number; name?: string; description?: string; profilePicture?: string; userName?: string } | null> {
  const u = userName.trim().replace(/^@/, "");
  if (!u) return null;
  const res = await fetch(`${TWITTERAPI_BASE}/twitter/user/info?userName=${encodeURIComponent(u)}`, {
    headers: { "X-API-Key": apiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data;
  if (!data || json?.status === "error") return null;
  return data;
}

/** Tweet shape from twitterapi.io GET /twitter/user/last_tweets */
export type XTweetRaw = {
  id: string;
  text?: string;
  likeCount?: number;
  replyCount?: number;
  retweetCount?: number;
  quoteCount?: number;
  viewCount?: number;
  createdAt?: string;
};

/** Fetch up to `maxTweets` most recent tweets for a user. Paginates (20 per page). */
export async function fetchXUserTweets(
  userName: string,
  apiKey: string,
  maxTweets: number = 50
): Promise<XTweetRaw[]> {
  const u = userName.trim().replace(/^@/, "");
  if (!u) return [];
  const out: XTweetRaw[] = [];
  let cursor: string = "";
  while (out.length < maxTweets) {
    const params = new URLSearchParams({ userName: u });
    if (cursor) params.set("cursor", cursor);
    const res = await fetch(`${TWITTERAPI_BASE}/twitter/user/last_tweets?${params.toString()}`, {
      headers: { "X-API-Key": apiKey },
      next: { revalidate: 0 },
    });
    if (!res.ok) break;
    const json = await res.json();
    const tweets: XTweetRaw[] = json?.tweets ?? [];
    if (tweets.length === 0) break;
    for (const t of tweets) {
      if (out.length >= maxTweets) break;
      out.push(t);
    }
    if (!json?.has_next_page || !json?.next_cursor) break;
    cursor = json.next_cursor;
  }
  return out.slice(0, maxTweets);
}

/** Parse twitterapi.io createdAt (e.g. "Tue Dec 10 07:00:30 +0000 2024") to ISO. */
export function parseTweetCreatedAt(createdAt: string | undefined): string | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

/** Insert tweets into x_tweets; skip existing tweet_id. */
export async function insertXTweets(
  supabase: SupabaseClient,
  profileId: string,
  tweets: XTweetRaw[]
): Promise<{ inserted: number }> {
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
  return { inserted };
}

/** engagement_score = likes + 2*replies + reposts + quotes (simple formula). */
export function engagementScore(
  likeCount: number,
  replyCount: number,
  repostCount: number,
  quoteCount: number
): number {
  return likeCount + 2 * replyCount + repostCount + quoteCount;
}

/** Compute rollups and top drivers from x_tweets for a profile and upsert. */
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

  const tweets = (rows ?? []) as Array<{
    tweet_id: string;
    tweeted_at: string;
    like_count: number;
    reply_count: number;
    repost_count: number;
    quote_count: number;
  }>;

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
        engagementScoreSum: 0,
        inWindow: [] as typeof tweets,
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
          0
        ),
      0
    );
    const engagementRate =
      followersTotal > 0 ? (engagementScoreSum / n / followersTotal) * 100 : 0;
    // Potential reach: followers × engagement rate, capped at followers (industry: reach ≤ audience).
    const reachProxy = Math.min(
      followersTotal,
      Math.round(followersTotal * (engagementRate / 100))
    );
    return {
      posts: n,
      avgLikes,
      avgReplies,
      engagementRate,
      reachProxy,
      engagementScoreSum,
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

  // Top 10 drivers for 30D window (by engagement_score; likes + replies + reposts only, no quote_count)
  const top30 = w30.inWindow
    .map((t) => ({
      ...t,
      score: engagementScore(
        t.like_count ?? 0,
        t.reply_count ?? 0,
        t.repost_count ?? 0,
        0
      ),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  for (const t of top30) {
    const tweetId = t.tweet_id;
    if (!tweetId) continue;
    await supabase.from("x_top_drivers").upsert(
      {
        profile_id: profileId,
        window_days: 30,
        tweet_id: tweetId,
        tweeted_at: t.tweeted_at,
        like_count: t.like_count ?? 0,
        reply_count: t.reply_count ?? 0,
        repost_count: t.repost_count ?? 0,
        engagement_score: t.score,
      },
      { onConflict: "profile_id,window_days,tweet_id" }
    );
  }
}
