/**
 * One-time REP backfill. Delegates to apps/web script.
 * Run from repo root: pnpm backfill-rep
 * Loads apps/web/.env.local (and .env) so Supabase env vars are available.
 */
const path = require("path");
const fs = require("fs");
const { execSync } = require("child_process");

function loadEnvFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.replace(/#.*/, "").trim();
      const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
      if (match) {
        const value = match[2].replace(/^["']|["']$/g, "").trim();
        if (!process.env[match[1]]) process.env[match[1]] = value;
      }
    }
  } catch (_) {
    /* file missing or unreadable */
  }
}

const root = path.resolve(__dirname, "..");
const webDir = path.join(root, "apps/web");
loadEnvFile(path.join(webDir, ".env"));
loadEnvFile(path.join(webDir, ".env.local"));

const webScript = path.join(webDir, "scripts/backfillRep.ts");

execSync(`npx tsx "${webScript}"`, {
  stdio: "inherit",
  cwd: webDir,
  env: process.env,
});
