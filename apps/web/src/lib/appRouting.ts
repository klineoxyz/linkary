/**
 * App route path helpers for analytics profile (cross-user analytics viewer).
 * Ensures /app/analytics/profile/[username] and route analyticsProfile stay in sync.
 * Tested so Discover people -> analytics viewer and View public profile -> /{username} are correct.
 */

const APP_PREFIX = "/app";

/**
 * Build path for cross-user analytics viewer: /app/analytics/profile/[username]
 */
export function buildAnalyticsProfilePath(username: string): string {
  const slug = String(username).replace(/^@/, "").trim();
  if (!slug) return `${APP_PREFIX}/analytics`;
  return `${APP_PREFIX}/analytics/profile/${encodeURIComponent(slug)}`;
}

/**
 * Parse pathname to analytics profile username if this is the analytics/profile route.
 * pathname can be full (e.g. /app/analytics/profile/alice) or normalized (e.g. analytics/profile/alice).
 */
export function parseAnalyticsProfilePath(pathname: string | null): { username: string } | null {
  if (!pathname || typeof pathname !== "string") return null;
  let norm = pathname.replace(/^\//, "").replace(/\/$/, "").trim();
  if (norm.startsWith("app/")) norm = norm.slice(4);
  const parts = norm.split("/").map((p) => p.trim());
  if (parts[0] === "analytics" && parts[1] === "profile" && parts[2]) {
    try {
      const username = decodeURIComponent(parts[2]);
      return username ? { username } : null;
    } catch {
      return null;
    }
  }
  return null;
}
