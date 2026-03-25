/**
 * Canonical plan keys for Linkary monetization. Legacy DB column subscriptions.tier
 * remains during migration; use effectivePlanKey() for enforcement and UI prep.
 */
export const PLAN_KEYS = ["free", "nano", "kol", "startup", "unicorn", "custom"] as const;

export type PlanKey = (typeof PLAN_KEYS)[number];

/** Legacy subscriptions.tier CHECK values (public.subscriptions). */
export type LegacyTier = "free" | "pro" | "host" | "brand" | "venture";

const PLAN_KEY_SET = new Set<string>(PLAN_KEYS);

export type SubscriptionPlanInput = {
  plan_key?: string | null;
  tier?: string | null;
};

/**
 * Normalize a stored plan_key string. Returns null if empty or unknown.
 */
export function normalizePlanKey(raw: string | null | undefined): PlanKey | null {
  if (raw == null || typeof raw !== "string") return null;
  const k = raw.trim().toLowerCase();
  if (!k) return null;
  return PLAN_KEY_SET.has(k) ? (k as PlanKey) : null;
}

/**
 * Map legacy subscriptions.tier → plan_key when plan_key is absent.
 * Aligns with migration 20260426120000_plan_key_ops_members_audit_log.sql backfill.
 */
export function legacyTierToPlanKey(tier: string | null | undefined): PlanKey {
  const t = (tier ?? "free").toString().trim().toLowerCase();
  switch (t) {
    case "free":
      return "free";
    case "pro":
    case "host":
      return "kol";
    case "brand":
      return "startup";
    case "venture":
      return "unicorn";
    default:
      return "free";
  }
}

/**
 * Single source of truth: prefer plan_key when set and valid; else derive from tier.
 */
export function effectivePlanKey(row: SubscriptionPlanInput): PlanKey {
  const pk = normalizePlanKey(row.plan_key);
  if (pk) return pk;
  return legacyTierToPlanKey(row.tier);
}

/** Strongest plan wins when merging profile + org subscriptions. */
export const PLAN_RANK: Record<PlanKey, number> = {
  free: 0,
  nano: 1,
  kol: 2,
  startup: 3,
  unicorn: 4,
  custom: 5,
};

export function maxPlanKey(a: PlanKey, b: PlanKey): PlanKey {
  return PLAN_RANK[a] >= PLAN_RANK[b] ? a : b;
}

export function mergePlanKeys(keys: PlanKey[]): PlanKey {
  return keys.reduce((acc, k) => maxPlanKey(acc, k), "free" as PlanKey);
}

export type SubscriptionStatusRow = {
  status?: string | null;
  current_period_end?: string | null;
};

export function isSubscriptionRowActive(row: SubscriptionStatusRow | null | undefined): boolean {
  if (!row || row.status !== "active") return false;
  const end = row.current_period_end;
  if (end && new Date(end) < new Date()) return false;
  return true;
}

export function planKeyFromSubscriptionRow(
  row: (SubscriptionPlanInput & SubscriptionStatusRow) | null | undefined
): PlanKey {
  if (!row || !isSubscriptionRowActive(row)) return "free";
  return effectivePlanKey(row);
}

/** Paid API / background X ingest (cron + worker). Free = no automatic paid ingestion. */
export function planAllowsBackgroundXIngest(key: PlanKey): boolean {
  return key !== "free";
}

/** Self-serve or automated 90d history backfill (ensure-backfill, OAuth hooks, enqueue helpers). */
export function planAllowsSelfServe90dBackfill(key: PlanKey): boolean {
  return key === "kol" || key === "startup" || key === "unicorn" || key === "custom";
}

/** Paid discovery when feature flag is off; free blocked unless admin/allowlist/flag. */
export function planAllowsPaidDiscovery(key: PlanKey): boolean {
  return key !== "free";
}

/** Full analytics API payload (chart series, prior-window KPIs). */
export function planAllowsDeepAnalyticsPayload(key: PlanKey): boolean {
  return key !== "free";
}

/** Cross-user creator analytics viewer (/api/me/analytics/profile/[username]). */
export function planAllowsCrossUserAnalytics(key: PlanKey): boolean {
  return key === "kol" || key === "startup" || key === "unicorn" || key === "custom";
}

/**
 * CRM: external X profile lookup by handle (non-connected profiles), org subscription only.
 * StartUP / UniCorn / Custom — not free / nano / kol.
 */
export function planAllowsExternalXProfileSearch(key: PlanKey): boolean {
  return key === "startup" || key === "unicorn" || key === "custom";
}

/**
 * Hard monthly cap per org for external X profile searches.
 * `customDefault` is used when plan is custom (e.g. from env in the app).
 */
export function externalXProfileSearchMonthlyCap(key: PlanKey, customDefault: number): number | null {
  if (key === "startup") return 50;
  if (key === "unicorn") return 200;
  if (key === "custom") {
    const n = Math.floor(Number(customDefault));
    if (!Number.isFinite(n) || n < 1) return 50;
    return Math.min(n, 1_000_000);
  }
  return null;
}
