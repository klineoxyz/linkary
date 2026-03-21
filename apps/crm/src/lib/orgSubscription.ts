import type { SupabaseClient } from "@supabase/supabase-js";
import { planKeyFromSubscriptionRow, type PlanKey } from "@/lib/planKey";

/** CRM org context: subscription on public.orgs only (linked_org_id), not profile merge. */
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
  return planKeyFromSubscriptionRow(data as Parameters<typeof planKeyFromSubscriptionRow>[0]);
}
