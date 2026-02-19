/**
 * Weekly cron: fetch up to 50 recent tweets per eligible profile, insert into x_tweets,
 * update x_last_tweets_sync_at.
 * Eligible: is_indexed, twitter_connected_at not null, twitter_username not null,
 * and (x_last_tweets_sync_at is null or older than 6 days).
 */
import { getSupabaseAdmin } from "./lib/supabase.js";
import { getRecentTweets } from "./lib/twitterapi.js";
import { sleep, normalizeHandle } from "./lib/utils.js";

const BATCH_SIZE = 100;
const MAX_TWEETS = 50;
const DELAY_MS = 600;

function parseTweetCreatedAt(createdAt: string | undefined): string | null {
  if (!createdAt || typeof createdAt !== "string") return null;
  const d = new Date(createdAt);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

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
  let ok = 0;
  let err = 0;
  let totalInserted = 0;

  for (const profile of list) {
    const handle = normalizeHandle(String(profile.twitter_username));
    if (!handle) continue;
    try {
      const tweets = await getRecentTweets(handle, MAX_TWEETS);
      await sleep(DELAY_MS);

      let inserted = 0;
      for (const t of tweets) {
        const tweetId = String(t.id ?? "").trim();
        if (!tweetId) continue;
        const tweetedAt = parseTweetCreatedAt(t.createdAt);
        if (!tweetedAt) continue;
        const { error: upsertErr } = await supabase.from("x_tweets").upsert(
          {
            profile_id: profile.id,
            tweet_id: tweetId,
            tweeted_at: tweetedAt,
            text: (t.text ?? "").slice(0, 500) || null,
            like_count: Math.max(0, Number(t.likeCount) || 0),
            reply_count: Math.max(0, Number(t.replyCount) || 0),
            repost_count: Math.max(0, Number(t.retweetCount) || 0),
            quote_count: Math.max(0, Number(t.quoteCount) || 0),
            raw: t as unknown as Record<string, unknown>,
          },
          { onConflict: "profile_id,tweet_id", ignoreDuplicates: true }
        );
        if (!upsertErr) inserted += 1;
      }
      totalInserted += inserted;

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
        continue;
      }
      ok += 1;
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
  }

  console.log(`Weekly sync done. processed=${list.length} ok=${ok} errors=${err} tweets_inserted=${totalInserted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
