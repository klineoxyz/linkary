/**
 * CRM: populate crm_campaign_metrics_daily from x_tweets for promoted X handles that resolve to Linkary profiles.
 * Stored data only; omit impressions when API did not provide impression_count.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isXPlatform, normalizeTrackedXHandle } from "./trackedXHandle";

const TWEET_PAGE = 1000;
const MAX_TWEET_ROWS = 25000;
const MAX_DAYS = 450;
const STATUSES = ["draft", "active", "paused", "completed"] as const;

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
    const { data } = await supabase.from("profiles").select("id, twitter_username").eq("twitter_username", v).maybeSingle();
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

/**
 * Upsert daily rows per campaign from tracked-account tweet aggregates.
 * Safe to run on a schedule; idempotent per (campaign_id, day).
 */
export async function runCrmCampaignMetricsDailyIngest(
  supabase: SupabaseClient
): Promise<CrmCampaignMetricsIngestResult> {
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
    const unresolved: string[] = [];
    const resolvedHandles: string[] = [];

    for (const e of xEntries) {
      const pid = await resolveNormalizedToProfileId(supabase, e.normalized);
      if (pid) {
        profileIds.add(pid);
        if (!resolvedHandles.includes(e.normalized)) resolvedHandles.push(e.normalized);
      } else {
        unresolved.push(e.raw);
      }
    }

    if (profileIds.size === 0) {
      console.warn(
        "[crm_campaign_metrics_daily] skip campaign=%s: no Linkary profile matched promoted X handles unresolved=%s",
        c.id,
        JSON.stringify(unresolved)
      );
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

    const startIso = start.toISOString();
    const endIso = endBound.toISOString();

    const buckets = new Map<string, DayBucket>();
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
        const day = utcDayFromIso((tw as { tweeted_at: string }).tweeted_at);
        if (!day) continue;
        const imp = (tw as { impression_count?: number | null }).impression_count;
        const likes = Number((tw as { like_count?: number }).like_count) || 0;
        const replies = Number((tw as { reply_count?: number }).reply_count) || 0;
        const reposts = Number((tw as { repost_count?: number }).repost_count) || 0;
        const quotes = Number((tw as { quote_count?: number }).quote_count) || 0;
        const eng = likes + replies + reposts + quotes;

        let b = buckets.get(day);
        if (!b) {
          b = { views: 0, engagements: 0, posts: 0 };
          buckets.set(day, b);
        }
        b.posts += 1;
        if (imp != null && Number.isFinite(Number(imp))) {
          b.views += Number(imp);
        }
        b.engagements += eng;
      }

      totalFetched += rows.length;
      if (rows.length < TWEET_PAGE) break;
      offset += TWEET_PAGE;
    }

    const metaBase = {
      source: "x_tweets_tracked_profiles",
      version: 1,
      profile_ids: [...profileIds],
      handles_normalized: resolvedHandles,
      handles_unresolved: unresolved,
      note:
        "Sums x_tweets for profiles whose handles match promoted accounts. Impressions only when impression_count is present. Engagement sum uses likes + replies + reposts + quotes per tweet.",
    };

    if (buckets.size === 0) {
      console.log(
        "[crm_campaign_metrics_daily] campaign=%s profiles=%d no tweets in window (handles matched)",
        c.id,
        profileIds.size
      );
      continue;
    }

    const upsertRows = [...buckets.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([day, bkt]) => ({
        campaign_id: c.id,
        day,
        total_views: bkt.views,
        total_engagements: bkt.engagements,
        total_posts: bkt.posts,
        total_contributors: 0,
        spend_used: null,
        metadata: {
          ...metaBase,
          day_post_count: bkt.posts,
          partial_impressions:
            bkt.posts > 0 && bkt.views === 0
              ? "No impression_count on tweets in window; engagements still counted from public metrics."
              : null,
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
        "[crm_campaign_metrics_daily] campaign=%s days=%d profiles=%d unresolved=%d",
        c.id,
        upsertRows.length,
        profileIds.size,
        unresolved.length
      );
    }
  }

  return { campaignsProcessed, campaignsWithRows, errors };
}
