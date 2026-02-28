/**
 * Temporary diagnostic: verify which sources exist for engagement backfill.
 * Run from repo root: pnpm run diagnose-engagement
 * Requires: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (or .env.local).
 */
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

const supabase = createClient(supabaseUrl, serviceKey);

async function main() {
  console.log("--- 1) total profiles ---");
  const { count: totalProfiles } = await supabase.from("profiles").select("id", { count: "exact", head: true });
  console.log("total profiles:", totalProfiles ?? 0);

  console.log("\n--- 2) profiles with twitter_username ---");
  const { data: withTwitter } = await supabase
    .from("profiles")
    .select("id")
    .not("twitter_username", "is", null);
  console.log("profiles with twitter_username:", (withTwitter ?? []).length);

  console.log("\n--- 3) rows in x_analytics_rollups ---");
  const { count: rollupsCount } = await supabase
    .from("x_analytics_rollups")
    .select("profile_id", { count: "exact", head: true });
  console.log("x_analytics_rollups rows:", rollupsCount ?? 0);

  console.log("\n--- 4) rows in x_tweets ---");
  const { count: tweetsCount } = await supabase
    .from("x_tweets")
    .select("id", { count: "exact", head: true });
  console.log("x_tweets rows:", tweetsCount ?? 0);

  console.log("\n--- 5) sample of 5 rollup rows (columns + values) ---");
  const { data: rollupRows } = await supabase
    .from("x_analytics_rollups")
    .select("*")
    .limit(5);
  if (rollupRows && rollupRows.length > 0) {
    console.log(JSON.stringify(rollupRows, null, 2));
  } else {
    console.log("(none)");
  }

  console.log("\n--- 6) sample of 5 tweet rows (metrics fields) ---");
  const { data: tweetRows } = await supabase
    .from("x_tweets")
    .select("profile_id, tweet_id, tweeted_at, like_count, reply_count, repost_count, quote_count")
    .order("tweeted_at", { ascending: false })
    .limit(5);
  if (tweetRows && tweetRows.length > 0) {
    console.log(JSON.stringify(tweetRows, null, 2));
  } else {
    console.log("(none)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
