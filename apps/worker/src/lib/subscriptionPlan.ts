import type { SupabaseClient } from "@supabase/supabase-js";
import { maxPlanKey, planKeyFromSubscriptionRow, type PlanKey } from "./planKey.js";

const CHUNK = 120;

export async function buildPlanKeyMapForProfileIds(
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
      out.set(id, maxPlanKey(out.get(id) ?? "free", pk));
    }
  }

  const { data: members } = await service.from("org_members").select("user_id, org_id").in("user_id", unique);

  const orgByUser = new Map<string, string[]>();
  const allOrgIds = new Set<string>();
  for (const m of members ?? []) {
    const uid = String((m as { user_id: string }).user_id);
    const oid = String((m as { org_id: string }).org_id);
    const arr = orgByUser.get(uid) ?? [];
    arr.push(oid);
    orgByUser.set(uid, arr);
    allOrgIds.add(oid);
  }

  const orgIdList = [...allOrgIds];
  const orgPlan = new Map<string, PlanKey>();
  for (let i = 0; i < orgIdList.length; i += CHUNK) {
    const chunk = orgIdList.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const { data: orgSubs } = await service
      .from("subscriptions")
      .select("owner_id, plan_key, tier, status, current_period_end")
      .eq("owner_type", "org")
      .in("owner_id", chunk);
    for (const row of orgSubs ?? []) {
      const oid = String((row as { owner_id: string }).owner_id);
      const pk = planKeyFromSubscriptionRow(row as Parameters<typeof planKeyFromSubscriptionRow>[0]);
      orgPlan.set(oid, maxPlanKey(orgPlan.get(oid) ?? "free", pk));
    }
  }

  for (const id of unique) {
    const orgs = orgByUser.get(id) ?? [];
    let best = out.get(id) ?? "free";
    for (const oid of orgs) {
      const op = orgPlan.get(oid);
      if (op) best = maxPlanKey(best, op);
    }
    out.set(id, best);
  }

  return out;
}

export async function resolveEffectivePlanKeyForProfile(
  service: SupabaseClient,
  profileId: string
): Promise<PlanKey> {
  const map = await buildPlanKeyMapForProfileIds(service, [profileId]);
  return map.get(profileId) ?? "free";
}

export function bypassPlanKeyMap(profileIds: string[]): Map<string, PlanKey> {
  const m = new Map<string, PlanKey>();
  for (const id of profileIds) m.set(id, "custom");
  return m;
}
