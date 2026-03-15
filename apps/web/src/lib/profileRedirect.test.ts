/**
 * Tests for profile redirect rule: /app/profile?username=other -> analytics viewer.
 * Run with: pnpm exec tsx apps/web/src/lib/profileRedirect.test.ts
 */
import { shouldRedirectProfileToAnalytics } from "./profileRedirect";

function assert(cond: boolean, msg: string) {
  if (!cond) throw new Error(msg);
}

// Viewing self: no redirect
assert(!shouldRedirectProfileToAnalytics(undefined, "alice"), "no viewUsername -> no redirect");
assert(!shouldRedirectProfileToAnalytics("", "alice"), "empty viewUsername -> no redirect");
assert(!shouldRedirectProfileToAnalytics("alice", ""), "empty publicSlug -> no redirect");
assert(!shouldRedirectProfileToAnalytics("alice", "alice"), "same username -> no redirect");
assert(!shouldRedirectProfileToAnalytics("ALICE", "alice"), "same username case-insensitive -> no redirect");
assert(!shouldRedirectProfileToAnalytics("@alice", "alice"), "same with @ -> no redirect");

// Viewing other: redirect
assert(shouldRedirectProfileToAnalytics("bob", "alice"), "different username -> redirect");
assert(shouldRedirectProfileToAnalytics("@bob", "alice"), "different with @ -> redirect");
assert(shouldRedirectProfileToAnalytics("  bob  ", "alice"), "trimmed other -> redirect");

console.log("profileRedirect.test.ts: all assertions passed");
export {};
