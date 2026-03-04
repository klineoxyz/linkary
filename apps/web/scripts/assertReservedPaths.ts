/**
 * Asserts that key reserved paths exist in RESERVED_PATHS (single source of truth).
 * Run: pnpm exec tsx scripts/assertReservedPaths.ts (or add to check:reserved script).
 */
import { RESERVED_PATHS } from "../src/lib/reservedPaths";

const REQUIRED = [
  "app",
  "api",
  "auth",
  "login",
  "signup",
  "dashboard",
  "settings",
  "analytics",
  "xspaces",
  "calendar",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
];

const missing = REQUIRED.filter((p) => !RESERVED_PATHS.has(p));
if (missing.length > 0) {
  console.error("[assertReservedPaths] Missing required reserved paths:", missing);
  process.exit(1);
}
console.log("[assertReservedPaths] All", REQUIRED.length, "required reserved paths present.");
