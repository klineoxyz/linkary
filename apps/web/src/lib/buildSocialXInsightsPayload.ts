/**
 * Builds full X social insights payload (series, caches, top followers).
 * Used by GET /api/social/x/insights (owner/cron only) and GET /api/social/insights (owner path).
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import {
  type XTopFollowersCachePayload,
  type XAccountFeedCachePayload,
  type XMentionsCachePayload,
  sanitizeTopFollowerItem,
  sanitizeAccountFeedItem,
  stripPrivateStorageUrlsFromAvatar,
} from "@/lib/socialInsightsContracts";

const CACHE_STALE_MS = 24 * 60 * 60 * 1000;

export interface SocialInsightsProfile {
  username: string;
  followers: number | null;
  following: number | null;
  tweets: number | null;
  joinedAt: string | null;
}

export interface SocialInsightsSeriesPoint {
  date: string;
  value: number;
}

export interface CacheBucketMeta {
  status: "hit" | "miss" | "stale";
  updatedAt: string | null;
}

export interface SocialInsightsResponse {
  profile: SocialInsightsProfile;
  series: {
    followers: SocialInsightsSeriesPoint[];
    score: SocialInsightsSeriesPoint[];
  };
  topFollowersByTier: {
    influencers: Array<{
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      followers: number | null;
      tier?: string;
    }>;
    projects: Array<{
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      followers: number | null;
      tier?: string;
    }>;
    funds: Array<{
      username: string;
      display_name: string | null;
      avatar_url: string | null;
      followers: number | null;
      tier?: string;
    }>;
  };
  mentionsLastWeek: unknown[];
  affiliatedAccounts: unknown[];
  accountFeed: {
    actions: unknown[];
    newFollowers: unknown[];
  };
  recommendedAccounts: unknown[];
  meta?: {
    cache: {
      topFollowers: CacheBucketMeta;
      feed: CacheBucketMeta;
      mentions: CacheBucketMeta;
    };
  };
}

function emptySocialInsights(username: string): SocialInsightsResponse {
  return {
    profile: {
      username,
      followers: null,
      following: null,
      tweets: null,
      joinedAt: null,
    },
    series: { followers: [], score: [] },
    topFollowersByTier: { influencers: [], projects: [], funds: [] },
    mentionsLastWeek: [],
    affiliatedAccounts: [],
    accountFeed: { actions: [], newFollowers: [] },
    recommendedAccounts: [],
    meta: {
      cache: {
        topFollowers: { status: "miss", updatedAt: null },
        feed: { status: "miss", updatedAt: null },
        mentions: { status: "miss", updatedAt: null },
      },
    },
  };
}

/**
 * @param normalizedUsername — lowercased handle without @
 */
export async function buildSocialXInsightsPayload(
  supabaseAnon: SupabaseClient,
  normalizedUsername: string
): Promise<SocialInsightsResponse> {
  const username = normalizedUsername;
  if (!username) return emptySocialInsights("");

  const { data: profileRow } = await supabaseAnon
    .from("public_profile_view")
    .select("id, username, twitter_username, followers_total, xscore, created_at")
    .or(`username.ilike.${username},twitter_username.ilike.${username}`)
    .maybeSingle();

  const p = profileRow as {
    id: string;
    username: string | null;
    twitter_username: string | null;
    followers_total: number | null;
    xscore: number | null;
    created_at: string | null;
  } | null;

  if (!p?.id) return emptySocialInsights(username);

  const handle = (p.username ?? p.twitter_username ?? "").toString().replace(/^@/, "").toLowerCase();
  const profileId = p.id;

  const { data: snapshotRows } = await supabaseAnon
    .from("x_daily_snapshots")
    .select("day, followers, tweets_count")
    .eq("owner_type", "profile")
    .eq("owner_id", profileId)
    .order("day", { ascending: false })
    .limit(90);

  const snapshots = (snapshotRows ?? []) as Array<{
    day: string;
    followers: number | null;
    tweets_count: number | null;
  }>;
  const latestSnapshot = snapshots[0];
  const followersFromSnapshot =
    latestSnapshot?.followers != null && Number.isFinite(latestSnapshot.followers)
      ? latestSnapshot.followers
      : null;
  const tweetsFromSnapshot =
    latestSnapshot?.tweets_count != null && Number.isFinite(latestSnapshot.tweets_count)
      ? latestSnapshot.tweets_count
      : null;

  const profile: SocialInsightsProfile = {
    username: handle,
    followers: followersFromSnapshot ?? (typeof p.followers_total === "number" ? p.followers_total : null),
    following: null,
    tweets: tweetsFromSnapshot,
    joinedAt: typeof p.created_at === "string" ? p.created_at : null,
  };

  const seriesFollowers: SocialInsightsSeriesPoint[] = snapshots
    .map((s) => ({
      date: s.day?.slice(0, 10) ?? "",
      value: typeof s.followers === "number" && Number.isFinite(s.followers) ? s.followers : 0,
    }))
    .filter((d) => d.date)
    .reverse();

  const scoreProxy = p.xscore != null && Number.isFinite(Number(p.xscore)) ? Number(p.xscore) : null;
  const seriesScore: SocialInsightsSeriesPoint[] =
    seriesFollowers.length > 0 && scoreProxy != null
      ? seriesFollowers.map((f) => ({ date: f.date, value: scoreProxy }))
      : [];

  const recommendedAccounts: Array<{ id: string; name: string; username: string; avatar_url: string | null }> = [];
  const { data: otherProfiles } = await supabaseAnon
    .from("public_profile_view")
    .select("id, username, display_name, avatar_url")
    .neq("id", profileId)
    .not("username", "is", null)
    .order("username", { ascending: true })
    .limit(5);
  if (otherProfiles?.length) {
    for (const row of otherProfiles as Array<{
      id: string;
      username: string | null;
      display_name: string | null;
      avatar_url: string | null;
    }>) {
      const u = (row.username ?? "").toString().replace(/^@/, "").toLowerCase();
      if (u) {
        recommendedAccounts.push({
          id: row.id,
          name: (row.display_name ?? u) as string,
          username: u,
          avatar_url: stripPrivateStorageUrlsFromAvatar(row.avatar_url) ?? null,
        });
      }
    }
  }

  let topFollowersByTier = emptySocialInsights(handle).topFollowersByTier;
  let mentionsLastWeek: unknown[] = [];
  let accountFeed = { actions: [] as unknown[], newFollowers: [] as unknown[] };
  let cacheMeta: SocialInsightsResponse["meta"] = {
    cache: {
      topFollowers: { status: "miss", updatedAt: null },
      feed: { status: "miss", updatedAt: null },
      mentions: { status: "miss", updatedAt: null },
    },
  };

  try {
    const service = createServiceSupabase();
    const now = Date.now();
    const today = new Date();
    const dayOfWeek = today.getUTCDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() + mondayOffset);
    const weekStart = monday.toISOString().slice(0, 10);

    const [topRes, feedRes, mentionsRes] = await Promise.all([
      service.from("x_top_followers_cache").select("data, updated_at").eq("profile_id", profileId).maybeSingle(),
      service.from("x_account_feed_cache").select("data, updated_at").eq("profile_id", profileId).maybeSingle(),
      service
        .from("x_mentions_weekly_cache")
        .select("data, updated_at")
        .eq("profile_id", profileId)
        .eq("week_start", weekStart)
        .maybeSingle(),
    ]);

    const topRow = topRes?.data as { data?: unknown; updated_at?: string } | null;
    const topPayload = topRow?.data as unknown as XTopFollowersCachePayload | null | undefined;
    const topUpdated = topRow?.updated_at ? new Date(topRow.updated_at).getTime() : 0;
    const topFresh = topUpdated && now - topUpdated <= CACHE_STALE_MS;
    if (topPayload && typeof topPayload === "object") {
      cacheMeta!.cache.topFollowers = {
        status: topFresh ? "hit" : "stale",
        updatedAt: topRow?.updated_at ?? null,
      };
      const infl = (Array.isArray(topPayload.influencers) ? topPayload.influencers : []).map(sanitizeTopFollowerItem);
      const proj = (Array.isArray(topPayload.projects) ? topPayload.projects : []).map(sanitizeTopFollowerItem);
      const funds = (Array.isArray(topPayload.funds) ? topPayload.funds : []).map(sanitizeTopFollowerItem);
      const mapTier = (items: typeof infl) =>
        items.map((i) => ({
          username: i.username,
          display_name: i.name ?? null,
          avatar_url: i.avatar ?? null,
          followers: i.followers ?? null,
          tier: i.tier ?? undefined,
        }));
      topFollowersByTier = {
        influencers: mapTier(infl),
        projects: mapTier(proj),
        funds: mapTier(funds),
      };
    } else if (topRow?.data != null) {
      cacheMeta!.cache.topFollowers = {
        status: topFresh ? "hit" : "stale",
        updatedAt: topRow?.updated_at ?? null,
      };
    }

    const feedRow = feedRes?.data as { data?: unknown; updated_at?: string } | null;
    const feedData = feedRow?.data as unknown as XAccountFeedCachePayload | null;
    const feedUpdated = feedRow?.updated_at ? new Date(feedRow.updated_at).getTime() : 0;
    const feedFresh = feedUpdated && now - feedUpdated <= CACHE_STALE_MS;
    if (feedData && typeof feedData === "object") {
      cacheMeta!.cache.feed = {
        status: feedFresh ? "hit" : "stale",
        updatedAt: feedRow?.updated_at ?? null,
      };
      accountFeed = {
        actions: (Array.isArray(feedData.actions) ? feedData.actions : []).map(sanitizeAccountFeedItem),
        newFollowers: (Array.isArray(feedData.newFollowers) ? feedData.newFollowers : []).map(sanitizeAccountFeedItem),
      };
    } else if (feedRow?.data != null) {
      cacheMeta!.cache.feed = {
        status: feedFresh ? "hit" : "stale",
        updatedAt: feedRow?.updated_at ?? null,
      };
    }

    const mentionsRow = mentionsRes?.data as { data?: unknown; updated_at?: string } | null;
    const mentionsData = mentionsRow?.data as unknown as XMentionsCachePayload | null;
    const mentionsUpdated = mentionsRow?.updated_at ? new Date(mentionsRow.updated_at).getTime() : 0;
    const mentionsFresh = mentionsUpdated && now - mentionsUpdated <= CACHE_STALE_MS;
    if (Array.isArray(mentionsData)) {
      cacheMeta!.cache.mentions = {
        status: mentionsFresh ? "hit" : "stale",
        updatedAt: mentionsRow?.updated_at ?? null,
      };
      mentionsLastWeek = mentionsData;
    } else if (mentionsRow?.data != null) {
      cacheMeta!.cache.mentions = {
        status: mentionsFresh ? "hit" : "stale",
        updatedAt: mentionsRow?.updated_at ?? null,
      };
    }
  } catch {
    // keep empty
  }

  return {
    profile,
    series: { followers: seriesFollowers, score: seriesScore },
    topFollowersByTier,
    mentionsLastWeek,
    affiliatedAccounts: [],
    accountFeed,
    recommendedAccounts,
    meta: cacheMeta,
  };
}
