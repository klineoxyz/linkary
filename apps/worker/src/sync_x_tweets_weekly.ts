/**
 * X tweet ingestion cron: fetch tweets per eligible profile, ingest into x_tweets, refresh rollups, enqueue backfill.
 * Run every 6 hours via Railway (sync:x:tweets:daily or sync:x:tweets:weekly).
 * Eligible: twitter_username non-empty, twitter_connected_at set.
 * Incremental: only sync where x_last_tweets_sync_at is null OR older than 6 hours.
 */
import { config } from "dotenv";
import { fileURLToPath } from "url";
import { resolve, dirname } from "path";
const __dirname = dirname(fileURLToPath(import.meta.url));
// dist/ is inside apps/worker, so repo root is three levels up (same as run_analytics_jobs)
const repoRoot = resolve(__dirname, "../../..");
config({ path: resolve(repoRoot, ".env") });
config({ path: resolve(repoRoot, ".env.local") });
config({ path: resolve(__dirname, "../.env") });
config({ path: resolve(repoRoot, "apps/web/.env.local") });

import { getSupabaseAdmin } from "./lib/supabase.js";
import { isPlanGatingEnabled } from "./lib/planGating.js";
import { planAllowsBackgroundXIngest } from "./lib/planKey.js";
import { buildPlanKeyMapForProfileIds } from "./lib/subscriptionPlan.js";
import { getApiKeyInfo } from "./lib/twitterapi.js";
import { ingestXTweets } from "./lib/ingestXTweets.js";
import { refreshXRollupsForProfile } from "./lib/refreshXRollups.js";
import { enqueueXBackfill90d } from "./lib/enqueueXBackfill.js";
import { sleep } from "./lib/utils.js";

/** Classify provider/sync failure for profiles.x_last_tweets_sync_error. */
function classifySyncError(message: string): string {
  const m = String(message ?? "");
  if (/\bstatus=401\b/.test(m) || /\bstatus=403\b/.test(m)) return "auth_invalid";
  if (/\bstatus=429\b/.test(m)) return "rate_limited";
  if (/\bstatus=5\d{2}\b/.test(m)) return "provider_down";
  return "unknown";
}

const BATCH_SIZE = 100;
const MAX_TWEETS = 50;
const DELAY_MS = 600;
const STALE_HOURS = 6;

function envPresent(name: string): boolean {
  const v = process.env[name];
  return typeof v === "string" && v.trim().length > 0;
}

async function main() {
  console.log("[INGEST] starting X tweet sync (stale threshold=" + STALE_HOURS + "h)");

  try {
    getApiKeyInfo();
  } catch {
    console.error("[INGEST] missing twitterapi key. Set TWITTERAPI_API_KEY (or TWITTERAPI_IO_KEY, TWITTERAPI_KEY, TWITTERAPI_TOKEN).");
    process.exit(1);
  }

  const supabaseUrlPresent =
    envPresent("SUPABASE_URL") || envPresent("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRolePresent =
    envPresent("SUPABASE_SERVICE_ROLE_KEY") ||
    envPresent("SUPABASE_SERVICE_KEY") ||
    envPresent("SERVICE_ROLE_KEY");
  const twitterApiPresent = envPresent("TWITTERAPI_API_KEY");
  console.log(
    "[INGEST] env: SUPABASE_URL=" + supabaseUrlPresent +
    " SERVICE_ROLE=" + serviceRolePresent +
    " TWITTERAPI=" + twitterApiPresent
  );

  const supabase = getSupabaseAdmin();
  const TABLE = "profiles";
  const pastThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000).toISOString();
  console.log("[INGEST] query table=" + TABLE + " stale_before=" + pastThreshold);

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
  const { count: withSyncOk } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .eq("x_sync_status", "ok");
  console.log(
    "[INGEST] sanity total_profiles=" + (totalProfiles ?? "?") +
    " with_handle=" + (withHandle ?? "?") +
    " with_connected_at=" + (withConnectedAt ?? "?") +
    " with_sync_ok=" + (withSyncOk ?? "?")
  );

  // Eligible base: twitter_username and twitter_connected_at set
  const base = () =>
    supabase.from(TABLE).select("id, twitter_username, followers_total").not("twitter_username", "is", null).not("twitter_connected_at", "is", null);

  // Incremental: need sync = never synced OR last sync older than STALE_HOURS (6h)
  const { data: needSyncNull, error: errNull } = await base().is("x_last_tweets_sync_at", null).order("id").limit(BATCH_SIZE);
  const { data: needSyncStale, error: errStale } = await base().lt("x_last_tweets_sync_at", pastThreshold).order("id").limit(BATCH_SIZE);

  if (errNull || errStale) {
    console.error("[WEEKLY] supabase_error null=" + (errNull?.message ?? "ok") + " stale=" + (errStale?.message ?? "ok"));
    process.exit(1);
  }

  const byId = new Map<string, { id: string; twitter_username: string | null; followers_total?: number | null }>();
  for (const p of needSyncNull ?? []) byId.set(p.id, p as { id: string; twitter_username: string | null; followers_total?: number | null });
  for (const p of needSyncStale ?? []) if (!byId.has(p.id)) byId.set(p.id, p as { id: string; twitter_username: string | null; followers_total?: number | null });
  const profiles = Array.from(byId.values());

  const selectedCount = profiles.length;
  const list = profiles.filter(
    (p) => p.twitter_username != null && String(p.twitter_username).trim().length > 0
  );

  let ingestList = list;
  if (isPlanGatingEnabled() && list.length > 0) {
    const planMap = await buildPlanKeyMapForProfileIds(
      supabase,
      list.map((p) => p.id)
    );
    ingestList = list.filter((p) => planAllowsBackgroundXIngest(planMap.get(p.id) ?? "free"));
  }

  // Count skipped due to recent sync (eligible but x_last_tweets_sync_at >= pastThreshold)
  const { count: skippedDueToRecentSync } = await supabase
    .from(TABLE)
    .select("*", { count: "exact", head: true })
    .not("twitter_username", "is", null)
    .not("twitter_connected_at", "is", null)
    .not("x_last_tweets_sync_at", "is", null)
    .gte("x_last_tweets_sync_at", pastThreshold);

  console.log(
    "[INGEST] selected_count=" + selectedCount +
    " skipped_recent_sync=" + (skippedDueToRecentSync ?? "?")
  );

  if (ingestList.length === 0) {
    const enqueueResult = await enqueueXBackfill90d(supabase);
    console.log("[INGEST] no profiles to sync this run. enqueue_backfill enqueued=" + enqueueResult.enqueued + " processed=" + enqueueResult.processed);
    process.exit(0);
  }

  let profilesProcessed = 0;
  let tweetsTotalUpserted = 0;
  let err = 0;

  for (const profile of ingestList) {
    const raw = String(profile.twitter_username ?? "").trim().replace(/^@/, "");
    const handle = raw.toLowerCase();
    if (!handle) continue;
    try {
      const result = await ingestXTweets(supabase, {
        profile_id: profile.id,
        twitter_username: handle,
        maxTweets: MAX_TWEETS,
        followers_total: profile.followers_total ?? undefined,
      });
      profilesProcessed += 1;
      tweetsTotalUpserted += result.upserted;
      console.log("[INGEST] profile_id=" + profile.id + " twitter_username=" + handle + " tweets_inserted=" + result.upserted);

      const { error: updateErr } = await supabase
        .from("profiles")
        .update({
          x_last_tweets_sync_at: new Date().toISOString(),
          x_sync_status: "ok",
          x_sync_error: null,
          x_last_tweets_sync_error: null,
          x_last_tweets_sync_error_at: null,
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
          console.log("[ROLLUP] profile_id=" + profile.id + " updated");
        } catch (e) {
          console.warn("[ROLLUP] profile_id=" + profile.id + " refresh failed:", e);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const classified = classifySyncError(msg);
      if (msg.includes("x_tweets") || msg.includes("relation") || msg.includes("does not exist")) {
        console.error("[INGEST] x_tweets table missing for profile " + profile.id + ". Run migration: supabase/migrations/20260220000000_x_analytics_ingestion.sql");
      }
      await supabase
        .from("profiles")
        .update({
          x_sync_status: "error",
          x_sync_error: msg.slice(0, 500),
          x_last_tweets_sync_error: classified,
          x_last_tweets_sync_error_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      err += 1;
    }
    await sleep(DELAY_MS);
  }

  const enqueueResult = await enqueueXBackfill90d(supabase);
  console.log(
    "[INGEST] done processed=" + profilesProcessed +
    " failures=" + err +
    " tweets_total_upserted=" + tweetsTotalUpserted +
    " enqueue_backfill enqueued=" + enqueueResult.enqueued + " processed=" + enqueueResult.processed
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
