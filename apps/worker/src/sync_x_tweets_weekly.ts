/**
 * Weekly cron: fetch up to 50 recent tweets per eligible profile, store new tweets,
 * compute rollups + top drivers, update x_last_tweets_sync_at.
 * Run on Railway (or locally) with SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TWITTERAPI_API_KEY.
 */
import { supabaseAdmin } from "./lib/supabaseAdmin.js";
import { getUserTweets, sleep } from "./lib/twitterapi.js";
import { insertXTweets, computeAndUpsertRollups } from "./lib/rollups.js";

const BATCH_SIZE = 200;
const MAX_TWEETS_PER_USER = 50;
const DELAY_MS = 600;

async function main() {
  const { data: profiles, error: listError } = await supabaseAdmin
    .from("profiles")
    .select("id, twitter_username, followers_total")
    .eq("is_indexed", true)
    .not("twitter_username", "is", null)
    .not("twitter_connected_at", "is", null)
    .order("id")
    .limit(BATCH_SIZE);

  if (listError) {
    console.error("Failed to list profiles:", listError.message);
    process.exit(1);
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
  );
  let ok = 0;
  let err = 0;
  let totalTweets = 0;

  for (const profile of list) {
    const handle = String(profile.twitter_username).trim().replace(/^@/, "");
    try {
      const tweets = await getUserTweets(handle, MAX_TWEETS_PER_USER);
      await sleep(DELAY_MS);

      const inserted = await insertXTweets(supabaseAdmin, profile.id, tweets);
      totalTweets += inserted;

      const followersTotal = typeof profile.followers_total === "number" ? profile.followers_total : 0;
      await computeAndUpsertRollups(supabaseAdmin, profile.id, followersTotal);

      await supabaseAdmin
        .from("profiles")
        .update({
          x_last_tweets_sync_at: new Date().toISOString(),
          x_sync_status: "ok",
          x_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);

      ok += 1;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await supabaseAdmin
        .from("profiles")
        .update({
          x_sync_status: "error",
          x_sync_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      err += 1;
    }
  }

  console.log(`Weekly sync done. Processed=${list.length} success=${ok} errors=${err} tweets_inserted=${totalTweets}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
