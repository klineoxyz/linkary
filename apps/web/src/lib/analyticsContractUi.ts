/**
 * Helpers for GET /api/analytics/x contract v2 ({ ok, data }) in UI layers.
 */

export type AnalyticsEntitlement = "basic" | "full";

export type AnalyticsXContractData = {
  window_days: number;
  window_start: string;
  window_end: string;
  follower_data_coverage_days: number;
  chart_points: {
    engagement_rate: Array<{
      date: string;
      engagement_pct: number;
      posts: number;
      is_estimated?: boolean;
      is_capped?: boolean;
    }>;
    posting_cadence: Array<{ date: string; posts: number }>;
    follower_growth: Array<{ date: string; follower_delta: number }>;
  };
  kpis: Record<string, unknown>;
  analytics_entitlement?: AnalyticsEntitlement;
  freshness?: {
    has_x_handle: boolean;
    last_sync_at: string | null;
    data_state: "none" | "partial" | "full";
  };
};

export function parseAnalyticsXJson(json: unknown): { ok: true; data: AnalyticsXContractData } | { ok: false } {
  if (!json || typeof json !== "object") return { ok: false };
  const o = json as Record<string, unknown>;
  if (o.ok !== true || !o.data || typeof o.data !== "object") return { ok: false };
  return { ok: true, data: o.data as AnalyticsXContractData };
}

export function effectiveAnalyticsEntitlement(data: AnalyticsXContractData | null | undefined): AnalyticsEntitlement {
  if (!data) return "full";
  return data.analytics_entitlement === "basic" ? "basic" : "full";
}

/** Reconstruct follower levels from daily deltas + latest count (for profile insights mini-chart). */
export function buildFollowerSeriesFromV2(data: AnalyticsXContractData): Array<{ date: string; followers: number }> {
  const fg = data.chart_points?.follower_growth ?? [];
  const latest = typeof data.kpis?.followers_latest === "number" ? data.kpis.followers_latest : null;
  if (!fg.length || latest == null || !Number.isFinite(latest)) return [];

  let f = latest;
  const out: Array<{ date: string; followers: number }> = [];
  for (let i = fg.length - 1; i >= 0; i--) {
    const row = fg[i];
    if (!row?.date) continue;
    out.unshift({ date: row.date.slice(0, 10), followers: Math.round(f) });
    f -= Number(row.follower_delta) || 0;
  }
  return out;
}
