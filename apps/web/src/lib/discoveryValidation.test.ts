/**
 * Unit tests for discovery validation and response shaping.
 * Run with: pnpm exec tsx apps/web/src/lib/discoveryValidation.test.ts
 */
import {
  validateDiscoveryQuery,
  DISCOVERY_MAX_LIMIT,
  DISCOVERY_DEFAULT_LIMIT,
  DISCOVERY_MAX_OFFSET,
  DISCOVERY_QUERY_MAX_LENGTH,
} from "./discoveryValidation";
import { shapeDiscoveryProfileForResponse, shapeDiscoveryOrgForResponse } from "./discoveryResponseShape";
import { DISCOVERY_FORBIDDEN_FIELDS as FORBIDDEN_FIELDS } from "./discoveryAllowlist";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- validateDiscoveryQuery
const p = (params: Record<string, string>) => new URLSearchParams(params);

let v = validateDiscoveryQuery(p({}));
assert(v.limit === DISCOVERY_DEFAULT_LIMIT, "default limit");
assert(v.offset === 0, "default offset");
assert(v.q === undefined, "no q");

v = validateDiscoveryQuery(p({ limit: "5", offset: "10" }));
assert(v.limit === 5, "limit 5");
assert(v.offset === 10, "offset 10");

v = validateDiscoveryQuery(p({ limit: "999", offset: "0" }));
assert(v.limit === DISCOVERY_MAX_LIMIT, "limit clamped to max");

v = validateDiscoveryQuery(p({ offset: "999999" }));
assert(v.offset === DISCOVERY_MAX_OFFSET, "offset clamped to max");

v = validateDiscoveryQuery(p({ limit: "-1", offset: "-5" }));
assert(v.limit === DISCOVERY_DEFAULT_LIMIT, "negative limit -> default");
assert(v.offset === 0, "negative offset -> 0");

v = validateDiscoveryQuery(p({ q: "  hello  " }));
assert(v.q === "hello", "q trimmed");

v = validateDiscoveryQuery(p({ q: "a".repeat(DISCOVERY_QUERY_MAX_LENGTH + 100) }));
assert(v.q!.length === DISCOVERY_QUERY_MAX_LENGTH, "q capped at max length");

v = validateDiscoveryQuery(p({ q: "foo***bar%%" }));
assert(v.q === "foobar", "q sanitized * and %");

// --- shapeDiscoveryProfileForResponse: no forbidden fields
const profileWithExtra = {
  type: "profile",
  username: "u",
  display_name: "d",
  avatar_url: null,
  bio: null,
  twitter_username: null,
  xscore: null,
  analytics_snapshot: null,
  tags: [],
  email: "leak@example.com",
  location: "NYC",
  id: "internal-id",
  user_id: "auth-id",
} as unknown as import("./discoveryAllowlist").DiscoveryProfileResult;
const shapedProfile = shapeDiscoveryProfileForResponse(profileWithExtra);
for (const key of FORBIDDEN_FIELDS) {
  assert(!(key in shapedProfile), `profile response must not contain forbidden field: ${key}`);
}
assert(shapedProfile.username === "u", "allowlisted field preserved");
assert((shapedProfile as Record<string, unknown>).email === undefined, "email not in response");
assert((shapedProfile as Record<string, unknown>).id === undefined, "id not in response");

// --- shapeDiscoveryOrgForResponse: no forbidden fields
const orgWithExtra = {
  type: "org",
  slug: "s",
  name: "n",
  tagline: null,
  logo_url: null,
  twitter_username: null,
  xscore: null,
  analytics_snapshot: null,
  ecosystem_categories: [],
  id: "org-internal",
  email: "org@example.com",
} as unknown as import("./discoveryAllowlist").DiscoveryOrgResult;
const shapedOrg = shapeDiscoveryOrgForResponse(orgWithExtra);
assert(!("id" in shapedOrg), "org response must not contain id");
assert(!("email" in shapedOrg), "org response must not contain email");
assert(shapedOrg.slug === "s", "allowlisted field preserved");

console.log("discoveryValidation.test.ts: all assertions passed");
export {};
