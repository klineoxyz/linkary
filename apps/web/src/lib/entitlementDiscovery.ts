/**
 * Entitlement check for paid Linkary discovery/search.
 *
 * Discovery is a separate visibility layer (searchable_discovery), not the same as public_profile.
 * Only eligible users may access discovery APIs. This module is the single place for
 * "can this user use discovery?" so we can plug in billing, feature flags, or allowlists
 * without scattering checks.
 *
 * Layered check order (first match wins):
 * 1. Admin override (superadmin_emails or SUPERADMIN_EMAILS env)
 * 2. Internal allowlist (LINKARY_DISCOVERY_ALLOWED_USER_IDS env, comma-separated)
 * 3. Feature flag (LINKARY_DISCOVERY_ELIGIBLE=true env)
 * 4. Billing: active profile plan_key only when LINKARY_PLAN_GATING is not false
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { buildProfileCompScopesMap } from "@/lib/opsEntitlementsMerge";
import { effectivePaidDiscovery } from "@/lib/planCompGate";
import { planAllowsPaidDiscovery } from "@/lib/planKey";
import { resolveEffectivePlanKeyForProfile } from "@/lib/subscriptionPlan";

export type DiscoveryEligibilityOutcome =
  | { eligible: true; reason: "admin" }
  | { eligible: true; reason: "allowlist" }
  | { eligible: true; reason: "feature_flag" }
  | { eligible: true; reason: "billing" }
  | { eligible: true; reason: "ops_comp" }
  | { eligible: false; reason: "not_eligible" };

/** Fallback from env if superadmin_emails table is empty (comma-separated). */
function getSuperadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/** Parse LINKARY_DISCOVERY_ALLOWED_USER_IDS (comma-separated user ids). */
function getAllowedUserIdsFromEnv(): Set<string> {
  const raw = process.env.LINKARY_DISCOVERY_ALLOWED_USER_IDS ?? "";
  const ids = raw
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  return new Set(ids);
}

/**
 * Check if the user is eligible for discovery. Returns outcome and reason.
 * Pass service Supabase client for admin/DB checks; pass user id and email from auth.
 *
 * Billing uses profile subscription only (resolveEffectivePlanKeyForProfile); no org uplift (Phase 3A).
 */
export async function checkDiscoveryEligibility(
  userId: string,
  userEmail: string | null | undefined,
  serviceSupabase: SupabaseClient | null
): Promise<DiscoveryEligibilityOutcome> {
  const email = (userEmail ?? "").toString().trim().toLowerCase();
  const idLower = userId.trim().toLowerCase();

  // 1) Admin override
  if (serviceSupabase && email) {
    try {
      const { data: superadminRows } = await serviceSupabase
        .from("superadmin_emails")
        .select("email")
        .limit(500);
      const fromDb = (superadminRows ?? []).map((r: { email?: string }) => (r.email ?? "").toLowerCase().trim()).filter(Boolean);
      const fromEnv = getSuperadminEmailsFromEnv();
      const superadminSet = new Set([...fromDb, ...fromEnv]);
      if (superadminSet.size > 0 && superadminSet.has(email)) {
        return { eligible: true, reason: "admin" };
      }
    } catch {
      /* non-fatal; continue to next layer */
    }
  }

  // 2) Internal allowlist (beta users)
  const allowedIds = getAllowedUserIdsFromEnv();
  if (allowedIds.size > 0 && allowedIds.has(idLower)) {
    return { eligible: true, reason: "allowlist" };
  }

  // 3) Feature flag (global open for beta)
  if (process.env.LINKARY_DISCOVERY_ELIGIBLE === "true") {
    return { eligible: true, reason: "feature_flag" };
  }

  // 4) Billing: paid discovery (nano+); free blocked when global discovery flag is off
  if (isPlanGatingEnabled() && serviceSupabase) {
    try {
      const plan = await resolveEffectivePlanKeyForProfile(serviceSupabase, userId);
      const compMap = await buildProfileCompScopesMap(serviceSupabase, [userId]);
      const comp = compMap.get(userId);
      if (effectivePaidDiscovery(plan, comp)) {
        return {
          eligible: true,
          reason: planAllowsPaidDiscovery(plan) ? "billing" : "ops_comp",
        };
      }
    } catch {
      /* non-fatal */
    }
  }

  return { eligible: false, reason: "not_eligible" };
}

/**
 * Whether the user is eligible to use paid discovery/search.
 * Convenience wrapper; use checkDiscoveryEligibility when you need the reason.
 */
export async function isEligibleForDiscovery(
  userId: string,
  userEmail?: string | null,
  serviceSupabase?: SupabaseClient | null
): Promise<boolean> {
  const outcome = await checkDiscoveryEligibility(userId, userEmail ?? null, serviceSupabase ?? null);
  return outcome.eligible;
}
