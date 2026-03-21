/** plan_usage_counters.metric_key for org external X profile search. */
export const EXTERNAL_X_PROFILE_SEARCH_METRIC = "external_x_profile_search";

export function normalizeExternalXHandle(raw: string): string | null {
  const s = raw.trim().replace(/^@+/, "").toLowerCase();
  if (!s || s.length > 64) return null;
  if (!/^[a-z0-9_]{1,64}$/.test(s)) return null;
  return s;
}

/** First day of current UTC month (YYYY-MM-DD). */
export function utcMonthStartDate(d = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  return `${y}-${m}-01`;
}

export function resolveCustomExternalXSearchCapFromEnv(): number {
  const raw = process.env.LINKARY_EXTERNAL_X_SEARCH_CAP_CUSTOM;
  const n = parseInt(String(raw ?? "").trim(), 10);
  if (!Number.isFinite(n) || n < 1) return 50;
  return Math.min(n, 1_000_000);
}

export function externalXCacheTtlMsFromEnv(): number {
  const raw = process.env.LINKARY_EXTERNAL_X_CACHE_TTL_HOURS;
  const h = parseFloat(String(raw ?? "").trim());
  const hours = Number.isFinite(h) && h > 0 ? Math.min(h, 168) : 24;
  return Math.round(hours * 60 * 60 * 1000);
}
