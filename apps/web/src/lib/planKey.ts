/**
 * Re-export shared plan resolution for web, workers, and CRM.
 * Phase 1: no gating here yet — use effectivePlanKey() in later phases.
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
