#!/usr/bin/env node
/**
 * Run Lighthouse on authenticated app routes using an existing Chrome session.
 *
 * Prerequisite: Chrome must be running with remote debugging and you must be
 * logged in to Linkary in that browser.
 *
 * Option A — Chrome with remote debugging (recommended):
 *   1. Close all Chrome windows.
 *   2. Start Chrome with a debugging port:
 *        Windows: "C:\Program Files\Google\Chrome\Application\chrome.exe" --remote-debugging-port=9222
 *        macOS:   /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
 *   3. In that Chrome, go to your app (e.g. http://localhost:3000), log in.
 *   4. In a terminal (with server already running: pnpm start):
 *        node scripts/run-lighthouse-authenticated.js 9222
 *        Or: PORT=9222 node scripts/run-lighthouse-authenticated.js
 *
 * Option B — DevTools:
 *   Open your app in Chrome, log in, open DevTools → Lighthouse. Uncheck "Clear storage".
 *   Run a report for each URL manually and record FCP, LCP, TBT, CLS.
 *
 * Usage:
 *   node scripts/run-lighthouse-authenticated.js [PORT] [BASE_URL] [ORG_ID]
 *   PORT     — Chrome remote debugging port (default: 9222). If missing, script prints instructions only.
 *   BASE_URL — e.g. http://localhost:3000 (default: http://localhost:3000)
 *   ORG_ID   — real org id for /org/[id] (default: skip org route if not set)
 *
 * Writes: .lighthouse/<route>-<mobile|desktop>.json and prints a summary table.
 */

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const PORT = process.env.PORT || process.argv[2];
const BASE_URL = process.env.BASE_URL || process.argv[3] || "http://localhost:3000";
const ORG_ID = process.env.ORG_ID || process.argv[4];

const OUT_DIR = path.join(__dirname, "..", ".lighthouse");
const ROUTES = [
  { path: "/app", name: "app" },
  { path: "/app/dashboard", name: "app-dashboard" },
  { path: "/app/analytics", name: "app-analytics" },
  ...(ORG_ID ? [{ path: `/org/${ORG_ID}`, name: "org-detail" }] : []),
];

function runLighthouse(url, name, formFactor, outPath) {
  const args = [
    url,
    "--output=json",
    `--output-path=${outPath}`,
    "--only-categories=performance",
    "--quiet",
    "--no-enable-error-reporting",
    "--disable-storage-reset",
    `--port=${PORT}`,
    `--form-factor=${formFactor}`,
  ];
  if (formFactor === "mobile") {
    args.push("--screenEmulation.mobile=1");
  }
  const result = spawnSync("npx", ["--yes", "lighthouse", ...args], {
    stdio: "inherit",
    shell: true,
    cwd: path.join(__dirname, ".."),
  });
  return result.status === 0;
}

function readMetrics(jsonPath) {
  try {
    const raw = fs.readFileSync(jsonPath, "utf8");
    const data = JSON.parse(raw);
    const audits = data.audits || {};
    const fcp = audits["first-contentful-paint"]?.numericValue;
    const lcp = audits["largest-contentful-paint"]?.numericValue;
    const tbt = audits["total-blocking-time"]?.numericValue;
    const cls = audits["cumulative-layout-shift"]?.numericValue;
    const fid = audits["max-potential-fid"]?.numericValue;
    const finalUrl = data.finalUrl || data.requestedUrl;
    const warning = data.runWarnings?.length ? data.runWarnings[0] : null;
    return { fcp, lcp, tbt, cls, fid, finalUrl, warning };
  } catch (e) {
    return { error: e.message };
  }
}

function main() {
  if (!fs.existsSync(OUT_DIR)) {
    fs.mkdirSync(OUT_DIR, { recursive: true });
  }

  if (!PORT || isNaN(Number(PORT))) {
    console.log("Authenticated Lighthouse — no PORT provided.\n");
    console.log("To measure the app while logged in:\n");
    console.log("  1. Start Chrome with remote debugging:");
    console.log('     Windows: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe" --remote-debugging-port=9222');
    console.log('     macOS:   /Applications/Google\\ Chrome.app/Contents/MacOS/Google\\ Chrome --remote-debugging-port=9222\n');
    console.log("  2. In that Chrome, open " + BASE_URL + " and log in.\n");
    console.log("  3. With your app server running (pnpm start), run:");
    console.log("     node scripts/run-lighthouse-authenticated.js 9222");
    console.log("     Or with org: node scripts/run-lighthouse-authenticated.js 9222 " + BASE_URL + " YOUR_ORG_ID\n");
    console.log("Routes that will be measured: /app, /app/dashboard, /app/analytics" + (ORG_ID ? ", /org/" + ORG_ID : " (set ORG_ID for org)") + "\n");
    process.exit(0);
    return;
  }

  console.log("Lighthouse (authenticated session, port " + PORT + ")");
  console.log("Base URL: " + BASE_URL + (ORG_ID ? ", Org: " + ORG_ID : ""));
  console.log("");

  const results = [];

  for (const route of ROUTES) {
    const url = BASE_URL.replace(/\/$/, "") + route.path;
    for (const formFactor of ["mobile", "desktop"]) {
      const outName = `${route.name}-${formFactor}.json`;
      const outPath = path.join(OUT_DIR, outName);
      process.stdout.write(`  ${route.path} (${formFactor}) ... `);
      const ok = runLighthouse(url, route.name, formFactor, outPath);
      if (ok) {
        const m = readMetrics(outPath);
        if (m.error) {
          console.log("error: " + m.error);
        } else {
          console.log("FCP " + (m.fcp != null ? Math.round(m.fcp) + "ms" : "—") + ", LCP " + (m.lcp != null ? Math.round(m.lcp) + "ms" : "—"));
          if (m.warning) results.push({ route: route.path, formFactor, warning: m.warning });
          results.push({ route: route.path, formFactor, ...m });
        }
      } else {
        console.log("failed");
      }
    }
  }

  console.log("\n--- Summary (authenticated app routes) ---\n");
  const table = [];
  for (const r of results) {
    if (r.error) continue;
    table.push({
      Route: r.route,
      Device: r.formFactor,
      FCP: r.fcp != null ? Math.round(r.fcp) + " ms" : "—",
      LCP: r.lcp != null ? Math.round(r.lcp) + " ms" : "—",
      TBT: r.tbt != null ? Math.round(r.tbt) + " ms" : "—",
      CLS: r.cls != null ? r.cls.toFixed(2) : "—",
      "FID (max)": r.fid != null ? Math.round(r.fid) + " ms" : "—",
    });
  }
  if (table.length) {
    console.table(table);
    const withWarning = results.filter((r) => r.warning);
    if (withWarning.length) {
      console.log("Warnings (e.g. redirect):");
      withWarning.forEach((r) => console.log("  " + r.route + " (" + r.formFactor + "): " + r.warning));
    }
  }
  console.log("\nJSON reports: " + OUT_DIR);
}

main();
