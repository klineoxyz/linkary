/** Stable SWR keys so Profile, Dashboard, Insights dedupe within dedupingInterval. */
export const SWR_KEY_ME_STATS = "/api/profile/me-stats";
export const SWR_KEY_OWNER_ANALYTICS_INIT = "owner-analytics-init-status";

export function swrKeyAnalyticsX(windowParam: string, debug: boolean): string {
  return `/api/analytics/x?window=${windowParam}${debug ? "&debug=1" : ""}`;
}
