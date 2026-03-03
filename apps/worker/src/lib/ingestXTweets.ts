/**
 * Ingest tweets for a profile into public.x_tweets.
 * Fetches from twitterapi.io, maps to schema, UPSERTs on (profile_id, tweet_id).
 * Retweets (text starting with "RT @") are never inserted.
 * Returns { fetched, upserted, inserted } and throws if fetched > 0 but upserted === 0.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecentTweets } from "./twitterapi.js";
import type { TweetRaw } from "./twitterapi.js";

/** True if text is a retweet (starts with "RT @" after trim). */
export function isRetweetText(text: string | null | undefined): boolean {
  if (text == null || typeof text !== "string") return false;
  return text.trim().toLowerCase().startsWith("rt @");
}

export type TweetEngagement = {
  like_count?: number | null;
  reply_count?: number | null;
  repost_count?: number | null;
  likeCount?: number | null;
  replyCount?: number | null;
  retweetCount?: number | null;
};

/**
 * True if tweet engagement is an outlier (provider spike) relative to follower count.
 * engagement = likes + replies + reposts. If followers_total is missing or 0, returns false.
 * Outlier if: likes > followers_total*2 OR reposts > followers_total*0.5 OR engagement > followers_total*3.
 */
export function isOutlierTweet(
  tweet: TweetEngagement,
  followers_total: number | null | undefined
): boolean {
  if (followers_total == null || !Number.isFinite(followers_total) || followers_total <= 0) return false;
  const likes = Math.max(0, Number(tweet.like_count ?? tweet.likeCount) || 0);
  const replies = Math.max(0, Number(tweet.reply_count ?? tweet.replyCount) || 0);
  const reposts = Math.max(0, Number(tweet.repost_count ?? tweet.retweetCount) || 0);
  const engagement = likes + replies + reposts;
  if (likes > followers_total * 2) return true;
  if (reposts > followers_total * 0.5) return true;
  if (engagement > followers_total * 3) return true;
  return false;
}

const X_TWEETS_CONFLICT = "profile_id,tweet_id";
const X_TWEETS_COLUMNS = [
  "profile_id",
  "tweet_id",
  "tweeted_at",
  "text",
  "like_count",
  "reply_count",
  "repost_count",
  "quote_count",
  "impression_count",
  "raw",
];

function parseTweetCreatedAt(createdAt: string | undefined): string | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function tweetToRow(profileId: string, t: TweetRaw): Record<string, unknown> | null {
  const tweetId = String(t.id ?? "").trim();
  if (!tweetId) return null;
  const tweetedAt = parseTweetCreatedAt(t.createdAt);
  if (!tweetedAt) return null;
  return {
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
  };
}

export type IngestXTweetsParams = {
  profile_id: string;
  twitter_username: string;
  since?: string;
  until?: string;
  maxTweets?: number;
  /** If set, tweets with outlier engagement (vs followers_total) are skipped and logged. */
  followers_total?: number | null;
};

export type IngestXTweetsResult = {
  fetched: number;
  upserted: number;
  inserted: number;
  skipped_outliers?: number;
};

/**
 * Fetch tweets for the handle and UPSERT into public.x_tweets.
 * Logs [X_TWEETS] start, fetched, upserted, inserted, done.
 * Throws if fetched > 0 but no rows were upserted (with conflict target and column details).
 */
export async function ingestXTweets(
  supabase: SupabaseClient,
  params: IngestXTweetsParams
): Promise<IngestXTweetsResult> {
  const { profile_id, twitter_username, maxTweets = 50, followers_total } = params;
  const username = twitter_username.trim().replace(/^@/, "");
  const handle = username.toLowerCase();
  if (!handle) {
    console.log("[X_TWEETS] start profile_id=" + profile_id + " handle=@(empty) skip");
    return { fetched: 0, upserted: 0, inserted: 0 };
  }

  console.log("[X_TWEETS] normalized_handle=" + handle);
  const since = params.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const until = params.until ?? new Date().toISOString().slice(0, 19);
  console.log("[X_TWEETS] start profile_id=" + profile_id + " handle=" + handle + " since=" + since + " until=" + until);

  const tweets = await getRecentTweets(handle, maxTweets);
  const fetched_total = tweets.length;
  let skipped_retweets = 0;
  let skipped_outliers = 0;
  const rows: Record<string, unknown>[] = [];
  for (const t of tweets) {
    if (isRetweetText(t.text)) {
      skipped_retweets += 1;
      continue;
    }
    if (followers_total != null && isOutlierTweet(t, followers_total)) {
      skipped_outliers += 1;
      console.log("[X_OUTLIER] profile_id=" + profile_id + " tweet_id=" + (t.id ?? "?") + " likes=" + (t.likeCount ?? 0) + " reposts=" + (t.retweetCount ?? 0) + " followers_total=" + followers_total);
      continue;
    }
    const row = tweetToRow(profile_id, t);
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    console.log("[X_TWEETS] fetched_total=" + fetched_total + " skipped_retweets=" + skipped_retweets + " skipped_outliers=" + skipped_outliers + " upserted=0");
    return { fetched: fetched_total, upserted: 0, inserted: 0, skipped_outliers };
  }
  if (skipped_retweets > 0 || skipped_outliers > 0) {
    console.log("[X_TWEETS] fetched_total=" + fetched_total + " skipped_retweets=" + skipped_retweets + " skipped_outliers=" + skipped_outliers);
  }

  // Dedupe by (profile_id, tweet_id) so ON CONFLICT DO UPDATE does not see the same row twice
  const seen = new Set<string>();
  const deduped = rows.filter((r) => {
    const key = String(r.profile_id) + ":" + String(r.tweet_id);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  if (deduped.length < rows.length) {
    console.log("[X_TWEETS] deduped " + rows.length + " -> " + deduped.length + " rows (duplicate tweet_id in batch)");
  }

  const { count: countBefore } = await supabase
    .from("x_tweets")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profile_id);
  const before = countBefore ?? 0;

  const { error } = await supabase.from("x_tweets").upsert(rows, {
    onConflict: X_TWEETS_CONFLICT,
  });

  if (error) {
    const msg =
      "[X_TWEETS] upsert failed. conflict_target=" +
      X_TWEETS_CONFLICT +
      " key_columns=profile_id,tweet_id payload_keys=" +
      Object.keys(rows[0] ?? {}).join(",") +
      " table_columns=" +
      X_TWEETS_COLUMNS.join(",") +
      " error=" +
      error.message;
    console.error(msg);
    throw new Error(msg);
  }

  const { count: countAfter } = await supabase
    .from("x_tweets")
    .select("*", { count: "exact", head: true })
    .eq("profile_id", profile_id);
  const after = countAfter ?? before + deduped.length;
  const inserted = Math.max(0, after - before);
  const upserted = deduped.length;
  console.log("[X_TWEETS] fetched_total=" + fetched_total + " skipped_retweets=" + skipped_retweets + " upserted=" + upserted);

  if (fetched_total > 0 && upserted === 0) {
    const msg =
      "[X_TWEETS] fetched>0 but upserted=0. conflict_target=" +
      X_TWEETS_CONFLICT +
      " payload_keys=" +
      Object.keys(deduped[0] ?? {}).join(",") +
      " table_columns=" +
      X_TWEETS_COLUMNS.join(",");
    console.error(msg);
    throw new Error(msg);
  }

  console.log("[X_TWEETS] done");
  return { fetched: fetched_total, upserted, inserted, skipped_outliers };
}
