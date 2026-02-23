/**
 * Weekly cron: fetch tweets per eligible profile, ingest into public.x_tweets, update x_last_tweets_sync_at.
 * One-shot script: exits 0 when done. No server.
 * Eligible: is_indexed, twitter_username set, twitter_connected_at set, (x_last_tweets_sync_at null or >6 days ago).
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(__dirname, ".env") });

import { getSupabaseAdmin } from "./lib/supabase.js";
import { ingestXTweets } from "./lib/ingestXTweets.js";
import { refreshXRollupsForProfile } from "./lib/refreshXRollups.js";
import { sleep } from "./lib/utils.js";

const BATCH_SIZE = 100;
const MAX_TWEETS = 50;
const DELAY_MS = 600;

async function main() {
  const supabase = getSupabaseAdmin();
  const past6d = new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString();

  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username")
    .eq("is_indexed", true)
    .not("twitter_username", "is", null)
    .not("twitter_connected_at", "is", null)
    .or(`x_last_tweets_sync_at.is.null,x_last_tweets_sync_at.lt.${past6d}`)
    .order("id")
    .limit(BATCH_SIZE);

  if (listError) {
    console.error("Failed to list profiles:", listError.message);
    process.exit(1);
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
  );

  let profilesProcessed = 0;
  let tweetsTotalUpserted = 0;
  let err = 0;

  for (const profile of list) {
    const handle = String(profile.twitter_username).trim();
    if (!handle) continue;
    try {
      const result = await ingestXTweets(supabase, {
        profile_id: profile.id,
        twitter_username: handle,
        maxTweets: MAX_TWEETS,
      });
      profilesProcessed += 1;
      tweetsTotalUpserted += result.upserted;

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          x_last_tweets_sync_at: new Date().toISOString(),
          x_sync_status: "ok",
          x_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      if (updateErr) {
        await supabase
          .from("profiles")
          .update({
            x_sync_status: "error",
            x_sync_error: updateErr.message?.slice(0, 500) ?? "Update failed",
            updated_at: new Date().toISOString(),
          })
          .eq("id", profile.id);
        err += 1;
      } else if (result.upserted > 0) {
        try {
          await refreshXRollupsForProfile(supabase, profile.id);
        } catch (e) {
          console.warn("[WEEKLY] rollups refresh failed for profile " + profile.id + ":", e);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      if (msg.includes("x_tweets") || msg.includes("relation") || msg.includes("does not exist")) {
        console.error(
          "x_tweets table missing. Run migration: supabase/migrations/20260220000000_x_analytics_ingestion.sql"
        );
        process.exit(1);
      }
      await supabase
        .from("profiles")
        .update({
          x_sync_status: "error",
          x_sync_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      err += 1;
    }
    await sleep(DELAY_MS);
  }

  console.log("[WEEKLY] profiles_processed=" + profilesProcessed + " tweets_total_upserted=" + tweetsTotalUpserted);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
