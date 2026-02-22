#!/usr/bin/env node
/**
 * Smoke check for deployed Linkary. Run against BASE_URL (no auth for public checks).
 * With ADMIN_SMOKE_TOKEN (Bearer), runs /api/admin/smoke for internal diagnostics.
 *
 * Usage:
 *   BASE_URL=https://linkary.xyz node apps/web/scripts/smoke-check.js
 *   BASE_URL=https://linkary.xyz ADMIN_SMOKE_TOKEN=<superadmin-bearer> node apps/web/scripts/smoke-check.js
 *
 * Exit: 0 if all checks pass, 1 otherwise.
 */

const BASE_URL = process.env.BASE_URL?.replace(/\/$/, "") || "http://localhost:3000";
const ADMIN_SMOKE_TOKEN = process.env.ADMIN_SMOKE_TOKEN;

async function check(name, url, options = {}) {
  try {
    const res = await fetch(url, options);
    const ok = res.ok;
    let body = null;
    const ct = res.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      try {
        body = await res.json();
      } catch {
        body = "(invalid json)";
      }
    }
    return { name, ok, status: res.status, body };
  } catch (err) {
    return { name, ok: false, status: null, body: null, error: String(err.message || err) };
  }
}

async function main() {
  const results = [];
  let failed = 0;

  // A) Public smoke checks (no auth)
  const health = await check("GET /api/health", `${BASE_URL}/api/health`);
  results.push(health);
  if (!health.ok || (health.body && health.body.ok !== true)) {
    console.error("FAIL:", health.name, health.status, health.body || health.error);
    failed++;
  } else {
    console.log("OK:", health.name, health.body?.status ?? health.status);
  }

  // Public profile page: GET / (or a known slug if you have one) — 200 or 304
  const home = await check("GET / (home)", `${BASE_URL}/`);
  results.push(home);
  if (!home.ok && home.status !== 304) {
    console.error("FAIL:", home.name, home.status, home.error || "");
    failed++;
  } else {
    console.log("OK:", home.name, home.status);
  }

  // B) Auth-required admin smoke (optional)
  if (ADMIN_SMOKE_TOKEN) {
    const smoke = await check("GET /api/admin/smoke", `${BASE_URL}/api/admin/smoke`, {
      headers: { Authorization: `Bearer ${ADMIN_SMOKE_TOKEN}` },
    });
    results.push(smoke);
    if (!smoke.ok || (smoke.body && smoke.body.ok !== true)) {
      console.error("FAIL:", smoke.name, smoke.status, smoke.body || smoke.error);
      failed++;
    } else {
      console.log("OK:", smoke.name, smoke.body?.diagnostics ?? smoke.status);
    }
  } else {
    console.log("SKIP: GET /api/admin/smoke (set ADMIN_SMOKE_TOKEN to run)");
  }

  if (failed > 0) {
    process.exit(1);
  }
  console.log("All smoke checks passed.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
