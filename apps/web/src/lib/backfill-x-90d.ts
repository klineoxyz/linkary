/**
 * X 90d backfill: enqueue-only helper (canonical). Real 90d history is built by worker → x_daily_snapshots + x_window_aggregates.
 * runBackfillX90d (writes analytics_snapshots with fake 90d) is DEPRECATED and must not be used by cron/admin.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchXUserInfo } from "@/lib/x-analytics-server";

const CONCURRENCY = 3;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

export type BackfillX90dOptions = {
  limit?: number;
  dryRun?: boolean;
};

export type BackfillX90dResult = {
  ok: boolean;
  dryRun: boolean;
  processed: number;
  success?: number;
  errors?: number;
  wouldProcess?: number;
  profileIds?: string[];
  enqueued?: number;
  message?: string;
};

/**
 * Enqueue x_backfill_90d jobs only (no snapshot writes). Use this from cron and admin.
 * Selects X-connected profiles that lack 90d aggregate and have no recent queued/running job.
 */
export async function enqueueXBackfill90dJobs(
  service: SupabaseClient,
  options: BackfillX90dOptions = {}
): Promise<BackfillX90dResult> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const dryRun = options.dryRun === true;

  const { data: socialRows } = await service
    .from("social_accounts")
    .select("user_id, username")
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .limit(limit * 2);

  const profileList = (socialRows ?? [])
    .filter((r: { user_id: string; username?: string | null }) => r.user_id && (r.username ?? "").toString().trim())
    .map((r: { user_id: string; username?: string | null }) => ({
      id: r.user_id,
      username: (r.username ?? "").toString().trim().replace(/^@/, "").toLowerCase(),
    }))
    .slice(0, limit);

  if (profileList.length === 0) {
    return { ok: true, dryRun, processed: 0, enqueued: 0, message: "No X-connected profiles" };
  }

  const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS).toISOString();
  let enqueued = 0;

  for (const p of profileList) {
    const { data: has90 } = await service
      .from("x_window_aggregates")
      .select("id")
      .eq("owner_type", "profile")
      .eq("owner_id", p.id)
      .eq("window_days", 90)
      .limit(1);
    if ((has90 ?? []).length > 0) continue;

    const { data: recentJob } = await service
      .from("analytics_jobs")
      .select("id")
      .eq("owner_type", "profile")
      .eq("owner_id", p.id)
      .eq("job_type", "x_backfill_90d")
      .in("status", ["queued", "running"])
      .gte("created_at", twoHoursAgo)
      .limit(1);
    if ((recentJob ?? []).length > 0) continue;

    if (dryRun) {
      enqueued += 1;
      continue;
    }

    const { error } = await service.from("analytics_jobs").insert({
      job_type: "x_backfill_90d",
      owner_type: "profile",
      owner_id: p.id,
      run_after: new Date().toISOString(),
      status: "queued",
      payload: { profile_id: p.id, username: p.username },
    });
    if (!error) enqueued += 1;
  }

  return {
    ok: true,
    dryRun,
    processed: profileList.length,
    enqueued,
    wouldProcess: dryRun ? profileList.length : undefined,
    profileIds: dryRun ? profileList.map((x) => x.id) : undefined,
    message: dryRun ? `Would enqueue up to ${profileList.length} jobs` : undefined,
  };
}

/**
 * @deprecated Writes fake 90d (same snapshot repeated) to analytics_snapshots. Do not use. Use worker + enqueueXBackfill90dJobs instead.
 * Throws unless ALLOW_DEPRECATED_BACKFILL === 'true' to prevent accidental use.
 */
export async function runBackfillX90d(
  service: SupabaseClient,
  options: BackfillX90dOptions = {}
): Promise<BackfillX90dResult> {
  if (process.env.ALLOW_DEPRECATED_BACKFILL !== "true") {
    throw new Error(
      "runBackfillX90d is deprecated and disabled. Use enqueueXBackfill90dJobs + worker for real 90d history. Set ALLOW_DEPRECATED_BACKFILL=true to override (not recommended)."
    );
  }
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const dryRun = options.dryRun === true;
  const twitterApiKey = process.env.TWITTERAPI_API_KEY;

  const { data: socialRows } = await service
    .from("social_accounts")
    .select("user_id, username, provider_user_id")
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .limit(limit * 2);

  const { data: legacyProfiles } = await service
    .from("profiles")
    .select("id, twitter_username, twitter_user_id")
    .eq("x_connected", true)
    .limit(limit * 2);

  const profileIds = new Set<string>();
  const handleByProfile: Record<string, string> = {};
  for (const row of socialRows ?? []) {
    const r = row as { user_id: string; username?: string | null };
    profileIds.add(r.user_id);
    const handle = (r.username ?? "").toString().trim().replace(/^@/, "");
    if (handle) handleByProfile[r.user_id] = handle;
  }
  for (const p of legacyProfiles ?? []) {
    const pr = p as { id: string; twitter_username?: string | null };
    profileIds.add(pr.id);
    const handle = (pr.twitter_username ?? "").toString().trim().replace(/^@/, "");
    if (handle && !handleByProfile[pr.id]) handleByProfile[pr.id] = handle;
  }

  const profileList = Array.from(profileIds).slice(0, limit);
  if (profileList.length === 0) {
    return { ok: true, dryRun, processed: 0, message: "No X-connected profiles" };
  }

  if (dryRun) {
    return {
      ok: true,
      dryRun: true,
      processed: 0,
      wouldProcess: profileList.length,
      profileIds: profileList,
    };
  }

  if (!twitterApiKey) {
    throw new Error("TWITTERAPI_API_KEY not set");
  }

  const today = new Date();
  const days: string[] = [];
  for (let i = 89; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0, 10));
  }

  let ok = 0;
  let err = 0;
  const run = async (profileId: string) => {
    const handle = handleByProfile[profileId];
    if (!handle || !twitterApiKey) {
      err += 1;
      return;
    }
    const info = await fetchXUserInfo(handle, twitterApiKey);
    if (!info) {
      err += 1;
      return;
    }
    const followers = typeof info.followers === "number" ? info.followers : 0;
    const statusesCount = typeof info.statusesCount === "number" ? info.statusesCount : 0;
    const favouritesCount = typeof info.favouritesCount === "number" ? info.favouritesCount : 0;
    const engagementRate =
      followers > 0
        ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
        : 0;

    const now = new Date().toISOString();
    for (const day of days) {
      await service.from("analytics_snapshots").upsert(
        {
          owner_type: "profile",
          owner_id: profileId,
          platform: "x",
          day,
          window_days: 1,
          metrics: { followers_total: followers, engagement_rate_proxy: engagementRate },
          updated_at: now,
        },
        { onConflict: "owner_type,owner_id,platform,day,window_days" }
      );
    }
    ok += 1;
  };

  for (let i = 0; i < profileList.length; i += CONCURRENCY) {
    const batch = profileList.slice(i, i + CONCURRENCY);
    await Promise.all(batch.map(run));
    await delay(500);
  }

  return {
    ok: true,
    dryRun: false,
    processed: profileList.length,
    success: ok,
    errors: err,
  };
}
