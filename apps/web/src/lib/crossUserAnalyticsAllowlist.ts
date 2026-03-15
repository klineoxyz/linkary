/**
 * Allowlist for cross-user analytics API response.
 * Ensures only safe fields are returned; no email, location, pricing, auth ids, or private metadata.
 * Used by GET /api/me/analytics/profile/[username] and tested for payload safety.
 */

/** Allowed keys for the profile object in cross-user analytics response. */
export const CROSS_USER_ANALYTICS_PROFILE_KEYS = [
  "username",
  "display_name",
  "avatar_url",
] as const;

/** Allowed keys for the analytics object (from x_analytics_rollups). */
export const CROSS_USER_ANALYTICS_ANALYTICS_KEYS = [
  "posts_7d",
  "posts_30d",
  "posts_90d",
  "avg_likes_30d",
  "avg_replies_30d",
  "engagement_rate_30d",
  "reach_proxy_30d",
] as const;

/** Keys that must NEVER appear in cross-user analytics response (profile or analytics). */
export const CROSS_USER_ANALYTICS_FORBIDDEN = [
  "email",
  "location",
  "street",
  "city",
  "pricing",
  "pricing_notes",
  "meta",
  "user_id",
  "id",
  "auth",
  "internal_id",
  "private_metadata",
  "contact_email",
  "profile_id",
] as const;

const PROFILE_SET = new Set<string>(CROSS_USER_ANALYTICS_PROFILE_KEYS as unknown as string[]);
const ANALYTICS_SET = new Set<string>(CROSS_USER_ANALYTICS_ANALYTICS_KEYS as unknown as string[]);
const FORBIDDEN_SET = new Set<string>(CROSS_USER_ANALYTICS_FORBIDDEN as unknown as string[]);

export type ShapedProfile = { username: string; display_name: string | null; avatar_url: string | null };
export type ShapedAnalytics = {
  posts_7d: number | null;
  posts_30d: number | null;
  posts_90d: number | null;
  avg_likes_30d: number | null;
  avg_replies_30d: number | null;
  engagement_rate_30d: number | null;
  reach_proxy_30d: number | null;
};

/**
 * Shape profile row and optional rollup into allowlisted response. Only allowed keys are copied.
 */
export function shapeCrossUserAnalyticsResponse(
  profileRow: { username?: string | null; display_name?: string | null; avatar_url?: string | null },
  usernameFallback: string,
  rollup: Record<string, unknown> | null
): { profile: ShapedProfile; analytics: ShapedAnalytics | null } {
  const profile: ShapedProfile = {
    username: (profileRow.username ?? usernameFallback) ?? "",
    display_name: profileRow.display_name ?? null,
    avatar_url: profileRow.avatar_url ?? null,
  };

  let analytics: ShapedAnalytics | null = null;
  if (rollup) {
    analytics = {
      posts_7d: (rollup.posts_7d as number | null) ?? null,
      posts_30d: (rollup.posts_30d as number | null) ?? null,
      posts_90d: (rollup.posts_90d as number | null) ?? null,
      avg_likes_30d: (rollup.avg_likes_30d as number | null) ?? null,
      avg_replies_30d: (rollup.avg_replies_30d as number | null) ?? null,
      engagement_rate_30d: (rollup.engagement_rate_30d as number | null) ?? null,
      reach_proxy_30d: (rollup.reach_proxy_30d as number | null) ?? null,
    };
  }

  return { profile, analytics };
}

/** Return true if an object has only allowed profile keys and no forbidden keys. */
export function isSafeProfileObject(obj: Record<string, unknown>): boolean {
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_SET.has(key)) return false;
    if (!PROFILE_SET.has(key)) return false;
  }
  return true;
}

/** Return true if an object has only allowed analytics keys and no forbidden keys. */
export function isSafeAnalyticsObject(obj: Record<string, unknown> | null): boolean {
  if (obj === null) return true;
  for (const key of Object.keys(obj)) {
    if (FORBIDDEN_SET.has(key)) return false;
    if (!ANALYTICS_SET.has(key)) return false;
  }
  return true;
}
