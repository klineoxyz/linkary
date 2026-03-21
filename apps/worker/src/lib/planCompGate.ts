import type { CompScope } from "./opsEntitlementsMerge.js";
import {
  planAllowsBackgroundXIngest,
  planAllowsSelfServe90dBackfill,
  type PlanKey,
} from "./planKey.js";

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
