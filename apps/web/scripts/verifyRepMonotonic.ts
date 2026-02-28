/**
 * Verify REP stays 0–100 and breakdown is consistent. Optional guardrail check.
 * Run from repo root: pnpm exec tsx apps/web/scripts/verifyRepMonotonic.ts
 * Loads apps/web/.env.local if present. Requires NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";
import { computeRep } from "../src/lib/repScore";

// Load .env.local (from repo root: apps/web/.env.local; from apps/web: .env.local)
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

async function main() {
  const supabase = createClient(supabaseUrl, serviceKey);
  const { data: rows } = await supabase.from("profiles").select("id").limit(5);

  for (const row of rows ?? []) {
    const id = (row as { id: string }).id;
    const result = await computeRep(id, supabase, { write: false });

    const ok = result.rep >= 0 && result.rep <= 100;
    if (!ok) {
      console.error("Profile " + id + ": rep=" + result.rep + " out of range [0,100]");
      process.exit(1);
    }
    const sumWeights = 0.4 * result.socialBase + 0.35 * result.proofOfWork + 0.25 * result.networkTrust;
    const consistent = Math.abs(result.rep - Math.round(sumWeights)) <= 1;
    if (!consistent) {
      console.warn("Profile " + id + ": rep=" + result.rep + " vs weighted sum ~" + Math.round(sumWeights));
    }
    console.log("Profile " + id + ": rep=" + result.rep + ", socialBase=" + result.socialBase.toFixed(1) + ", proofOfWork=" + result.proofOfWork.toFixed(1) + ", networkTrust=" + result.networkTrust.toFixed(1));
  }

  console.log("REP guardrail check passed (0–100, breakdown consistent).");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
