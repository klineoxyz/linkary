/**
 * QA super command: runs full REP pipeline then prints summary stats.
 * Run from repo root: pnpm run qa:rep
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or apps/web/.env.local).
 */
import { execSync } from "child_process";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

const envLocalPath =
  existsSync(resolve(process.cwd(), "apps/web/.env.local"))
    ? resolve(process.cwd(), "apps/web/.env.local")
    : resolve(process.cwd(), ".env.local");
if (existsSync(envLocalPath)) {
  const content = readFileSync(envLocalPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/);
    if (m) {
      const key = m[1].trim();
      const val = m[2].trim().replace(/^["']|["']$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  console.error("Missing env. Exiting.");
  process.exit(1);
}

function run(name: string, command: string) {
  console.log("\n--- " + name + " ---\n");
  execSync(command, { stdio: "inherit", cwd: process.cwd() });
}

async function main() {
  run("diagnose-engagement", "pnpm run diagnose-engagement");
  run("backfill-engagement", "pnpm run backfill-engagement");
  run("backfill-rep", "pnpm run backfill-rep");
  run("verifyRepMonotonic", "pnpm exec tsx apps/web/scripts/verifyRepMonotonic.ts");

  const supabase = createClient(supabaseUrl, serviceKey);
  const { count: totalProfiles } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  const { data: rows } = await supabase.from("profiles").select("rep_score, avg_engagement_per_post");

  const list = (rows ?? []) as Array<{ rep_score: number | null; avg_engagement_per_post: number | null }>;
  const withEngagement = list.filter((r) => r.avg_engagement_per_post != null).length;
  const repScores = list.map((r) => Number(r.rep_score)).filter((n) => Number.isFinite(n));
  const minRep = repScores.length > 0 ? Math.min(...repScores) : null;
  const maxRep = repScores.length > 0 ? Math.max(...repScores) : null;

  console.log("\n--- Summary ---");
  console.log("Total profiles:", totalProfiles ?? 0);
  console.log("Profiles with engagement:", withEngagement);
  console.log("Min REP:", minRep ?? "—");
  console.log("Max REP:", maxRep ?? "—");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
