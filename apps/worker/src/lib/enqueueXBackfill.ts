/**
 * Enqueue x_backfill_90d jobs for profiles that need them (missing or stale 90d aggregate).
 * Used by the worker after tweet sync so the queue drainer can refresh x_window_aggregates.
 * Railway-only: no dependency on web or Vercel cron.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { isPlanGatingEnabled } from "./planGating.js";
import { planAllowsSelfServe90dBackfill } from "./planKey.js";
import { buildPlanKeyMapForProfileIds, bypassPlanKeyMap } from "./subscriptionPlan.js";

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
const STALE_MAX_AGE_MS = 24 * 60 * 60 * 1000;
const LIMIT = 100;

export type EnqueueResult = { enqueued: number; processed: number };

/**
 * Enqueue x_backfill_90d for profiles with X connected (twitter_username + twitter_connected_at)
 * that lack 90d aggregate or have 90d updated_at older than 24h, and no recent queued/running job.
 */
export async function enqueueXBackfill90d(supabase: SupabaseClient): Promise<EnqueueResult> {
  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, twitter_username")
    .not("twitter_username", "is", null)
    .not("twitter_connected_at", "is", null)
    .limit(LIMIT * 2);

  const list = (profiles ?? [])
    .filter(
      (p: { id: string; twitter_username: string | null }) =>
        p.twitter_username && String(p.twitter_username).trim()
    )
    .map((p: { id: string; twitter_username: string | null }) => ({
      id: p.id,
      username: (p.twitter_username ?? "").toString().trim().replace(/^@/, "").toLowerCase(),
    }))
    .slice(0, LIMIT);

  if (list.length === 0) {
    return { enqueued: 0, processed: 0 };
  }

  const gating = isPlanGatingEnabled();
  const planMap = gating
    ? await buildPlanKeyMapForProfileIds(
        supabase,
        list.map((p) => p.id)
      )
    : bypassPlanKeyMap(list.map((p) => p.id));

  const twoHoursAgo = new Date(Date.now() - TWO_HOURS_MS).toISOString();
  const staleCutoff = new Date(Date.now() - STALE_MAX_AGE_MS).toISOString();
  let enqueued = 0;

  for (const p of list) {
    if (gating && !planAllowsSelfServe90dBackfill(planMap.get(p.id) ?? "free")) {
      continue;
    }
    const { data: row90 } = await supabase
      .from("x_window_aggregates")
      .select("updated_at")
      .eq("owner_type", "profile")
      .eq("owner_id", p.id)
      .eq("window_days", 90)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const updatedAt = (row90 as { updated_at?: string } | null)?.updated_at;
    if (updatedAt && updatedAt >= staleCutoff) continue;

    const { data: recentJob } = await supabase
      .from("analytics_jobs")
      .select("id")
      .eq("owner_type", "profile")
      .eq("owner_id", p.id)
      .eq("job_type", "x_backfill_90d")
      .in("status", ["queued", "running"])
      .gte("created_at", twoHoursAgo)
      .limit(1);

    if ((recentJob ?? []).length > 0) continue;

    const { error } = await supabase.from("analytics_jobs").insert({
      job_type: "x_backfill_90d",
      owner_type: "profile",
      owner_id: p.id,
      run_after: new Date().toISOString(),
      status: "queued",
      payload: { profile_id: p.id, username: p.username },
    });
    if (!error) enqueued += 1;
  }

  return { enqueued, processed: list.length };
}
