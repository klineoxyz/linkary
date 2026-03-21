import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchActivePlanOverrideMapForProfiles, fetchActivePlanOverrideForOrg } from "@/lib/opsEntitlementsMerge";
import { planKeyFromSubscriptionRow, type PlanKey } from "@/lib/planKey";

const CHUNK = 120;

/**
 * Personal (linkary.xyz) entitlements: active profile subscription only.
 * Does not merge org_members / org subscriptions (Phase 3A).
 */
export async function buildPersonalPlanKeyMapForProfileIds(
  service: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, PlanKey>> {
  const unique = [...new Set(profileIds.filter(Boolean))];
  const out = new Map<string, PlanKey>();
  for (const id of unique) out.set(id, "free");
  if (unique.length === 0) return out;

  for (let i = 0; i < unique.length; i += CHUNK) {
    const chunk = unique.slice(i, i + CHUNK);
    const { data: profSubs } = await service
      .from("subscriptions")
      .select("owner_id, plan_key, tier, status, current_period_end")
      .eq("owner_type", "profile")
      .in("owner_id", chunk);
    for (const row of profSubs ?? []) {
      const id = String((row as { owner_id: string }).owner_id);
      const pk = planKeyFromSubscriptionRow(row as Parameters<typeof planKeyFromSubscriptionRow>[0]);
      out.set(id, pk);
    }
  }

  const overrides = await fetchActivePlanOverrideMapForProfiles(service, unique);
  for (const id of unique) {
    const o = overrides.get(id);
    if (o) out.set(id, o);
  }

  return out;
}

/**
 * @deprecated Prefer buildPersonalPlanKeyMapForProfileIds — same behavior (profile-only).
 * Kept so cron/worker imports keep working; org uplift removed.
 */
export async function buildPlanKeyMapForProfileIds(
  service: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, PlanKey>> {
  return buildPersonalPlanKeyMapForProfileIds(service, profileIds);
}

/**
 * Personal surfaces: profile subscription row only (owner_type = profile, owner_id = profileId).
 */
export async function resolvePersonalPlanKeyForProfile(
  service: SupabaseClient,
  profileId: string
): Promise<PlanKey> {
  const map = await buildPersonalPlanKeyMapForProfileIds(service, [profileId]);
  return map.get(profileId) ?? "free";
}

/** Alias for personal-only resolution (analytics, discovery, ingest, backfill on linkary.xyz). */
export async function resolveEffectivePlanKeyForProfile(
  service: SupabaseClient,
  profileId: string
): Promise<PlanKey> {
  return resolvePersonalPlanKeyForProfile(service, profileId);
}

/**
 * Org / CRM context: subscription for public.orgs (owner_type = org).
 * Use linked_org_id from crm_workspaces — not profile merge.
 */
export async function resolveOrgPlanKeyForOrgId(
  service: SupabaseClient,
  orgId: string | null | undefined
): Promise<PlanKey> {
  if (!orgId || typeof orgId !== "string") return "free";
  const { data } = await service
    .from("subscriptions")
    .select("plan_key, tier, status, current_period_end")
    .eq("owner_type", "org")
    .eq("owner_id", orgId)
    .maybeSingle();
  const base = planKeyFromSubscriptionRow(data as Parameters<typeof planKeyFromSubscriptionRow>[0]);
  const ov = await fetchActivePlanOverrideForOrg(service, orgId);
  return ov ?? base;
}

export function bypassPlanKeyMap(profileIds: string[]): Map<string, PlanKey> {
  const m = new Map<string, PlanKey>();
  for (const id of profileIds) m.set(id, "custom");
  return m;
}
