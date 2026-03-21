export function isPlanGatingEnabled(): boolean {
  return process.env.LINKARY_PLAN_GATING !== "false";
}
