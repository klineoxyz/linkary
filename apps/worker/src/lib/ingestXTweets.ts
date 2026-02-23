/**
 * Ingest tweets for a profile into public.x_tweets.
 * Fetches from twitterapi.io, maps to schema, UPSERTs on (profile_id, tweet_id).
 * Returns { fetched, upserted, inserted } and throws if fetched > 0 but upserted === 0.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRecentTweets } from "./twitterapi.js";
import type { TweetRaw } from "./twitterapi.js";

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
};

export type IngestXTweetsResult = {
  fetched: number;
  upserted: number;
  inserted: number;
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
  const { profile_id, twitter_username, maxTweets = 50 } = params;
  const handle = twitter_username.trim().replace(/^@/, "").toLowerCase();
  if (!handle) {
    console.log("[X_TWEETS] start profile_id=" + profile_id + " handle=@(empty) skip");
    return { fetched: 0, upserted: 0, inserted: 0 };
  }

  const since = params.since ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19);
  const until = params.until ?? new Date().toISOString().slice(0, 19);
  console.log("[X_TWEETS] start profile_id=" + profile_id + " handle=@" + handle + " since=" + since + " until=" + until);

  const tweets = await getRecentTweets(handle, maxTweets);
  const fetched = tweets.length;
  console.log("[X_TWEETS] fetched=" + fetched);

  const rows: Record<string, unknown>[] = [];
  for (const t of tweets) {
    const row = tweetToRow(profile_id, t);
    if (row) rows.push(row);
  }

  if (rows.length === 0) {
    console.log("[X_TWEETS] done (no rows to upsert)");
    return { fetched, upserted: 0, inserted: 0 };
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
  const after = countAfter ?? before + rows.length;
  const inserted = Math.max(0, after - before);
  const upserted = rows.length;

  if (fetched > 0 && upserted === 0) {
    const msg =
      "[X_TWEETS] fetched>0 but upserted=0. conflict_target=" +
      X_TWEETS_CONFLICT +
      " payload_keys=" +
      Object.keys(rows[0] ?? {}).join(",") +
      " table_columns=" +
      X_TWEETS_COLUMNS.join(",");
    console.error(msg);
    throw new Error(msg);
  }

  console.log("[X_TWEETS] upserted=" + upserted + " inserted=" + inserted);
  console.log("[X_TWEETS] done");
  return { fetched, upserted, inserted };
}
