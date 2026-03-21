import type { OpsRole } from "@/lib/internalOps";

export type OpsEntitlementKind = "comp_grant" | "discount_metadata" | "plan_override";

/** Comp grants: support + super only. */
export function canCreateCompGrant(role: OpsRole): boolean {
  return role === "ops_support" || role === "ops_super";
}

/** Discount metadata + plan overrides + usage reset: finance + super. */
export function canCreateDiscountMetadata(role: OpsRole): boolean {
  return role === "ops_finance" || role === "ops_super";
}

export function canCreatePlanOverride(role: OpsRole): boolean {
  return role === "ops_finance" || role === "ops_super";
}

export function canResetUsageCounter(role: OpsRole): boolean {
  return role === "ops_finance" || role === "ops_super";
}

export function canRevokeEntitlement(kind: OpsEntitlementKind, role: OpsRole): boolean {
  if (role === "ops_readonly") return false;
  if (role === "ops_super") return true;
  if (kind === "comp_grant") return role === "ops_support";
  if (kind === "discount_metadata" || kind === "plan_override") return role === "ops_finance";
  return false;
}
