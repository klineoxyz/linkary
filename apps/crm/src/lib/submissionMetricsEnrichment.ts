/**
 * Enrich crm_submissions.metrics_snapshot from X post URLs via twitterapi.io.
 * Server-only; never expose API keys to the client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { getTwitterApiKeyFromEnv } from "@/lib/xUserPreview";

const TWITTERAPI_BASE = "https://api.twitterapi.io";

type SubmissionMetricsRow = {
  id: string;
  url: string;
  platform: string;
  metrics_snapshot: unknown;
};

export function parseXStatusUrl(url: string): string | null {
  const raw = (url ?? "").trim();
  if (!raw) return null;
  try {
    const u = new URL(raw.startsWith("http") ? raw : `https://${raw}`);
    const host = u.hostname.replace(/^www\./, "").toLowerCase();
    if (!["x.com", "twitter.com", "mobile.twitter.com", "mobile.x.com"].includes(host)) return null;
    const parts = u.pathname.split("/").filter(Boolean);
    const idx = parts.indexOf("status");
    if (idx >= 0 && parts[idx + 1]) {
      const id = parts[idx + 1].replace(/\D/g, "");
      return /^\d{5,}$/.test(id) ? id : null;
    }
    return null;
  } catch {
    return null;
  }
}

function extractTweetsFromResponse(resp: unknown): { tweets: Record<string, unknown>[] } {
  const r = resp as Record<string, unknown>;
  if (!r || typeof r !== "object") return { tweets: [] };
  if (Array.isArray(r.tweets)) return { tweets: r.tweets as Record<string, unknown>[] };
  const data = r.data as Record<string, unknown> | undefined;
  if (data && typeof data === "object" && Array.isArray(data.tweets)) {
    return { tweets: data.tweets as Record<string, unknown>[] };
  }
  return { tweets: [] };
}

function num(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function tweetRecordToMetricsSnapshot(tweet: Record<string, unknown>, source: string): Record<string, unknown> {
  const author = tweet.author as Record<string, unknown> | undefined;
  const handle =
    typeof author?.userName === "string"
      ? author.userName.replace(/^@/, "")
      : typeof author?.user_name === "string"
        ? (author.user_name as string).replace(/^@/, "")
        : null;

  const likes = num(tweet.likeCount ?? tweet.like_count);
  const replies = num(tweet.replyCount ?? tweet.reply_count);
  const reposts = num(tweet.retweetCount ?? tweet.retweet_count ?? tweet.repostCount);
  const quotes = num(tweet.quoteCount ?? tweet.quote_count);
  const views = num(tweet.viewCount ?? tweet.view_count);
  const total_engagements =
    [likes, replies, reposts, quotes].every((x) => x == null)
      ? null
      : (likes ?? 0) + (replies ?? 0) + (reposts ?? 0) + (quotes ?? 0);

  return {
    tweet_id: tweet.id != null ? String(tweet.id) : null,
    impressions: views,
    views,
    likes,
    replies,
    reposts,
    quotes,
    total_engagements,
    author_handle: handle,
    fetched_at: new Date().toISOString(),
    source,
  };
}

async function fetchTweetsByIds(tweetIds: string[], apiKey: string): Promise<Map<string, Record<string, unknown>>> {
  const out = new Map<string, Record<string, unknown>>();
  const unique = [...new Set(tweetIds.filter(Boolean))];
  const chunkSize = 10;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const qs = new URLSearchParams({ tweet_ids: chunk.join(",") });
    const res = await fetch(`${TWITTERAPI_BASE}/twitter/tweets?${qs.toString()}`, {
      headers: { "X-API-Key": apiKey },
      cache: "no-store",
    });
    if (!res.ok) continue;
    let json: unknown;
    try {
      json = await res.json();
    } catch {
      continue;
    }
    const { tweets } = extractTweetsFromResponse(json);
    for (const t of tweets) {
      const id = t.id != null ? String(t.id) : "";
      if (id) out.set(id, t);
    }
  }
  return out;
}

export type EnrichCampaignMetricsResult = {
  enriched: number;
  skipped: number;
  failed: number;
  error?: string;
};

function isXPlatform(platform: string | null | undefined): boolean {
  const p = (platform ?? "").trim().toLowerCase();
  return p === "x" || p === "twitter";
}

export async function enrichCampaignSubmissionMetrics(
  supabase: SupabaseClient,
  campaignId: string,
  options?: { apiKey?: string | null }
): Promise<EnrichCampaignMetricsResult> {
  const apiKey = options?.apiKey ?? getTwitterApiKeyFromEnv();
  if (!apiKey) {
    return { enriched: 0, skipped: 0, failed: 0, error: "TWITTERAPI_IO_KEY (or TWITTERAPI_API_KEY) not set" };
  }

  const { data: rows, error } = await supabase
    .from("crm_submissions")
    .select("id, url, platform, metrics_snapshot")
    .eq("campaign_id", campaignId);
  if (error) return { enriched: 0, skipped: 0, failed: 0, error: error.message };

  let enriched = 0;
  let skipped = 0;
  let failed = 0;

  const list = (rows ?? []) as SubmissionMetricsRow[];
  const rowById = new Map(list.map((r) => [r.id, r]));

  const idBySubmission = new Map<string, string>();
  const submissionIds: string[] = [];
  for (const r of list) {
    if (!isXPlatform(r.platform)) {
      skipped++;
      continue;
    }
    const tid = parseXStatusUrl(r.url);
    if (!tid) {
      skipped++;
      continue;
    }
    idBySubmission.set(r.id, tid);
    submissionIds.push(r.id);
  }
  if (submissionIds.length === 0) return { enriched: 0, skipped: skipped || list.length, failed: 0 };

  const tweetMap = await fetchTweetsByIds([...new Set([...idBySubmission.values()])], apiKey);
  for (const subId of submissionIds) {
    const tid = idBySubmission.get(subId);
    if (!tid) {
      skipped++;
      continue;
    }
    const tweet = tweetMap.get(tid);
    if (!tweet) {
      failed++;
      continue;
    }
    const row = rowById.get(subId);
    const prev =
      row?.metrics_snapshot && typeof row.metrics_snapshot === "object" && !Array.isArray(row.metrics_snapshot)
        ? (row.metrics_snapshot as Record<string, unknown>)
        : {};
    const next = { ...prev, ...tweetRecordToMetricsSnapshot(tweet, "twitterapi.io") };
    const { error: upErr } = await supabase.from("crm_submissions").update({ metrics_snapshot: next }).eq("id", subId);
    if (upErr) failed++;
    else enriched++;
  }
  return { enriched, skipped, failed };
}

export async function enrichSubmissionMetricsById(
  supabase: SupabaseClient,
  submissionId: string,
  options?: { apiKey?: string | null }
): Promise<{ ok: boolean; error?: string }> {
  const apiKey = options?.apiKey ?? getTwitterApiKeyFromEnv();
  if (!apiKey) return { ok: false, error: "Twitter API key not configured" };

  const { data: row, error } = await supabase
    .from("crm_submissions")
    .select("id, url, platform, metrics_snapshot")
    .eq("id", submissionId)
    .maybeSingle();
  if (error || !row) return { ok: false, error: error?.message ?? "Submission not found" };

  const r = row as SubmissionMetricsRow;
  if (!isXPlatform(r.platform)) return { ok: true };
  const tid = parseXStatusUrl(r.url);
  if (!tid) return { ok: true };

  const tweetMap = await fetchTweetsByIds([tid], apiKey);
  const tweet = tweetMap.get(tid);
  if (!tweet) return { ok: false, error: "Could not fetch tweet metrics from provider" };

  const prev =
    r.metrics_snapshot && typeof r.metrics_snapshot === "object" && !Array.isArray(r.metrics_snapshot)
      ? (r.metrics_snapshot as Record<string, unknown>)
      : {};
  const next = { ...prev, ...tweetRecordToMetricsSnapshot(tweet, "twitterapi.io") };
  const { error: upErr } = await supabase.from("crm_submissions").update({ metrics_snapshot: next }).eq("id", submissionId);
  if (upErr) return { ok: false, error: upErr.message };
  return { ok: true };
}
