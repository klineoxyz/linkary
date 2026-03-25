/**
 * CRM: populate crm_campaign_metrics_daily from:
 * MODE A — x_tweets for promoted handles that resolve to Linkary profiles (stored only)
 * MODE B — twitterapi.io last_tweets for external promoted X handles (no profile row)
 *
 * Stored metrics only; omit impressions when the provider returns no viewCount.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchXUserTweets, parseTweetCreatedAt } from "./twitterapiLastTweets";
import { isXPlatform, normalizeTrackedXHandle } from "./trackedXHandle";

const TWEET_PAGE = 1000;
const MAX_TWEET_ROWS = 25000;
const MAX_DAYS = 450;
const MAX_EXTERNAL_TWEETS = 500;
const EXTERNAL_API_DELAY_MS = 400;
const STATUSES = ["draft", "active", "paused", "completed"] as const;

export type CrmCampaignMetricsIngestOptions = {
  /** twitterapi.io key; required for MODE B (external handles without Linkary profiles). */
  twitterApiKey?: string | null;
};

export type CrmCampaignMetricsIngestResult = {
  campaignsProcessed: number;
  campaignsWithRows: number;
  errors: string[];
};

type DayBucket = { views: number; engagements: number; posts: number };

function utcDayFromIso(ts: string): string {
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 10);
}

function parseDateBoundary(iso: string | null | undefined, endOfDay: boolean): Date | null {
  if (!iso?.trim()) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) {
    return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
  }
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function addTweetToBuckets(
  buckets: Map<string, DayBucket>,
  tweetedAtIso: string,
  impression: number | null | undefined,
  likes: number,
  replies: number,
  reposts: number,
  quotes: number
): void {
  const day = utcDayFromIso(tweetedAtIso);
  if (!day) return;
  let b = buckets.get(day);
  if (!b) {
    b = { views: 0, engagements: 0, posts: 0 };
    buckets.set(day, b);
  }
  b.posts += 1;
  if (impression != null && Number.isFinite(Number(impression))) {
    b.views += Number(impression);
  }
  b.engagements += likes + replies + reposts + quotes;
}

async function resolveNormalizedToProfileId(
  supabase: SupabaseClient,
  normalized: string
): Promise<string | null> {
  if (!normalized) return null;

  const { data: byNorm } = await supabase
    .from("profiles")
    .select("id")
    .eq("twitter_username_norm", normalized)
    .maybeSingle();
  if (byNorm?.id) return byNorm.id;

  for (const v of [normalized, `@${normalized}`]) {
    const { data } = await supabase
      .from("profiles")
      .select("id, twitter_username")
      .eq("twitter_username", v)
      .maybeSingle();
    if (data?.id && normalizeTrackedXHandle(data.twitter_username || "") === normalized) return data.id;
  }

  const { data: social } = await supabase
    .from("social_accounts")
    .select("user_id, username")
    .in("provider", ["x", "twitter"])
    .eq("status", "connected")
    .is("revoked_at", null)
    .limit(8000);

  for (const s of social ?? []) {
    if (normalizeTrackedXHandle(s.username || "") === normalized) return s.user_id;
  }

  return null;
}

function resolveIngestionSource(flags: {
  profileMode: boolean;
  externalMode: boolean;
}): string {
  if (flags.profileMode && flags.externalMode) return "mixed_profile_x_tweets_and_twitterapi_external";
  if (flags.externalMode) return "twitterapi_external_handle";
  return "x_tweets_tracked_profiles";
}

/**
 * Upsert daily rows per campaign from tracked-account tweet aggregates.
 * Safe to run on a schedule; idempotent per (campaign_id, day).
 */
export async function runCrmCampaignMetricsDailyIngest(
  supabase: SupabaseClient,
  options?: CrmCampaignMetricsIngestOptions
): Promise<CrmCampaignMetricsIngestResult> {
  const twitterApiKey = (options?.twitterApiKey ?? "").trim() || null;
  const errors: string[] = [];
  let campaignsProcessed = 0;
  let campaignsWithRows = 0;

  const { data: campaigns, error: listErr } = await supabase
    .from("crm_campaigns")
    .select("id, status, starts_at, ends_at, created_at, promoted_social_handles")
    .in("status", [...STATUSES]);

  if (listErr) {
    errors.push(`list campaigns: ${listErr.message}`);
    return { campaignsProcessed, campaignsWithRows, errors };
  }

  for (const c of campaigns ?? []) {
    campaignsProcessed += 1;
    const rawHandles = c.promoted_social_handles;
    if (!Array.isArray(rawHandles) || rawHandles.length === 0) continue;

    const xEntries: { raw: string; normalized: string }[] = [];
    for (const h of rawHandles as { platform?: string; handle?: string }[]) {
      const platform = (h.platform ?? "").trim();
      const handleRaw = (h.handle ?? "").trim();
      if (!isXPlatform(platform)) continue;
      const normalized = normalizeTrackedXHandle(handleRaw);
      if (!normalized) continue;
      xEntries.push({ raw: `${platform}:${handleRaw}`, normalized });
    }
    if (xEntries.length === 0) continue;

    const profileIds = new Set<string>();
    /** Normalized handles that map to a Linkary profile / connected account (MODE A). */
    const linkedNormalized: string[] = [];
    /** Normalized handles with no profile — candidate for MODE B. */
    const externalNormalized: string[] = [];
    const unresolvedRaw: string[] = [];

    for (const e of xEntries) {
      const pid = await resolveNormalizedToProfileId(supabase, e.normalized);
      if (pid) {
        profileIds.add(pid);
        if (!linkedNormalized.includes(e.normalized)) linkedNormalized.push(e.normalized);
      } else {
        externalNormalized.push(e.normalized);
        unresolvedRaw.push(e.raw);
      }
    }

    const externalUnique = [...new Set(externalNormalized)];

    if (profileIds.size === 0 && externalUnique.length > 0 && !twitterApiKey) {
      console.warn(
        "[crm_campaign_metrics_daily] skip campaign=%s: promoted X handles have no Linkary profile match; set TWITTERAPI_API_KEY for external handle ingest. handles=%s",
        c.id,
        JSON.stringify(unresolvedRaw)
      );
      continue;
    }

    if (profileIds.size === 0 && externalUnique.length === 0) {
      continue;
    }

    const start =
      parseDateBoundary(c.starts_at as string | null, false) ??
      parseDateBoundary(c.created_at as string | null, false);
    const endBound = parseDateBoundary(c.ends_at as string | null, true) ?? new Date();
    if (!start || start > endBound) {
      console.warn("[crm_campaign_metrics_daily] skip campaign=%s: invalid date window", c.id);
      continue;
    }

    const startMs = start.getTime();
    const endMs = endBound.getTime();
    const startIso = start.toISOString();
    const endIso = endBound.toISOString();

    const buckets = new Map<string, DayBucket>();
    let postsFromProfileDb = 0;

    if (profileIds.size > 0 && externalUnique.length > 0 && !twitterApiKey) {
      console.warn(
        "[crm_campaign_metrics_daily] campaign=%s: external promoted handles %j omitted (no TWITTERAPI_API_KEY); profile-linked path still runs.",
        c.id,
        externalUnique
      );
    }

    if (profileIds.size > 0) {
      let offset = 0;
      let totalFetched = 0;
      while (totalFetched < MAX_TWEET_ROWS) {
        const { data: tweets, error: tErr } = await supabase
          .from("x_tweets")
          .select("tweeted_at, impression_count, like_count, reply_count, repost_count, quote_count")
          .in("profile_id", [...profileIds])
          .gte("tweeted_at", startIso)
          .lte("tweeted_at", endIso)
          .order("tweeted_at", { ascending: true })
          .range(offset, offset + TWEET_PAGE - 1);

        if (tErr) {
          errors.push(`campaign ${c.id} tweets: ${tErr.message}`);
          break;
        }
        const rows = tweets ?? [];
        if (rows.length === 0) break;

        for (const tw of rows) {
          const ta = (tw as { tweeted_at: string }).tweeted_at;
          addTweetToBuckets(
            buckets,
            ta,
            (tw as { impression_count?: number | null }).impression_count,
            Number((tw as { like_count?: number }).like_count) || 0,
            Number((tw as { reply_count?: number }).reply_count) || 0,
            Number((tw as { repost_count?: number }).repost_count) || 0,
            Number((tw as { quote_count?: number }).quote_count) || 0
          );
          postsFromProfileDb += 1;
        }

        totalFetched += rows.length;
        if (rows.length < TWEET_PAGE) break;
        offset += TWEET_PAGE;
      }
    }

    let postsFromExternalApi = 0;
    const externalApiFetched: string[] = [];
    const externalNoTweetsInWindow: string[] = [];

    if (twitterApiKey && externalUnique.length > 0) {
      for (const norm of externalUnique) {
        try {
          const tweets = await fetchXUserTweets(norm, twitterApiKey, MAX_EXTERNAL_TWEETS);
          externalApiFetched.push(norm);
          let inWindow = 0;
          for (const t of tweets) {
            const iso = parseTweetCreatedAt(t.createdAt);
            if (!iso) continue;
            const ts = new Date(iso).getTime();
            if (ts < startMs || ts > endMs) continue;
            inWindow += 1;
            const imp = typeof t.viewCount === "number" ? t.viewCount : null;
            addTweetToBuckets(
              buckets,
              iso,
              imp,
              Math.max(0, Number(t.likeCount) || 0),
              Math.max(0, Number(t.replyCount) || 0),
              Math.max(0, Number(t.retweetCount) || 0),
              Math.max(0, Number(t.quoteCount) || 0)
            );
            postsFromExternalApi += 1;
          }
          if (inWindow === 0) externalNoTweetsInWindow.push(norm);
        } catch (e) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`campaign ${c.id} external @${norm}: ${msg.slice(0, 200)}`);
        }
        await sleep(EXTERNAL_API_DELAY_MS);
      }
    }

    const profileMode = postsFromProfileDb > 0;
    const externalMode = postsFromExternalApi > 0;
    const source = resolveIngestionSource({ profileMode, externalMode });

    const metaBase = {
      source,
      version: 2,
      profile_ids: [...profileIds],
      handles_linked_to_profiles: linkedNormalized,
      handles_external_tracked: externalUnique,
      handles_external_api_fetched: externalApiFetched,
      handles_external_no_tweets_in_window: externalNoTweetsInWindow,
      posts_from_profile_x_tweets: postsFromProfileDb,
      posts_from_twitterapi_external: postsFromExternalApi,
      /** Omitted when external twitterapi path ran so CRM does not show a false “unmatched profile” warning. */
      handles_unmatched_promoted_raw:
        twitterApiKey && externalUnique.length > 0 ? [] : unresolvedRaw,
      handles_external_omitted_no_api_key:
        !twitterApiKey && externalUnique.length > 0 ? externalUnique : [],
      note:
        "MODE A: sums x_tweets for Linkary profiles. MODE B: twitterapi.io last_tweets filtered to campaign window (max " +
        MAX_EXTERNAL_TWEETS +
        " recent tweets per external handle; older posts may be missing). Impressions use viewCount when present.",
      twitterapi_limitations:
        "External path only sees recent tweets up to API page depth; long windows may be incomplete if the account posted more than the cap before the window.",
    };

    if (buckets.size === 0) {
      console.log(
        "[crm_campaign_metrics_daily] campaign=%s no tweet rows in window (profiles=%d external_handles=%d)",
        c.id,
        profileIds.size,
        externalUnique.length
      );
      continue;
    }

    let partialImpressionsNote: string | null = null;
    const totals = [...buckets.values()].reduce(
      (a, b) => ({ posts: a.posts + b.posts, views: a.views + b.views }),
      { posts: 0, views: 0 }
    );
    if (totals.posts > 0 && totals.views === 0) {
      partialImpressionsNote =
        "No impression/view counts in window (x_tweets.impression_count or API viewCount missing). Engagements still summed from public counts.";
    }

    const upsertRows = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, bkt]) => ({
        campaign_id: c.id,
        day,
        total_views: bkt.views,
        total_engagements: bkt.engagements,
        total_posts: bkt.posts,
        // Not used for participant counts (always 0). Enrolled creators live in crm_campaign_participants — do not surface this as "contributors" in UI.
        total_contributors: 0,
        spend_used: null,
        metadata: {
          ...metaBase,
          day_post_count: bkt.posts,
          partial_impressions: partialImpressionsNote,
        },
      }));

    const { error: upErr } = await supabase.from("crm_campaign_metrics_daily").upsert(upsertRows, {
      onConflict: "campaign_id,day",
    });
    if (upErr) {
      errors.push(`campaign ${c.id} upsert: ${upErr.message}`);
    } else {
      campaignsWithRows += 1;
      console.log(
        "[metrics] campaign=%s days=%d source=%s profile_posts=%d external_posts=%d",
        c.id,
        upsertRows.length,
        source,
        postsFromProfileDb,
        postsFromExternalApi
      );
    }
  }

  return { campaignsProcessed, campaignsWithRows, errors };
}
