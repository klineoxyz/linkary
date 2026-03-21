/**
 * POST /api/cron/x-analytics-refresh
 * Service-only: for profiles with connected X, ingest recent tweets, update today snapshot, enqueue rollup jobs.
 * Worker drainer then recomputes x_daily_snapshots + x_window_aggregates. Target: at least daily, ideally every 6h.
 * Protected by CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import {
  createServiceSupabase,
  fetchXUserInfo,
  fetchXUserTweets,
  insertXTweets,
  computeAndUpsertRollups,
} from "@/lib/x-analytics-server";
import { enqueueXBackfill90dJobs } from "@/lib/backfill-x-90d";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { planAllowsBackgroundXIngest } from "@/lib/planKey";
import { buildPlanKeyMapForProfileIds, bypassPlanKeyMap } from "@/lib/subscriptionPlan";

const BATCH_SIZE = 50;
const MAX_TWEETS_PER_USER = 50;
const DELAY_MS = 500;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || secret !== cronSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const apiKey = process.env.TWITTERAPI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "TWITTERAPI_API_KEY not set" }, { status: 503 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const supabase = createServiceSupabase();
  const { data: socialRows, error: listError } = await supabase
    .from("social_accounts")
    .select("user_id, username")
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .limit(BATCH_SIZE);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const mapped = (socialRows ?? [])
    .filter(
      (r: { user_id: string; username?: string | null }) =>
        r.user_id && (r.username ?? "").toString().trim()
    )
    .map((r: { user_id: string; username?: string | null }) => ({
      profile_id: r.user_id,
      twitter_username: (r.username ?? "").toString().trim().replace(/^@/, ""),
    }));

  const gating = isPlanGatingEnabled();
  const planMap = gating
    ? await buildPlanKeyMapForProfileIds(
        supabase,
        mapped.map((r) => r.profile_id)
      )
    : bypassPlanKeyMap(mapped.map((r) => r.profile_id));

  const list = mapped
    .filter((r) => {
      if (!gating) return true;
      return planAllowsBackgroundXIngest(planMap.get(r.profile_id) ?? "free");
    })
    .slice(0, BATCH_SIZE);

  if (list.length === 0) {
    const enqueueResult = await enqueueXBackfill90dJobs(supabase, {
      limit: BATCH_SIZE,
      forceRefresh: true,
      staleMaxAgeMs: 24 * 60 * 60 * 1000,
    });
    return NextResponse.json({
      ok: true,
      processed: 0,
      success: 0,
      errors: 0,
      tweetsInserted: 0,
      enqueued: enqueueResult.enqueued ?? 0,
      message: "No X-connected profiles",
    });
  }

  console.log("[x-analytics-refresh] start", { profile_count: list.length });
  let success = 0;
  let errors = 0;
  let totalTweetsInserted = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const { profile_id, twitter_username } of list) {
    try {
      const info = await fetchXUserInfo(twitter_username, apiKey);
      await sleep(200);

      const followers = typeof info?.followers === "number" ? info.followers : 0;
      const statusesCount = typeof info?.statusesCount === "number" ? info.statusesCount : 0;
      const favouritesCount = typeof info?.favouritesCount === "number" ? info.favouritesCount : 0;
      const engagementRate =
        followers > 0
          ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
          : 0;

      const tweets = await fetchXUserTweets(twitter_username, apiKey, MAX_TWEETS_PER_USER);
      await sleep(DELAY_MS);

      const { inserted } = await insertXTweets(supabase, profile_id, tweets);
      totalTweetsInserted += inserted;

      await computeAndUpsertRollups(supabase, profile_id, followers);

      await supabase.from("x_daily_snapshots").upsert(
        {
          owner_type: "profile",
          owner_id: profile_id,
          day: today,
          followers,
          engagement_rate: engagementRate,
          raw: { from_cron_x_analytics_refresh: true },
        },
        { onConflict: "owner_type,owner_id,day" }
      );

      await supabase
        .from("profiles")
        .update({
          followers_total: followers,
          avg_engagement_rate: engagementRate,
          x_last_tweets_sync_at: new Date().toISOString(),
          x_sync_status: "ok",
          x_sync_error: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile_id);

      success += 1;
      console.log("[x-analytics-refresh] success", { profile_id, twitter_username, inserted });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[x-analytics-refresh] error", { profile_id, twitter_username, error: msg });
      await supabase
        .from("profiles")
        .update({
          x_sync_status: "error",
          x_sync_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile_id);
      errors += 1;
    }
  }

  const enqueueResult = await enqueueXBackfill90dJobs(supabase, {
    limit: BATCH_SIZE,
    forceRefresh: true,
    staleMaxAgeMs: 24 * 60 * 60 * 1000,
  });

  return NextResponse.json({
    ok: true,
    processed: list.length,
    success,
    errors,
    tweetsInserted: totalTweetsInserted,
    enqueued: enqueueResult.enqueued ?? 0,
  });
}
