import { NextRequest, NextResponse } from "next/server";
import { createServiceSupabase, fetchXUserInfo } from "@/lib/x-analytics-server";

const BATCH_SIZE = 100;
const DELAY_MS = 400;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/** Daily cron: sync profile snapshot (followers etc.) for all is_indexed profiles. Protected by CRON_SECRET. */
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
  const { data: profiles, error: listError } = await supabase
    .from("profiles")
    .select("id, twitter_username, followers_total")
    .eq("is_indexed", true)
    .not("twitter_username", "is", null)
    .limit(BATCH_SIZE);

  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const list = (profiles ?? []).filter(
    (p: { twitter_username: string | null }) =>
      p.twitter_username && String(p.twitter_username).trim()
  );
  let ok = 0;
  let err = 0;
  const today = new Date().toISOString().slice(0, 10);

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

    await supabase.from("analytics_snapshots").upsert(
      {
        owner_type: "profile",
        owner_id: profile.id,
        platform: "x",
        day: today,
        window_days: 1,
        metrics: { followers_total: followers, engagement_rate_proxy: engagementRate },
        updated_at: new Date().toISOString(),
      },
      { onConflict: "owner_type,owner_id,platform,day,window_days" }
    );
    ok += 1;
  }

  return NextResponse.json({
    ok: true,
    processed: list.length,
    success: ok,
    errors: err,
  });
}
