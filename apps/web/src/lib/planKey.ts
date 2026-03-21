/**
 * Re-export shared plan resolution for web, workers, and CRM.
 * Phase 1: no gating here yet — use effectivePlanKey() in later phases.
 */
export {
  effectivePlanKey,
  isSubscriptionRowActive,
  legacyTierToPlanKey,
  maxPlanKey,
  mergePlanKeys,
  normalizePlanKey,
  planAllowsBackgroundXIngest,
  planAllowsDeepAnalyticsPayload,
  planAllowsPaidDiscovery,
  planAllowsSelfServe90dBackfill,
  planKeyFromSubscriptionRow,
  PLAN_KEYS,
  PLAN_RANK,
  type LegacyTier,
  type PlanKey,
  type SubscriptionPlanInput,
  type SubscriptionStatusRow,
} from "@linkary/plan-key";
