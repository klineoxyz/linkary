/**
 * Weekly cron: fetch tweets per eligible profile, ingest into public.x_tweets, update x_last_tweets_sync_at.
 * One-shot script: exits 0 when done. No server.
 * Eligible: twitter_username non-empty, twitter_connected_at set. Logs sanity counts and selected_count.
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

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

async function main() {
  console.log("[WEEKLY] starting weekly tweet sync");
  const supabaseUrlPresent =
    envPresent("SUPABASE_URL") || envPresent("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRolePresent =
    envPresent("SUPABASE_SERVICE_ROLE_KEY") ||
    envPresent("SUPABASE_SERVICE_KEY") ||
    envPresent("SERVICE_ROLE_KEY");
  const twitterApiPresent = envPresent("TWITTERAPI_API_KEY");
  console.log(
    "[WEEKLY] env: SUPABASE_URL present=" +
      supabaseUrlPresent +
      ", SERVICE_ROLE present=" +
      serviceRolePresent +
      ", TWITTERAPI present=" +
      twitterApiPresent
  );

  const supabase = getSupabaseAdmin();
  const TABLE = "profiles";
  console.log("[WEEKLY] query table=" + TABLE);

  // Sanity counts (no filters that might exclude everyone)
  const { count: totalProfiles } = await supabase.from(TABLE).select("*", { count: "exact", head: true });
  const { count: withHandle } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .not("twitter_username", "is", null);
  const { count: withConnectedAt } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .not("twitter_connected_at", "is", null);
  const { count: withUserId } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .not("twitter_user_id", "is", null);
  const { count: withSyncOk } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("x_sync_status", "ok");
  console.log(
    "[WEEKLY] sanity total_profiles=" + (totalProfiles ?? "?") +
    " with_handle=" + (withHandle ?? "?") +
    " with_connected_at=" + (withConnectedAt ?? "?") +
    " with_user_id=" + (withUserId ?? "?") +
    " with_sync_ok=" + (withSyncOk ?? "?")
  );

  // Select: twitter_username and twitter_connected_at set (no is_indexed / x_last_tweets_sync_at filter so we don't exclude everyone)
  const { data: profiles, error: listError } = await supabase
    .from(TABLE)
    .select("id, twitter_username")
    .not("twitter_username", "is", null)
    .not("twitter_connected_at", "is", null)
    .order("id")
    .limit(BATCH_SIZE);

  const selectedCount = (profiles ?? []).length;
  if (listError) {
    console.error("[WEEKLY] supabase_error message=" + listError.message + " code=" + (listError.code ?? "?") + " details=" + JSON.stringify(listError.details ?? {}));
    process.exit(1);
  }
  console.log("[WEEKLY] selected_count=" + selectedCount);

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username != null && String(p.twitter_username).trim().length > 0
  );
  if (list.length === 0) {
    console.warn(
      "[WEEKLY] selected_count=0. Sanity: total_profiles=" + (totalProfiles ?? "?") +
      " with_handle=" + (withHandle ?? "?") + " with_connected_at=" + (withConnectedAt ?? "?") +
      " with_sync_ok=" + (withSyncOk ?? "?") + ". Check filters."
    );
    process.exit(0);
  }

  let profilesProcessed = 0;
  let tweetsTotalUpserted = 0;
  let err = 0;

  for (const profile of list) {
    const raw = String(profile.twitter_username ?? "").trim().replace(/^@/, "");
    const handle = raw.toLowerCase();
    if (!handle) continue;
    try {
      const result = await ingestXTweets(supabase, {
        profile_id: profile.id,
        twitter_username: handle,
        maxTweets: MAX_TWEETS,
      });
      profilesProcessed += 1;
      tweetsTotalUpserted += result.upserted;
      console.log("[WEEKLY] profile_id=" + profile.id + " handle=" + handle + " fetched=" + result.fetched + " upserted=" + result.upserted);

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

  console.log("[WEEKLY] done profiles_processed=" + profilesProcessed + " tweets_total_upserted=" + tweetsTotalUpserted);
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
