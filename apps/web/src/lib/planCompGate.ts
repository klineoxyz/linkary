import type { CompScope } from "@/lib/opsEntitlementsMerge";
import {
  planAllowsBackgroundXIngest,
  planAllowsDeepAnalyticsPayload,
  planAllowsPaidDiscovery,
  planAllowsSelfServe90dBackfill,
  type PlanKey,
} from "@/lib/planKey";

export function effectiveSelfServe90d(
  planKey: PlanKey,
  comp: Set<CompScope> | undefined
): boolean {
  return planAllowsSelfServe90dBackfill(planKey) || (comp?.has("self_serve_90d") ?? false);
}

export function effectiveBackgroundIngest(
  planKey: PlanKey,
  comp: Set<CompScope> | undefined
): boolean {
  return planAllowsBackgroundXIngest(planKey) || (comp?.has("background_ingest") ?? false);
}

export function effectiveDeepAnalytics(
  planKey: PlanKey,
  comp: Set<CompScope> | undefined
): boolean {
  return planAllowsDeepAnalyticsPayload(planKey) || (comp?.has("analytics_full") ?? false);
}

export function effectivePaidDiscovery(
  planKey: PlanKey,
  comp: Set<CompScope> | undefined
): boolean {
  return planAllowsPaidDiscovery(planKey) || (comp?.has("discovery") ?? false);
}
