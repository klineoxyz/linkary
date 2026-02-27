/**
 * One-time REP backfill: compute rep_score for all profiles.
 * Run from repo root: pnpm tsx apps/web/scripts/backfillRep.ts
 * Or from apps/web: pnpm exec tsx scripts/backfillRep.ts
 * Requires: SUPABASE_SERVICE_ROLE_KEY and NEXT_PUBLIC_SUPABASE_URL in env.
 */
import { createClient } from "@supabase/supabase-js";
import { computeRep } from "../src/lib/repScore";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  console.error("Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

async function main() {
  const supabase = createClient(supabaseUrl, serviceKey);

  const { data: profileRows, error: fetchError } = await supabase.from("profiles").select("id");
  if (fetchError) {
    console.error("Fetch profiles failed:", fetchError.message);
    process.exit(1);
  }

  const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
  console.log(`Found ${ids.length} profiles. Computing REP...`);

  let updated = 0;
  for (const profileId of ids) {
    try {
      await computeRep(profileId, supabase, { write: true });
      updated += 1;
      if (updated % 100 === 0) console.log(`  ${updated}/${ids.length}`);
    } catch (e) {
      console.warn(`  Skip ${profileId}:`, (e as Error).message);
    }
  }

  console.log(`Done. total_processed=${ids.length}, updated=${updated}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
