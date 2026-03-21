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
