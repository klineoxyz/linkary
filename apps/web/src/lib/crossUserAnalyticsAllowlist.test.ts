/**
 * Tests for cross-user analytics payload allowlist.
 * Run with: pnpm exec tsx apps/web/src/lib/crossUserAnalyticsAllowlist.test.ts
 *
 * Ensures: no email, location, pricing, auth ids, or private metadata in response.
 */
import {
  CROSS_USER_ANALYTICS_PROFILE_KEYS,
  CROSS_USER_ANALYTICS_ANALYTICS_KEYS,
  CROSS_USER_ANALYTICS_FORBIDDEN,
  shapeCrossUserAnalyticsResponse,
  isSafeProfileObject,
  isSafeAnalyticsObject,
} from "./crossUserAnalyticsAllowlist";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- Allowed keys: profile only has username, display_name, avatar_url
assert(
  CROSS_USER_ANALYTICS_PROFILE_KEYS.length === 3,
  "profile allowlist has exactly 3 keys"
);
assert(
  CROSS_USER_ANALYTICS_PROFILE_KEYS.includes("username"),
  "profile includes username"
);
assert(
  CROSS_USER_ANALYTICS_PROFILE_KEYS.includes("display_name"),
  "profile includes display_name"
);
assert(
  CROSS_USER_ANALYTICS_PROFILE_KEYS.includes("avatar_url"),
  "profile includes avatar_url"
);

// --- Forbidden keys include sensitive fields
assert(
  CROSS_USER_ANALYTICS_FORBIDDEN.includes("email"),
  "email is forbidden"
);
assert(
  CROSS_USER_ANALYTICS_FORBIDDEN.includes("location"),
  "location is forbidden"
);
assert(
  CROSS_USER_ANALYTICS_FORBIDDEN.includes("pricing"),
  "pricing is forbidden"
);
assert(
  CROSS_USER_ANALYTICS_FORBIDDEN.includes("user_id"),
  "user_id is forbidden"
);
assert(
  CROSS_USER_ANALYTICS_FORBIDDEN.includes("id"),
  "id is forbidden"
);

// --- shapeCrossUserAnalyticsResponse returns only allowlisted fields
const profileRowWithLeaks = {
  username: "alice",
  display_name: "Alice",
  avatar_url: "https://example.com/a.png",
  email: "leak@example.com",
  location: "NYC",
  id: "internal-id",
  user_id: "auth-123",
} as Record<string, unknown>;

const rollupWithLeaks = {
  posts_30d: 10,
  engagement_rate_30d: 2.5,
  profile_id: "leak-id",
  email: "never",
} as Record<string, unknown>;

const { profile, analytics } = shapeCrossUserAnalyticsResponse(
  profileRowWithLeaks,
  "alice",
  rollupWithLeaks
);

assert(profile.username === "alice", "profile.username");
assert(profile.display_name === "Alice", "profile.display_name");
assert(profile.display_name !== undefined, "display_name present");
assert(!("email" in profile), "profile must not contain email");
assert(!("location" in profile), "profile must not contain location");
assert(!("id" in profile), "profile must not contain id");
assert(!("user_id" in profile), "profile must not contain user_id");

assert(analytics !== null, "analytics object when rollup provided");
assert(analytics!.posts_30d === 10, "analytics.posts_30d");
assert(analytics!.engagement_rate_30d === 2.5, "analytics.engagement_rate_30d");
assert(!("profile_id" in analytics!), "analytics must not contain profile_id");
assert(!("email" in analytics!), "analytics must not contain email");

// --- Null rollup -> analytics null
const { analytics: analyticsNull } = shapeCrossUserAnalyticsResponse(
  { username: "bob", display_name: "Bob", avatar_url: null },
  "bob",
  null
);
assert(analyticsNull === null, "analytics is null when rollup null");

// --- isSafeProfileObject / isSafeAnalyticsObject
assert(isSafeProfileObject({ username: "x", display_name: "X", avatar_url: null }), "safe profile passes");
assert(!isSafeProfileObject({ username: "x", email: "y" }), "profile with email fails");
assert(!isSafeProfileObject({ username: "x", user_id: "y" }), "profile with user_id fails");

assert(isSafeAnalyticsObject({ posts_30d: 1, engagement_rate_30d: 1 }), "safe analytics passes");
assert(!isSafeAnalyticsObject({ posts_30d: 1, email: "x" }), "analytics with email fails");
assert(isSafeAnalyticsObject(null), "null analytics is safe");

console.log("crossUserAnalyticsAllowlist.test.ts: all assertions passed");
export {};
