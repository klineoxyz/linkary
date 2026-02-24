/**
 * One-shot debug: fetch tweets for a handle and ingest into public.x_tweets.
 * HANDLE (env or CLI arg); optional PROFILE_ID. If PROFILE_ID missing, looks up profile by twitter_username.
 * Usage: node dist/debug_ingest_x_tweets.js muazxinthi  OR  PROFILE_ID=xxx node dist/debug_ingest_x_tweets.js muazxinthi
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
config({ path: resolve(__dirname, ".env") });

import { getSupabaseAdmin } from "./lib/supabase.js";
import { ingestXTweets } from "./lib/ingestXTweets.js";

const handle = (process.env.HANDLE?.trim() || process.argv[2]?.trim() || "").replace(/^@/, "");
const profileIdFromEnv = process.env.PROFILE_ID?.trim();

if (!handle) {
  console.error("Usage: node dist/debug_ingest_x_tweets.js <handle>  OR  HANDLE=muazxinthi node dist/debug_ingest_x_tweets.js");
  process.exit(1);
}

async function main() {
  const supabase = getSupabaseAdmin();
  let profileId = profileIdFromEnv;

  if (!profileId) {
    const { data: rows, error } = await supabase
      .from("profiles")
      .select("id")
      .ilike("twitter_username", handle)
      .limit(1);
    if (error) {
      console.error("[DEBUG_INGEST] profile lookup failed:", error.message);
      process.exit(1);
    }
    profileId = rows?.[0]?.id;
    if (!profileId) {
      console.error("[DEBUG_INGEST] no profile found for twitter_username=" + handle + ". Set PROFILE_ID=... or ensure profile exists.");
      process.exit(1);
    }
    console.log("[DEBUG_INGEST] resolved profile_id=" + profileId + " for handle=" + handle);
  }

  console.log("[DEBUG_INGEST] starting ingest handle=" + handle + " profile_id=" + profileId);
  const result = await ingestXTweets(supabase, {
    profile_id: profileId,
    twitter_username: handle,
    maxTweets: 50,
  });
  console.log("[DEBUG_INGEST] done fetched=" + result.fetched + " upserted=" + result.upserted + " inserted=" + result.inserted);
  process.exit(0);
}

main().catch((e) => {
  console.error("[DEBUG_INGEST] error", e instanceof Error ? e.message : String(e));
  process.exit(1);
});
