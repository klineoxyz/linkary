/**
 * End-to-end ingestion health check: provider auth + one-profile tweet ingest.
 * Run: pnpm run x:ingest:healthcheck
 * Safe for Railway "Run now". Exit 0 only if provider ok and fetched > 0 and upserted >= 0.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, "../../..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(repoRoot, "apps/web/.env.local") });

import {
  getApiKeyInfo,
  getProviderKeyInfoForLog,
  TWITTERAPI_BASE,
} from "./lib/twitterapi.js";
import { getSupabaseAdmin } from "./lib/supabase.js";
import { ingestXTweets } from "./lib/ingestXTweets.js";

const AUTH_HEADER_NAME = "X-API-Key";
const DEFAULT_HANDLE = "muazxinthi";
const HEALTHCHECK_MAX_TWEETS = 10;

async function runProviderCheck(handle: string): Promise<boolean> {
  const url = TWITTERAPI_BASE + "/twitter/user/info?userName=" + encodeURIComponent(handle);
  const key = getApiKeyInfo().key;
  const res = await fetch(url, { headers: { [AUTH_HEADER_NAME]: key } });
  if (res.status === 401 || res.status === 403) {
    console.error("[X_INGEST_HEALTH] provider fail status=" + res.status);
    return false;
  }
  if (!res.ok) {
    console.error("[X_INGEST_HEALTH] provider fail status=" + res.status);
    return false;
  }
  return true;
}

async function main(): Promise<void> {
  const handle =
    (process.env.X_HEALTHCHECK_HANDLE ?? DEFAULT_HANDLE).trim().replace(/^@/, "").toLowerCase() || DEFAULT_HANDLE;

  const keyInfo = getProviderKeyInfoForLog();
  if (!keyInfo.present) {
    console.error("[X_INGEST_HEALTH] provider fail key_present=false");
    process.exit(1);
  }

  const providerOk = await runProviderCheck(handle);
  if (!providerOk) {
    console.error("[X_INGEST_HEALTH] provider ok=false");
    process.exit(1);
  }
  console.log("[X_INGEST_HEALTH] provider ok=true");

  const supabase = getSupabaseAdmin();
  const { data: profileByHandle } = await supabase
    .from("profiles")
    .select("id, twitter_username, followers_total")
    .eq("twitter_username", handle)
    .limit(1)
    .maybeSingle();
  const { data: profileByAt } = await supabase
    .from("profiles")
    .select("id, twitter_username, followers_total")
    .eq("twitter_username", "@" + handle)
    .limit(1)
    .maybeSingle();

  const profileRow = (profileByHandle ?? profileByAt) as { id: string; twitter_username?: string | null; followers_total?: number | null } | null;
  if (!profileRow?.id) {
    console.error("[X_INGEST_HEALTH] no profile for handle=" + handle + " (set X_HEALTHCHECK_HANDLE or use a connected profile)");
    process.exit(1);
  }

  let fetched = 0;
  let upserted = 0;
  try {
    const result = await ingestXTweets(supabase, {
      profile_id: profileRow.id,
      twitter_username: handle,
      maxTweets: HEALTHCHECK_MAX_TWEETS,
      followers_total: profileRow.followers_total ?? undefined,
    });
    fetched = result.fetched;
    upserted = result.upserted;
  } catch (e) {
    console.error("[X_INGEST_HEALTH] ingest error", e instanceof Error ? e.message : e);
    process.exit(1);
  }

  console.log("[X_INGEST_HEALTH] tweets_fetched=" + fetched + " tweets_upserted=" + upserted);

  if (fetched > 0 && upserted >= 0) {
    console.log("[X_INGEST_HEALTH] ok");
    process.exit(0);
  }
  console.error("[X_INGEST_HEALTH] fail fetched=" + fetched + " upserted=" + upserted);
  process.exit(1);
}

main();
