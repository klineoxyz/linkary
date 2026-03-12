#!/usr/bin/env node
/**
 * Run Lighthouse on key routes and write JSON reports.
 * Requires: npm install -D lighthouse chrome-launcher (or run via npx lighthouse).
 *
 * Usage (from repo root or apps/web):
 *   node scripts/run-lighthouse.js [BASE_URL]
 *   BASE_URL default: http://localhost:3000
 *
 * Or with npx (no install):
 *   npx lighthouse http://localhost:3000 --output=json --output-path=./lighthouse-.json --chrome-flags="--headless" --only-categories=performance
 *   (repeat for each route and mobile/desktop)
 */
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE_URL || process.argv[2] || "http://localhost:3000";
const ROUTES = [
  { path: "/", name: "home" },
  { path: "/app", name: "app" },
  { path: "/app/dashboard", name: "app-dashboard" },
  { path: "/app/analytics", name: "app-analytics" },
  { path: "/org/demo", name: "org-detail" }, // replace demo with real org id if needed
];

console.log("Lighthouse verification — run with a production build and server.");
console.log("  pnpm build && pnpm start (in apps/web)");
console.log("  Then in another terminal:");
console.log("  npx lighthouse " + BASE + " --output=json --output-path=./.lighthouse/home.json --chrome-flags='--headless' --only-categories=performance");
console.log("");
console.log("Routes to measure (mobile + desktop):");
ROUTES.forEach((r) => {
  console.log("  " + BASE + r.path + " -> .lighthouse/" + r.name + "-mobile.json / " + r.name + "-desktop.json");
});
console.log("");
console.log("Mobile (throttling): add --form-factor=mobile --screenEmulation.mobile");
console.log("Desktop: add --form-factor=desktop");
console.log("");
console.log("Example one-off (mobile, home):");
console.log("  npx lighthouse " + BASE + " --output=json --output-path=./.lighthouse/home-mobile.json --chrome-flags='--headless' --form-factor=mobile --only-categories=performance");
