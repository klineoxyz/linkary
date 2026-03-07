/**
 * Server-only X analytics: twitterapi.io fetch, tweet storage, rollup computation.
 * Use from API routes or cron only. Never expose TWITTERAPI_API_KEY to client.
 */
import { createClient, SupabaseClient } from "@supabase/supabase-js";
import { debugSync } from "@/lib/server-error";
import { xApiFetchSafe, type XApiFailureCode } from "@/lib/x-api-client";

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

  // REP input: avg engagement per post (raw count). Used by computeRep() with log scaling.
  // Guardrail: when posts_30d === 0, do NOT overwrite existing value.
  if (w30.posts > 0) {
    const avgEngagementPerPost = Math.round((w30.engagementScoreSum / w30.posts) * 100) / 100;
    await supabase
      .from("profiles")
      .update({
        avg_engagement_per_post: avgEngagementPerPost,
        updated_at: now.toISOString(),
      })
      .eq("id", profileId);
    if (process.env.NODE_ENV !== "test") {
      console.log("[ENG_ROLLUP] profile_id=" + profileId + " avg_engagement_per_post=" + avgEngagementPerPost + " posts_30d=" + w30.posts + " source=rollup");
    }
  }

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

// --- X Spaces (twitterapi.io Get Space Detail); audience overlap for registered users only ---

export type XSpaceParticipant = { id?: string; userName?: string };
export type XSpaceDetail = {
  id: string;
  title?: string;
  state?: string;
  scheduled_start?: string;
  creator?: { id?: string; userName?: string };
  participants?: { admins?: XSpaceParticipant[]; speakers?: XSpaceParticipant[]; listeners?: XSpaceParticipant[] };
};

const X_API_BASE = "https://api.twitter.com/2";

export type FetchXSpaceByIdV2Result =
  | { space: { id: string; title?: string; state?: string; created_at?: string; scheduled_start?: string; host_ids?: string[] }; xStatus?: undefined; code?: undefined }
  | { space: null; xStatus: number; code?: "X_RECONNECT_NEEDED" | "X_RATE_LIMITED" | "X_CREDITS_DEPLETED" | "SPACE_NOT_FOUND" | "X_API_TIMEOUT" | "INVALID_X_RESPONSE" | "X_API_FAILED" };

/** Fetch Space by ID from X API v2 (Bearer token). Uses shared xApiFetchSafe. Returns { space } on success or { space: null, xStatus } on X error. */
export async function fetchXSpaceByIdV2(
  spaceId: string,
  accessToken: string
): Promise<FetchXSpaceByIdV2Result> {
  const id = String(spaceId ?? "").trim();
  if (!id || !accessToken) return { space: null, xStatus: 0 };
  const fields = "title,state,created_at,scheduled_start,host_ids";
  const url = `${X_API_BASE}/spaces/${encodeURIComponent(id)}?space.fields=${encodeURIComponent(fields)}`;
  const result = await xApiFetchSafe(url, accessToken);
  const debugSyncFromX = process.env.DEBUG_SYNC_FROM_X === "1" || process.env.DEBUG_SYNC_FROM_X === "true";
  if (debugSyncFromX) {
    debugSync("X_API_CALL_RESPONSE", JSON.stringify({ status: result.status, code: result.code }));
    if (!result.ok && "bodyText" in result && result.bodyText) debugSync("X_API_CALL_BODY", result.bodyText);
  }
  if (!result.ok) {
    const status = result.code === "X_API_TIMEOUT" ? 0 : result.status;
    return { space: null, xStatus: status, code: result.code as XApiFailureCode };
  }
  const json = result.data as { data?: { id?: string; title?: string; state?: string; created_at?: string; scheduled_start?: string; host_ids?: string[] } };
  const data = json?.data;
  if (!data || !data.id) return { space: null, xStatus: 0, code: "X_API_FAILED" };
  return { space: data as { id: string; title?: string; state?: string; created_at?: string; scheduled_start?: string; host_ids?: string[] } };
}

/** Fetch Spaces by creator (X API v2 GET /2/spaces/by/creator_ids). Uses shared xApiFetchSafe. For my-x-spaces and detect-my-space. */
export async function fetchSpacesByCreatorId(
  xUserId: string,
  accessToken: string,
  spaceFields: string
): Promise<import("@/lib/x-api-client").XApiResult> {
  const url = `${X_API_BASE}/spaces/by/creator_ids?user_ids=${encodeURIComponent(xUserId)}&space.fields=${encodeURIComponent(spaceFields)}`;
  return xApiFetchSafe(url, accessToken);
}

/** Fetch Space detail by ID from twitterapi.io. Returns null on error or missing data. */
export async function fetchXSpaceDetail(spaceId: string, apiKey: string): Promise<XSpaceDetail | null> {
  const id = String(spaceId ?? "").trim();
  if (!id) return null;
  const res = await fetch(`${TWITTERAPI_BASE}/twitter/spaces/detail?space_id=${encodeURIComponent(id)}`, {
    headers: { "X-API-Key": apiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) return null;
  const json = await res.json();
  const data = json?.data;
  if (!data || json?.status === "error") return null;
  return data as XSpaceDetail;
}

/** Collect unique X user IDs from Space participants (admins + speakers + listeners). Use id if present, else userName. */
export function spaceParticipantIds(detail: XSpaceDetail): string[] {
  const ids = new Set<string>();
  const push = (p: XSpaceParticipant | undefined) => {
    if (!p) return;
    const v = (p.id ?? p.userName ?? "").toString().trim();
    if (v) ids.add(v);
  };
  for (const a of detail.participants?.admins ?? []) push(a);
  for (const s of detail.participants?.speakers ?? []) push(s);
  for (const l of detail.participants?.listeners ?? []) push(l);
  return Array.from(ids);
}

/** |A ∩ B|. */
export function audienceOverlapCount(idsA: string[], idsB: string[]): number {
  if (idsA.length === 0 || idsB.length === 0) return 0;
  const setB = new Set(idsB);
  return idsA.filter((id) => setB.has(id)).length;
}

/** Raw overlap % = (overlap_count / min_audience_size) * 100. Returns 0 if either set is empty. */
export function audienceOverlapPercentRaw(idsA: string[], idsB: string[]): number {
  if (idsA.length === 0 || idsB.length === 0) return 0;
  const intersection = audienceOverlapCount(idsA, idsB);
  const minSize = Math.min(idsA.length, idsB.length);
  return minSize === 0 ? 0 : (intersection / minSize) * 100;
}

/** Overlap % rounded to 1 decimal (consistent across backend and display). */
export function audienceOverlapPercentRounded(idsA: string[], idsB: string[]): number {
  const raw = audienceOverlapPercentRaw(idsA, idsB);
  return Math.round(raw * 10) / 10;
}

/** @deprecated Use audienceOverlapPercentRounded for display. */
export function audienceOverlapPercent(idsA: string[], idsB: string[]): number {
  return audienceOverlapPercentRounded(idsA, idsB);
}
