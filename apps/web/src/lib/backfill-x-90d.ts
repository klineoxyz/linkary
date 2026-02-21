/**
 * Shared 90-day X analytics backfill. Used by POST /api/admin/backfill-x-90d and /api/cron/backfill-x-90d-batch.
 * Idempotent: upsert by (owner_type, owner_id, platform, day, window_days).
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchXUserInfo } from "@/lib/x-analytics-server";

const CONCURRENCY = 3;
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

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
  message?: string;
};

export async function runBackfillX90d(
  service: SupabaseClient,
  options: BackfillX90dOptions = {}
): Promise<BackfillX90dResult> {
  const limit = Math.min(Math.max(1, options.limit ?? 50), 200);
  const dryRun = options.dryRun === true;
  const twitterApiKey = process.env.TWITTERAPI_API_KEY;

  const { data: socialRows } = await service
    .from("social_accounts")
    .select("user_id, username, provider_user_id")
    .eq("provider", "x")
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
