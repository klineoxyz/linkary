/**
 * Shared plan resolution (same package as web/worker). Phase 1: re-export only.
 */
export {
  effectivePlanKey,
  legacyTierToPlanKey,
  normalizePlanKey,
  PLAN_KEYS,
  type LegacyTier,
  type PlanKey,
  type SubscriptionPlanInput,
} from "@linkary/plan-key";
