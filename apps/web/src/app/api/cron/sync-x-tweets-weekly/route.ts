import { NextRequest, NextResponse } from "next/server";
import {
  createServiceSupabase,
  fetchXUserTweets,
  insertXTweets,
  computeAndUpsertRollups,
} from "@/lib/x-analytics-server";

const BATCH_SIZE = 100;
const MAX_TWEETS_PER_USER = 50;
const DELAY_MS = 600;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Weekly cron: fetch up to 50 tweets per indexed profile, store new tweets, compute rollups + top drivers. Protected by CRON_SECRET. */
export async function POST(request: NextRequest) {
  const secret = request.headers.get("x-cron-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.TWITTERAPI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TWITTERAPI_API_KEY not set" }, { status: 503 });
  }

  const supabase = createServiceSupabase();
  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username, followers_total")
    .eq("is_indexed", true)
    .not("twitter_username", "is", null)
    .limit(BATCH_SIZE);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
  );
  let ok = 0;
  let err = 0;
  let totalTweetsInserted = 0;

  for (const profile of list) {
    const userName = String(profile.twitter_username).trim().replace(/^@/, "");
    try {
      const tweets = await fetchXUserTweets(userName, apiKey, MAX_TWEETS_PER_USER);
      await sleep(DELAY_MS);

      const { inserted } = await insertXTweets(supabase, profile.id, tweets);
      totalTweetsInserted += inserted;

      const followersTotal = typeof profile.followers_total === "number" ? profile.followers_total : 0;
      await computeAndUpsertRollups(supabase, profile.id, followersTotal);

      await supabase
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

  return NextResponse.json({
    ok: true,
    processed: list.length,
    success: ok,
    errors: err,
    tweetsInserted: totalTweetsInserted,
  });
}
