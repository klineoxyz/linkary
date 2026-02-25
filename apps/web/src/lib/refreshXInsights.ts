/**
 * Phase 4: Refresh X insights from twitterapi.io and write to cache tables.
 * Used by POST /api/admin/social/x/refresh-insights. Stub fetchers until TWITTERAPI_IO_KEY is wired.
 */
import { createServiceSupabase } from "@/lib/x-analytics-server";
import type {
  XTopFollowersCachePayload,
  XAccountFeedCachePayload,
  XMentionsCachePayload,
} from "./socialInsightsContracts";

export type RefreshResult = { ok: true; skipped?: boolean } | { ok: false; error: string };

/** Stub: fetch top followers from twitterapi.io. TODO: implement when API contract is confirmed. */
async function fetchTopFollowers(_username: string, _apiKey: string): Promise<XTopFollowersCachePayload> {
  // TODO: GET /twitter/user/followers or equivalent; map to influencers/projects/funds by tier
  return { influencers: [], projects: [], funds: [] };
}

/** Stub: fetch mentions for the last 7 days. TODO: implement when API available. */
async function fetchMentions(_username: string, _apiKey: string): Promise<XMentionsCachePayload> {
  // TODO: twitterapi.io mentions endpoint
  return [];
}

/** Stub: fetch account feed (actions, new followers). TODO: implement when API available. */
async function fetchAccountFeed(_username: string, _apiKey: string): Promise<XAccountFeedCachePayload> {
  // TODO: twitterapi.io feed/timeline endpoint
  return { actions: [], newFollowers: [] };
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

/**
 * Refresh X insights for a profile: fetch from twitterapi.io (or stub) and write to cache tables.
 * Returns { ok: true, skipped: true } when TWITTERAPI_IO_KEY is not set (safe for dev).
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

  try {
    const [topPayload, mentionsPayload, feedPayload] = await Promise.all([
      fetchTopFollowers(handle, apiKey),
      fetchMentions(handle, apiKey),
      fetchAccountFeed(handle, apiKey),
    ]);

    const weekStart = getCurrentWeekStart();

    await Promise.all([
      supabase.from("x_top_followers_cache").upsert(
        { profile_id: profileId, data: topPayload, updated_at: new Date().toISOString() },
        { onConflict: "profile_id" }
      ),
      supabase.from("x_account_feed_cache").upsert(
        { profile_id: profileId, data: feedPayload, updated_at: new Date().toISOString() },
        { onConflict: "profile_id" }
      ),
      supabase.from("x_mentions_weekly_cache").upsert(
        { profile_id: profileId, week_start: weekStart, data: mentionsPayload, updated_at: new Date().toISOString() },
        { onConflict: "profile_id,week_start" }
      ),
    ]);
  } catch (e) {
    console.error("[refreshXInsights] write failed", e);
    return { ok: false, error: e instanceof Error ? e.message : "Write failed" };
  }

  return { ok: true };
}
