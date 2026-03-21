/**
 * Rollback: set LINKARY_PLAN_GATING=false to restore pre–Phase 2 behavior
 * (no plan-based filtering on cron/worker ingest, discovery billing, or analytics depth).
 */
export function isPlanGatingEnabled(): boolean {
  return process.env.LINKARY_PLAN_GATING !== "false";
}
