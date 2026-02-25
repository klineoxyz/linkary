/**
 * Phase 4.1: Refresh X insights from twitterapi.io and write to cache tables.
 * Real fetchers: followers, mentions, account feed. Partial writes; rate-limit does not overwrite cache.
 */
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { twitterapiFetch, TwitterApiError } from "@/lib/twitterapiClient";
import {
  stripPrivateStorageUrlsFromAvatar,
  normalizeUsername,
  type TopFollowerItem,
  type XTopFollowersCachePayload,
  type XAccountFeedCachePayload,
  type XMentionsCachePayload,
  type AccountFeedItem,
  type MentionItem,
} from "./socialInsightsContracts";

export type RefreshResult =
  | { ok: true; skipped?: boolean; reason?: string; resetAt?: string }
  | { ok: false; error: string };

const CAP_MENTIONS = 50;
const CAP_FOLLOWERS_TOP = 50;
const CAP_LAST_TWEETS = 20;
const CAP_NEW_FOLLOWERS = 20;

/** Parse twitterapi.io createdAt to ISO. */
function parseCreatedAt(createdAt: string | undefined): string {
  if (!createdAt || typeof createdAt !== "string") return new Date().toISOString();
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? new Date().toISOString() : d.toISOString();
}

/** Phase 9: Heuristic categorization for top followers. Tweak here to improve later. */
function categorizeFollower(
  name: string | null | undefined,
  _username: string,
  followers: number | null,
  verified: boolean | null | undefined
): "influencer" | "project" | "fund" {
  const n = (name ?? "").trim().toLowerCase();
  const fundPatterns = ["capital", "ventures", "fund", "vc ", " vc", "partners", "asset"];
  if (fundPatterns.some((p) => n.includes(p))) return "fund";
  const projectPatterns = ["token", "protocol", "labs", "dao", "network", "chain", "defi", "dex", ".io"];
  if (projectPatterns.some((p) => n.includes(p))) return "project";
  if (verified === true || (typeof followers === "number" && followers >= 50000)) return "influencer";
  return "influencer";
}

/** GET /twitter/user/followers — first page, map to XTopFollowersCachePayload. Categorize into influencers/projects/funds. */
async function fetchTopFollowers(username: string): Promise<XTopFollowersCachePayload> {
  try {
    const { data } = await twitterapiFetch("/twitter/user/followers", {
      userName: username,
      pageSize: String(Math.min(200, Math.max(20, CAP_FOLLOWERS_TOP))),
    });
    const obj = data as Record<string, unknown>;
    const list = Array.isArray(obj.followers) ? obj.followers : [];
    const influencers: TopFollowerItem[] = [];
    const projects: TopFollowerItem[] = [];
    const funds: TopFollowerItem[] = [];
    for (const u of list.slice(0, CAP_FOLLOWERS_TOP)) {
      const row = u as Record<string, unknown>;
      const uname = normalizeUsername((row.userName ?? row.user_name ?? row.screen_name) as string);
      if (!uname) continue;
      const avatar = (row.profilePicture ?? row.profile_picture ?? row.avatar) as string | undefined;
      const followers = typeof row.followers === "number" ? row.followers : null;
      const verified = row.verified as boolean | null | undefined;
      const name = (row.name as string) || undefined;
      const category = categorizeFollower(name, uname, followers, verified);
      const item: TopFollowerItem = {
        username: uname,
        name: name ?? undefined,
        avatar: stripPrivateStorageUrlsFromAvatar(avatar) ?? null,
        followers,
        score: null,
        tier: null,
        category,
      };
      if (category === "fund") funds.push(item);
      else if (category === "project") projects.push(item);
      else influencers.push(item);
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[refreshXInsights] top_followers influencers=" + influencers.length + " projects=" + projects.length + " funds=" + funds.length);
    }
    return { influencers, projects, funds };
  } catch (e) {
    if (e instanceof TwitterApiError && e.code === "RATE_LIMITED") throw e;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[refreshXInsights] fetchTopFollowers failed", e instanceof Error ? e.message : e);
    }
    return { influencers: [], projects: [], funds: [] };
  }
}

/** GET /twitter/user/mentions — last 7 days (or week aligned to weekStart when provided). Cap 50. */
async function fetchMentions(username: string, weekStart?: string): Promise<XMentionsCachePayload> {
  let sinceTime: number;
  const now = Math.floor(Date.now() / 1000);
  if (weekStart) {
    const start = new Date(weekStart + "T00:00:00Z").getTime() / 1000;
    sinceTime = Math.max(start, now - 7 * 24 * 3600);
  } else {
    sinceTime = now - 7 * 24 * 3600;
  }
  const out: MentionItem[] = [];
  let cursor = "";
  try {
    while (out.length < CAP_MENTIONS) {
      const params: Record<string, string> = {
        userName: username,
        sinceTime: String(sinceTime),
        untilTime: String(now),
      };
      if (cursor) params.cursor = cursor;
      const { data } = await twitterapiFetch("/twitter/user/mentions", params);
      const obj = data as Record<string, unknown>;
      const tweets = Array.isArray(obj.tweets) ? obj.tweets : [];
      for (const t of tweets) {
        if (out.length >= CAP_MENTIONS) break;
        const row = t as Record<string, unknown>;
        const author = row.author as Record<string, unknown> | undefined;
        const at = parseCreatedAt(row.createdAt as string);
        const tweetId = (row.id ?? row.id_str) as string | undefined;
        const text = (row.text ?? row.full_text) as string | undefined;
        const url = (row.url ?? (tweetId ? `https://x.com/i/status/${tweetId}` : undefined)) as string | undefined;
        const authorName = author
          ? normalizeUsername((author.userName ?? author.user_name ?? author.screen_name) as string)
          : "";
        out.push({
          at,
          tweet_id: tweetId,
          username: authorName || "unknown",
          text: text ?? undefined,
          url: url ?? undefined,
        });
      }
      if (tweets.length === 0 || !obj.has_next_page || !obj.next_cursor) break;
      cursor = String(obj.next_cursor ?? "");
    }
    if (process.env.NODE_ENV !== "production") {
      console.log("[refreshXInsights] mentions count=" + out.length);
    }
    return out;
  } catch (e) {
    if (e instanceof TwitterApiError && e.code === "RATE_LIMITED") throw e;
    if (process.env.NODE_ENV !== "production") {
      console.warn("[refreshXInsights] fetchMentions failed", e instanceof Error ? e.message : e);
    }
    return [];
  }
}

/** Actions from last_tweets; newFollowers from first page of followers. */
async function fetchAccountFeed(username: string): Promise<XAccountFeedCachePayload> {
  const actions: AccountFeedItem[] = [];
  const newFollowers: AccountFeedItem[] = [];

  try {
    const { data: tweetsData } = await twitterapiFetch("/twitter/user/last_tweets", {
      userName: username,
    });
    const tweetsObj = tweetsData as Record<string, unknown>;
    const tweets = Array.isArray(tweetsObj.tweets) ? tweetsObj.tweets : [];
    for (const t of tweets.slice(0, CAP_LAST_TWEETS)) {
      const row = t as Record<string, unknown>;
      actions.push({
        type: "tweet",
        at: parseCreatedAt(row.createdAt as string),
        text: (row.text ?? row.full_text) as string | undefined,
        username,
      });
    }
  } catch (e) {
    if (e instanceof TwitterApiError && e.code === "RATE_LIMITED") throw e;
  }

  try {
    const { data: followersData } = await twitterapiFetch("/twitter/user/followers", {
      userName: username,
      pageSize: String(Math.min(200, Math.max(20, CAP_NEW_FOLLOWERS))),
    });
    const followersObj = followersData as Record<string, unknown>;
    const list = Array.isArray(followersObj.followers) ? followersObj.followers : [];
    const nowIso = new Date().toISOString();
    for (const u of list.slice(0, CAP_NEW_FOLLOWERS)) {
      const row = u as Record<string, unknown>;
      const uname = normalizeUsername((row.userName ?? row.user_name) as string);
      if (!uname) continue;
      const avatar = (row.profilePicture ?? row.profile_picture) as string | undefined;
      const safeAvatar = stripPrivateStorageUrlsFromAvatar(avatar) ?? null;
      newFollowers.push({
        type: "new_follower",
        at: nowIso,
        username: uname,
        avatar: safeAvatar,
      });
    }
  } catch (e) {
    if (e instanceof TwitterApiError && e.code === "RATE_LIMITED") throw e;
  }

  if (process.env.NODE_ENV !== "production") {
    console.log("[refreshXInsights] feed actions=" + actions.length + " newFollowers=" + newFollowers.length);
  }
  return { actions, newFollowers };
}

/** Monday of current week (ISO) as YYYY-MM-DD. */
function getCurrentWeekStart(): string {
  const today = new Date();
  const dayOfWeek = today.getUTCDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(today);
  monday.setUTCDate(today.getUTCDate() + mondayOffset);
  return monday.toISOString().slice(0, 10);
}

const GLOBAL_STATE_KEY = "global";

/**
 * Refresh X insights for a profile. Partial success: write each section that succeeds.
 * Phase 6: Check global rate limit before any API call; on RATE_LIMITED persist and do NOT write cache.
 */
export async function refreshXInsightsForProfile(profileId: string): Promise<RefreshResult> {
  const apiKey = process.env.TWITTERAPI_IO_KEY ?? process.env.TWITTERAPI_API_KEY;
  if (!apiKey) {
    console.warn("[refreshXInsights] TWITTERAPI_IO_KEY not set; skipping fetch");
    return { ok: true, skipped: true };
  }

  let supabase;
  try {
    supabase = createServiceSupabase();
  } catch (e) {
    console.error("[refreshXInsights] createServiceSupabase failed", e);
    return { ok: false, error: "Service unavailable" };
  }

  // Phase 6: respect global rate limit (do not call twitterapi until resetAt)
  const { data: stateRow } = await supabase
    .from("x_insights_refresh_state")
    .select("rate_limited_until")
    .eq("key", GLOBAL_STATE_KEY)
    .maybeSingle();
  const rateLimitedUntil = (stateRow as { rate_limited_until: string | null } | null)?.rate_limited_until;
  if (rateLimitedUntil) {
    const until = new Date(rateLimitedUntil).getTime();
    if (Date.now() < until) {
      if (process.env.NODE_ENV !== "production") {
        console.log("[refreshXInsights] GLOBAL_RATE_LIMIT; backoff until", rateLimitedUntil);
      }
      return {
        ok: true,
        skipped: true,
        reason: "GLOBAL_RATE_LIMIT",
        resetAt: rateLimitedUntil,
      };
    }
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, twitter_username")
    .eq("id", profileId)
    .maybeSingle();

  if (profileError || !profile) {
    return { ok: false, error: "Profile not found" };
  }

  const username = (profile as { twitter_username?: string | null }).twitter_username;
  if (!username || typeof username !== "string" || !username.trim()) {
    return { ok: false, error: "Profile has no twitter_username" };
  }

  const handle = username.trim().replace(/^@/, "").toLowerCase();
  if (!handle) {
    return { ok: false, error: "Invalid twitter_username" };
  }

  let topPayload: XTopFollowersCachePayload = { influencers: [], projects: [], funds: [] };
  let mentionsPayload: XMentionsCachePayload = [];
  let feedPayload: XAccountFeedCachePayload = { actions: [], newFollowers: [] };
  let rateLimited = false;
  let resetAt: string | undefined;

  const weekStart = getCurrentWeekStart();
  try {
    const [top, mentions, feed] = await Promise.all([
      fetchTopFollowers(handle),
      fetchMentions(handle, weekStart),
      fetchAccountFeed(handle),
    ]);
    topPayload = top;
    mentionsPayload = mentions;
    feedPayload = feed;
  } catch (e) {
    if (e instanceof TwitterApiError && e.code === "RATE_LIMITED") {
      rateLimited = true;
      resetAt = e.resetAt;
      if (process.env.NODE_ENV !== "production") {
        console.log("[refreshXInsights] RATE_LIMITED; not overwriting cache resetAt=" + resetAt);
      }
      if (resetAt) {
        try {
          await supabase.from("x_insights_refresh_state").upsert(
            {
              key: GLOBAL_STATE_KEY,
              rate_limited_until: resetAt,
              last_error: "RATE_LIMITED",
              updated_at: new Date().toISOString(),
            },
            { onConflict: "key" }
          );
        } catch (writeErr) {
          console.warn("[refreshXInsights] failed to persist rate limit state", writeErr);
        }
      }
      return { ok: true, skipped: true, reason: "RATE_LIMITED", resetAt };
    }
    console.error("[refreshXInsights] fetch failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Fetch failed" };
  }

  try {
    await supabase.from("x_top_followers_cache").upsert(
      { profile_id: profileId, data: topPayload, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );
    await supabase.from("x_account_feed_cache").upsert(
      { profile_id: profileId, data: feedPayload, updated_at: new Date().toISOString() },
      { onConflict: "profile_id" }
    );
    await supabase.from("x_mentions_weekly_cache").upsert(
      { profile_id: profileId, week_start: weekStart, data: mentionsPayload, updated_at: new Date().toISOString() },
      { onConflict: "profile_id,week_start" }
    );
    await supabase.from("x_insights_refresh_state").upsert(
      { key: GLOBAL_STATE_KEY, rate_limited_until: null, last_error: null, updated_at: new Date().toISOString() },
      { onConflict: "key" }
    );
  } catch (e) {
    console.error("[refreshXInsights] write failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Write failed" };
  }

  return { ok: true };
}
