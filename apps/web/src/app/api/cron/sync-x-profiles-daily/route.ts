import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase, fetchXUserInfo } from "@/lib/x-analytics-server";
import { buildProfileCompScopesMap } from "@/lib/opsEntitlementsMerge";
import { effectiveBackgroundIngest } from "@/lib/planCompGate";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { buildPlanKeyMapForProfileIds, bypassPlanKeyMap } from "@/lib/subscriptionPlan";

const BATCH_SIZE = 500;
const DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Daily cron: sync profile snapshot (followers etc.) for is_indexed profiles. Protected by CRON_SECRET. Priority profile IDs in header X-Priority-Profile-Ids (comma-separated) are always included first. */
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

  const supabase = createServiceSupabase();

  const priorityHeader = request.headers.get("x-priority-profile-ids") ?? "";
  const priorityIds = priorityHeader
    ? priorityHeader.split(",").map((s) => s.trim()).filter(Boolean)
    : [];

  let list: Array<{ id: string; twitter_username: string | null; followers_total?: number }> = [];

  if (priorityIds.length > 0) {
    const { data: priorityProfiles } = await supabase
      .from("profiles")
      .select("id, twitter_username, followers_total")
      .in("id", priorityIds)
      .not("twitter_username", "is", null);
    const priorityList = (priorityProfiles ?? []).filter(
      (p: { twitter_username: string | null }) => p.twitter_username && String(p.twitter_username).trim()
    );
    list = priorityList;
  }

  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username, followers_total")
    .eq("is_indexed", true)
    .not("twitter_username", "is", null)
    .limit(BATCH_SIZE);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const batchList = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) =>
      p.twitter_username && String(p.twitter_username).trim()
  );
  const seen = new Set<string>(list.map((p) => p.id));
  for (const p of batchList) {
    if (!seen.has(p.id)) {
      seen.add(p.id);
      list.push(p);
    }
  }

  const gating = isPlanGatingEnabled();
  if (gating && list.length > 0) {
    const ids = list.map((p) => p.id);
    const planMap = await buildPlanKeyMapForProfileIds(supabase, ids);
    const compMap = await buildProfileCompScopesMap(supabase, ids);
    list.splice(
      0,
      list.length,
      ...list.filter((p) => effectiveBackgroundIngest(planMap.get(p.id) ?? "free", compMap.get(p.id)))
    );
  }

  let ok = 0;
  let err = 0;
  const today = new Date().toISOString().slice(0, 10);

  console.log(
    "[sync-x-profiles-daily] profiles_selected=%d first_10_ids=[%s] priority_included=%s",
    list.length,
    list.slice(0, 10).map((p) => p.id).join(","),
    JSON.stringify(priorityIds.map((id: string) => ({ id, included: list.some((p) => p.id === id) })))
  );

  for (const profile of list) {
    const userName = String(profile.twitter_username).trim().replace(/^@/, "");
    const info = await fetchXUserInfo(userName, apiKey);
    await sleep(DELAY_MS);

    if (!info) {
      await supabase
        .from("profiles")
        .update({
          x_sync_status: "error",
          x_sync_error: "User info not found or API error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", profile.id);
      err += 1;
      continue;
    }

    const followers = typeof info.followers === "number" ? info.followers : 0;
    const statusesCount = typeof info.statusesCount === "number" ? info.statusesCount : 0;
    const favouritesCount = typeof info.favouritesCount === "number" ? info.favouritesCount : 0;
    const engagementRate =
      followers > 0
        ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
        : 0;

    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        followers_total: followers,
        avg_engagement_rate: engagementRate,
        updated_at: new Date().toISOString(),
        x_last_profile_sync_at: new Date().toISOString(),
        x_sync_status: "ok",
        x_sync_error: null,
      })
      .eq("id", profile.id);

    if (updateErr) {
      err += 1;
      continue;
    }

    await supabase.from("x_daily_snapshots").upsert(
      {
        owner_type: "profile",
        owner_id: profile.id,
        day: today,
        followers,
        engagement_rate: engagementRate,
        raw: { from_cron_sync_x_profiles_daily: true },
      },
      { onConflict: "owner_type,owner_id,day" }
    );
    ok += 1;
  }

  console.log("[sync-x-profiles-daily] done. processed=%d snapshots_upserted=%d errors=%d", list.length, ok, err);

  return NextResponse.json({
    ok: true,
    processed: list.length,
    snapshots_upserted: ok,
    success: ok,
    errors: err,
  });
}
