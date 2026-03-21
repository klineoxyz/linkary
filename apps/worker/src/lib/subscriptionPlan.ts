import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchActivePlanOverrideMapForProfiles } from "./opsEntitlementsMerge.js";
import { planKeyFromSubscriptionRow, type PlanKey } from "./planKey.js";

const CHUNK = 120;

/** Personal ingest only: profile subscription rows — no org uplift (Phase 3A). */
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

export async function buildPlanKeyMapForProfileIds(
  service: SupabaseClient,
  profileIds: string[]
): Promise<Map<string, PlanKey>> {
  return buildPersonalPlanKeyMapForProfileIds(service, profileIds);
}

export async function resolvePersonalPlanKeyForProfile(
  service: SupabaseClient,
  profileId: string
): Promise<PlanKey> {
  const map = await buildPersonalPlanKeyMapForProfileIds(service, [profileId]);
  return map.get(profileId) ?? "free";
}

export async function resolveEffectivePlanKeyForProfile(
  service: SupabaseClient,
  profileId: string
): Promise<PlanKey> {
  return resolvePersonalPlanKeyForProfile(service, profileId);
}

export function bypassPlanKeyMap(profileIds: string[]): Map<string, PlanKey> {
  const m = new Map<string, PlanKey>();
  for (const id of profileIds) m.set(id, "custom");
  return m;
}
