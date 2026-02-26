/** First-path segments that are app routes, not usernames. Must match App.tsx RESERVED_PATHS. */
export const RESERVED_PATHS = new Set([
  "dashboard", "explore", "terms", "privacy-policy", "privacy", "login", "onboarding",
  "profile", "overview", "market", "messages", "circles", "analytics", "verification",
  "pricing", "billing", "plans", "app", "api", "settings", "test-supabase", "home",
  "leaderboards", "creator", "brand", "agency", "calendar", "host", "availability",
  "monetization", "monetization-flow", "kol-lists", "capital-partners",
  "preferences", "support", "notifications", "verification-inbox", "showcase",
  "integrations", "roles-skills", "u",
]);

export function isReservedPath(segment: string): boolean {
  return RESERVED_PATHS.has(segment.toLowerCase());
}
