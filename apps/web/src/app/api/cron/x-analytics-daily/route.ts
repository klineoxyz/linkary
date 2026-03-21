import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase, fetchXUserInfo } from "@/lib/x-analytics-server";
import { buildProfileCompScopesMap } from "@/lib/opsEntitlementsMerge";
import { effectiveBackgroundIngest } from "@/lib/planCompGate";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { buildPlanKeyMapForProfileIds, bypassPlanKeyMap } from "@/lib/subscriptionPlan";

const BATCH_SIZE = 100;
const DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Daily cron: update today's X analytics snapshot for users with active social_accounts X connection.
 * Source of truth: social_accounts (provider x, status connected, revoked_at null).
 * Fetches twitterapi.io user/info and upserts x_daily_snapshots for CURRENT_DATE.
 * Protected by CRON_SECRET.
 */
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

  const listAll = (socialRows ?? []).filter(
    (r: { user_id: string; username?: string | null }) => r.user_id && (r.username ?? "").toString().trim()
  ) as Array<{ user_id: string; username: string | null }>;

  const gating = isPlanGatingEnabled();
  const planMap = gating
    ? await buildPlanKeyMapForProfileIds(
        supabase,
        listAll.map((r) => r.user_id)
      )
    : bypassPlanKeyMap(listAll.map((r) => r.user_id));

  const compMap = gating ? await buildProfileCompScopesMap(supabase, listAll.map((r) => r.user_id)) : new Map();
  const list = listAll.filter((r) => {
    if (!gating) return true;
    return effectiveBackgroundIngest(planMap.get(r.user_id) ?? "free", compMap.get(r.user_id));
  });

  let ok = 0;
  let err = 0;
  const today = new Date().toISOString().slice(0, 10);

  for (const row of list) {
    const userName = (row.username ?? "").toString().trim().replace(/^@/, "");
    if (!userName) {
      err += 1;
      continue;
    }
    const info = await fetchXUserInfo(userName, apiKey);
    await sleep(DELAY_MS);

    if (!info) {
      err += 1;
      continue;
    }

    const currentHandleFromApi = (info.userName ?? "").toString().trim().replace(/^@/, "").toLowerCase();
    const storedHandle = userName.toLowerCase();
    if (currentHandleFromApi && currentHandleFromApi !== storedHandle) {
      await supabase
        .from("social_accounts")
        .update({
          username: currentHandleFromApi,
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", row.user_id)
        .in("provider", ["x", "twitter"]);
    }

    const followers = typeof info.followers === "number" ? info.followers : 0;
    const statusesCount = typeof info.statusesCount === "number" ? info.statusesCount : 0;
    const favouritesCount = typeof info.favouritesCount === "number" ? info.favouritesCount : 0;
    const engagementRate =
      followers > 0
        ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
        : 0;

    const { error: snapshotErr } = await supabase.from("x_daily_snapshots").upsert(
      {
        owner_type: "profile",
        owner_id: row.user_id,
        day: today,
        followers,
        engagement_rate: engagementRate,
        raw: { from_cron_x_analytics_daily: true },
      },
      { onConflict: "owner_type,owner_id,day" }
    );

    if (snapshotErr) {
      err += 1;
      continue;
    }

    await supabase
      .from("profiles")
      .update({
        followers_total: followers,
        avg_engagement_rate: engagementRate,
        updated_at: new Date().toISOString(),
        x_last_profile_sync_at: new Date().toISOString(),
        x_sync_status: "ok",
        x_sync_error: null,
      })
      .eq("id", row.user_id);

    ok += 1;
  }

  return NextResponse.json({
    ok: true,
    processed: list.length,
    success: ok,
    errors: err,
  });
}
