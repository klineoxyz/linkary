/**
 * One-time REP backfill. Delegates to apps/web script.
 * Run from repo root: pnpm tsx scripts/backfillRep.ts
 * (Ensure .env or .env.local with SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL is loaded.)
 *
 * Or from apps/web: pnpm exec tsx scripts/backfillRep.ts
 */
const path = require("path");
const { execSync } = require("child_process");

const root = path.resolve(__dirname, "..");
const webScript = path.join(root, "apps/web/scripts/backfillRep.ts");

execSync(`npx tsx "${webScript}"`, {
  stdio: "inherit",
  cwd: path.join(root, "apps/web"),
  env: process.env,
});
