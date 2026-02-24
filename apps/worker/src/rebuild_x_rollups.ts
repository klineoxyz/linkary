/**
 * One-shot: rebuild x_analytics_rollups and x_top_drivers for all eligible profiles.
 * Run after deleting retweets from x_tweets so rollups/top drivers reflect only original posts.
 * Usage: pnpm run rebuild:x:rollups  OR  node dist/rebuild_x_rollups.js
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const workerDir = resolve(__dirname, "..");
const repoRoot = resolve(__dirname, "../..", "..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(workerDir, ".env") });
config({ path: resolve(repoRoot, "apps", "web", ".env.local") });

import { getSupabaseAdmin } from "./lib/supabase.js";
import { refreshXRollupsForProfile } from "./lib/refreshXRollups.js";

async function main() {
  const supabase = getSupabaseAdmin();
  const { data: profiles, error } = await supabase
    .from("profiles")
    .select("id")
    .not("twitter_connected_at", "is", null)
    .not("twitter_username", "is", null)
    .order("id");

  if (error) {
    console.error("[REBUILD_ROLLUPS] profile list error:", error.message);
    process.exit(1);
  }
  const list = (profiles ?? []).filter((p) => p?.id);
  console.log("[REBUILD_ROLLUPS] eligible profiles=" + list.length);
  let done = 0;
  for (const p of list) {
    await refreshXRollupsForProfile(supabase, p.id);
    done += 1;
  }
  console.log("[REBUILD_ROLLUPS] done processed=" + done);
  process.exit(0);
}

main().catch((e) => {
  console.error("[REBUILD_ROLLUPS] error", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
