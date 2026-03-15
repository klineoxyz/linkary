/**
 * Tests for analytics profile route path: /app/analytics/profile/[username].
 * Run with: pnpm exec tsx apps/web/src/lib/appRouting.test.ts
 *
 * Ensures: Discover people -> /app/analytics/profile/[username]; no duplicate profile route.
 */
import { buildAnalyticsProfilePath, parseAnalyticsProfilePath } from "./appRouting";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// --- buildAnalyticsProfilePath
assert(buildAnalyticsProfilePath("alice") === "/app/analytics/profile/alice", "build alice");
assert(buildAnalyticsProfilePath("@bob") === "/app/analytics/profile/bob", "build @bob strips @");
assert(buildAnalyticsProfilePath("user-name") === "/app/analytics/profile/user-name", "build with hyphen");
assert(buildAnalyticsProfilePath("u%2F") === "/app/analytics/profile/u%252F", "build encodes");

// --- parseAnalyticsProfilePath
assert(parseAnalyticsProfilePath("/app/analytics/profile/alice")?.username === "alice", "parse full path");
assert(parseAnalyticsProfilePath("app/analytics/profile/bob")?.username === "bob", "parse app/ prefix");
assert(parseAnalyticsProfilePath("analytics/profile/carol")?.username === "carol", "parse no app");
assert(parseAnalyticsProfilePath(null) === null, "parse null");
assert(parseAnalyticsProfilePath("") === null, "parse empty");
assert(parseAnalyticsProfilePath("/app/profile") === null, "parse profile not analytics");
assert(parseAnalyticsProfilePath("/app/analytics") === null, "parse analytics only");
assert(parseAnalyticsProfilePath("/app/analytics/profile/") === null, "parse trailing slash empty segment");

// --- Roundtrip: build then parse (normalized form)
const username = "test-user";
const path = buildAnalyticsProfilePath(username);
const parsed = parseAnalyticsProfilePath(path);
assert(parsed !== null, "roundtrip parsed");
assert(parsed!.username === "test-user", "roundtrip username");

// --- No duplicate profile route: analytics profile path is under /app/analytics/profile/, not /{username}
assert(!path.startsWith("/app/profile/") || path.includes("analytics"), "analytics path is not /app/profile/");
assert(path.includes("analytics/profile"), "path contains analytics/profile");

console.log("appRouting.test.ts: all assertions passed");
export {};
