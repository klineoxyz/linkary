import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizePlanKey, planKeyFromSubscriptionRow, type PlanKey } from "@/lib/planKey";

const OPS_ENTITLEMENTS = "platform_ops_entitlements";

async function fetchActivePlanOverrideForOrg(
  service: SupabaseClient,
  orgId: string
): Promise<PlanKey | null> {
  const nowIso = new Date().toISOString();
  const { data } = await service
    .from(OPS_ENTITLEMENTS)
    .select("payload_json, created_at")
    .eq("subject_type", "org")
    .eq("subject_id", orgId)
    .eq("kind", "plan_override")
    .is("revoked_at", null)
    .gt("expires_at", nowIso)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  const raw = (data as { payload_json?: { plan_key?: string | null } }).payload_json;
  return normalizePlanKey(raw?.plan_key ?? null);
}

/** CRM org context: subscription on public.orgs only (linked_org_id), not profile merge. Merges active org plan_override. */
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
