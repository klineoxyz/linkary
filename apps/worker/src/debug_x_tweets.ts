/**
 * One-shot debug: fetch recent tweets for a single handle.
 * HANDLE env or first CLI arg. Logs request params, response status, tweet count.
 * Usage: HANDLE=muazxinthi node dist/debug_x_tweets.js  OR  node dist/debug_x_tweets.js muazxinthi
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(__dirname, ".env") });

import { getRecentTweets } from "./lib/twitterapi.js";

const handle = process.env.HANDLE?.trim() || process.argv[2]?.trim() || "";
const normalized = handle.replace(/^@/, "");
if (!normalized) {
  console.error("Usage: HANDLE=muazxinthi node dist/debug_x_tweets.js  OR  node dist/debug_x_tweets.js muazxinthi");
  process.exit(1);
}

console.log("[DEBUG_X_TWEETS] handle=" + normalized + " maxTweets=50");

getRecentTweets(normalized, 50)
  .then((tweets) => {
    console.log("[DEBUG_X_TWEETS] status=ok tweets_count=" + tweets.length);
    process.exit(0);
  })
  .catch((e) => {
    console.error("[DEBUG_X_TWEETS] error", e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
