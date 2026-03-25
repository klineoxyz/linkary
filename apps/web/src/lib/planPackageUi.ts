/**
 * Display-only copy for approved plan_key packages. Business rules stay in @linkary/plan-key / API.
 */

/** In-app shell lives under /app/*; this route exists at src/app/app/pricing/page.tsx. */
export const PRICING_PATH = "/app/pricing";

export type PlanKeyUi = "free" | "nano" | "kol" | "startup" | "unicorn" | "custom";

export const PLAN_DISPLAY_NAME: Record<PlanKeyUi, string> = {
  free: "Free",
  nano: "NaNo Pack",
  kol: "KOL Pack",
  startup: "StartUP Pack",
  unicorn: "UniCorn Pack",
  custom: "Custom",
};

/** Creator-side profile subscriptions (linkary.xyz). */
export const CREATOR_PLAN_KEYS: PlanKeyUi[] = ["free", "nano", "kol"];

/** Org / workspace subscriptions (CRM + team workflows). */
export const TEAM_PLAN_KEYS: PlanKeyUi[] = ["startup", "unicorn", "custom"];

export function upgradeCtaLine(context: "analytics" | "discovery" | "cross_user_analytics"): string {
  switch (context) {
    case "analytics":
      return "New accounts get a 3-day trial of full charts on first visit. After that, upgrade to NaNo Pack or higher for full charts, period-over-period deltas, and deeper X analytics on your own profile.";
    case "discovery":
      return "Discovery search is included from NaNo Pack upward on your personal subscription.";
    case "cross_user_analytics":
      return "Viewing other creators’ analytics requires a KOL Pack or higher personal plan. See pricing for details.";
    default:
      return "See pricing for eligible packs.";
  }
}
