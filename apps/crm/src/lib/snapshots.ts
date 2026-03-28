/**
 * CRM: Promoted-account snapshots for growth tracking.
 * Keyed by campaign_id + (platform, handle) from promoted_social_handles.
 * Stored data only; no fake metrics.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeTrackedXHandle } from "@/lib/trackedXHandle";

export type SnapshotType = "baseline" | "daily" | "end";

export type SnapshotMetrics = {
  followers?: number | null;
  views?: number | null;
  likes?: number | null;
  replies?: number | null;
  quotes?: number | null;
  reposts?: number | null;
  engagement_total?: number | null;
};

export type AccountSnapshotRow = {
  id: string;
  campaign_id: string;
  platform: string;
  handle: string;
  snapshot_type: SnapshotType;
  snapshot_at: string;
  metrics: SnapshotMetrics;
  created_at: string;
};

export type AccountGrowth = {
  platform: string;
  handle: string;
  baseline: SnapshotMetrics;
  end: SnapshotMetrics;
  follower_growth: number | null;
  views_growth: number | null;
  engagement_growth: number | null;
};

function snapshotHandleMatchKey(platform: string, handle: string): string {
  const p = platform.trim().toLowerCase();
  const h =
    p === "x" || p === "twitter" ? normalizeTrackedXHandle(handle) : handle.trim().toLowerCase();
  return `${p}:${h}`;
}

/**
 * Insert or replace a snapshot for (campaign_id, platform, handle, snapshot_type).
 * For baseline/end we use one row per type; for daily we use snapshot_at as date.
 */
export async function upsertAccountSnapshot(
  supabase: SupabaseClient,
  campaignId: string,
  platform: string,
  handle: string,
  snapshotType: SnapshotType,
  snapshotAt: string,
  metrics: SnapshotMetrics
): Promise<{ error?: string }> {
  const plat = platform.trim().toLowerCase();
  const hTrim = handle.trim();
  const norm = plat === "x" || plat === "twitter" ? normalizeTrackedXHandle(hTrim) : "";
  const handleStored = norm ? `@${norm}` : hTrim;
  const { error } = await supabase.from("crm_campaign_account_snapshots").insert({
    campaign_id: campaignId,
    platform: plat,
    handle: handleStored,
    snapshot_type: snapshotType,
    snapshot_at: snapshotAt,
    metrics: metrics ?? {},
  });
  if (error) return { error: error.message };
  return {};
}

/**
 * Get all snapshots for a campaign (optionally for a given platform/handle).
 */
export async function getAccountSnapshots(
  supabase: SupabaseClient,
  campaignId: string,
  options?: { platform?: string; handle?: string; snapshotType?: SnapshotType }
): Promise<AccountSnapshotRow[]> {
  let query = supabase
    .from("crm_campaign_account_snapshots")
    .select("id, campaign_id, platform, handle, snapshot_type, snapshot_at, metrics, created_at")
    .eq("campaign_id", campaignId)
    .order("snapshot_at", { ascending: true });

  if (options?.platform) query = query.eq("platform", options.platform);
  if (options?.handle) query = query.eq("handle", options.handle);
  if (options?.snapshotType) query = query.eq("snapshot_type", options.snapshotType);

  const { data } = await query;
  return (data ?? []) as AccountSnapshotRow[];
}

/**
 * Get growth per (platform, handle): baseline vs end snapshot.
 * Returns deltas for followers, views, engagement_total.
 */
export async function getAccountGrowth(
  supabase: SupabaseClient,
  campaignId: string
): Promise<AccountGrowth[]> {
  const baseline = await getAccountSnapshots(supabase, campaignId, { snapshotType: "baseline" });
  const end = await getAccountSnapshots(supabase, campaignId, { snapshotType: "end" });

  const byKey = (r: AccountSnapshotRow) => snapshotHandleMatchKey(r.platform, r.handle);
  const baselineByKey = new Map(baseline.map((r) => [byKey(r), r]));
  const endByKey = new Map(end.map((r) => [byKey(r), r]));

  const keys = new Set([...baselineByKey.keys(), ...endByKey.keys()]);
  const result: AccountGrowth[] = [];

  for (const key of keys) {
    const b = baselineByKey.get(key);
    const e = endByKey.get(key);
    const platform = b?.platform ?? e?.platform ?? "";
    const handle = b?.handle ?? e?.handle ?? "";
    const baseMetrics = b?.metrics ?? {};
    const endMetrics = e?.metrics ?? {};

    const fBase = baseMetrics.followers ?? null;
    const fEnd = endMetrics.followers ?? null;
    const vBase = baseMetrics.views ?? null;
    const vEnd = endMetrics.views ?? null;
    const engBase = baseMetrics.engagement_total ?? null;
    const engEnd = endMetrics.engagement_total ?? null;

    result.push({
      platform,
      handle,
      baseline: baseMetrics,
      end: endMetrics,
      follower_growth: fBase != null && fEnd != null ? fEnd - fBase : null,
      views_growth: vBase != null && vEnd != null ? vEnd - vBase : null,
      engagement_growth: engBase != null && engEnd != null ? engEnd - engBase : null,
    });
  }

  return result;
}

export type EndSnapshotStatus = {
  promotedCount: number;
  endSnapshotCount: number;
  hasAllEndSnapshots: boolean;
};

/** Most recent promoted-account snapshot row (any type) — used to prefill the record form. */
export type LatestSnapshotPrefill = {
  snapshot_type: SnapshotType | null;
  snapshot_at: string | null;
  followers: number | null;
  views: number | null;
  likes: number | null;
  replies: number | null;
  quotes: number | null;
  reposts: number | null;
  engagement_total: number | null;
};

export async function getLatestCampaignAccountSnapshot(
  supabase: SupabaseClient,
  campaignId: string
): Promise<LatestSnapshotPrefill | null> {
  const { data } = await supabase
    .from("crm_campaign_account_snapshots")
    .select("snapshot_type, snapshot_at, metrics, created_at")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!data) return null;
  const m = (data.metrics ?? {}) as SnapshotMetrics;
  return {
    snapshot_type: (data.snapshot_type as SnapshotType) ?? null,
    snapshot_at: data.snapshot_at ?? null,
    followers: m.followers ?? null,
    views: m.views ?? null,
    likes: m.likes ?? null,
    replies: m.replies ?? null,
    quotes: m.quotes ?? null,
    reposts: m.reposts ?? null,
    engagement_total: m.engagement_total ?? null,
  };
}

/**
 * For a campaign and its promoted handles, how many have an end snapshot.
 * Used to warn before finalize and to show report completeness.
 */
export async function getEndSnapshotStatus(
  supabase: SupabaseClient,
  campaignId: string,
  promotedHandles: { platform: string; handle: string }[]
): Promise<EndSnapshotStatus> {
  const promotedCount = promotedHandles.length;
  if (promotedCount === 0) {
    return { promotedCount: 0, endSnapshotCount: 0, hasAllEndSnapshots: true };
  }

  const endSnapshots = await getAccountSnapshots(supabase, campaignId, {
    snapshotType: "end",
  });
  const endKeys = new Set(endSnapshots.map((r) => snapshotHandleMatchKey(r.platform, r.handle)));
  const keys = new Set(promotedHandles.map((h) => snapshotHandleMatchKey(h.platform, h.handle)));
  let endSnapshotCount = 0;
  for (const key of keys) {
    if (endKeys.has(key)) endSnapshotCount++;
  }

  return {
    promotedCount,
    endSnapshotCount,
    hasAllEndSnapshots: endSnapshotCount === promotedCount,
  };
}
