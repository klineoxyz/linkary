import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const twitterApiKey = process.env.TWITTERAPI_API_KEY;

const COOLDOWN_HOURS = 24;

/** GET or POST: self-only sync from X (profile + today snapshot). 24h cooldown. No tweets. */
export async function GET(request: NextRequest) {
  return handleSync(request);
}
export async function POST(request: NextRequest) {
  return handleSync(request);
}

function parseISODate(s: string | null | undefined): Date | null {
  if (!s || typeof s !== "string") return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function handleSync(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized or missing config" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, username, twitter_username, x_last_profile_sync_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) {
    return NextResponse.json({ error: "Profile not found" }, { status: 404 });
  }

  const userName = (profile.twitter_username || profile.username || "").trim().replace(/^@/, "");
  if (!userName) {
    return NextResponse.json({ error: "No X username to sync. Connect X in Settings → Integrations first." }, { status: 400 });
  }

  // 24h cooldown: self-only, no arbitrary usernames (we use profile.twitter_username only)
  const lastSync = parseISODate(profile.x_last_profile_sync_at);
  if (lastSync) {
    const hoursSince = (Date.now() - lastSync.getTime()) / (1000 * 60 * 60);
    if (hoursSince < COOLDOWN_HOURS) {
      return NextResponse.json({
        ok: true,
        skipped: true,
        lastSyncedAt: profile.x_last_profile_sync_at,
      });
    }
  }

  if (!twitterApiKey) {
    return NextResponse.json(
      { error: "X analytics not configured. Set TWITTERAPI_API_KEY." },
      { status: 503 }
    );
  }

  const apiUrl = `https://api.twitterapi.io/twitter/user/info?userName=${encodeURIComponent(userName)}`;
  const res = await fetch(apiUrl, {
    headers: { "X-API-Key": twitterApiKey },
    next: { revalidate: 0 },
  });
  if (!res.ok) {
    const err = await res.text();
    const { error: updateErr } = await supabase
      .from("profiles")
      .update({
        x_sync_status: "error",
        x_sync_error: err?.slice(0, 500) || res.statusText,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);
    if (updateErr) {
      /* ignore */
    }
    return NextResponse.json(
      { error: "X API error", detail: err },
      { status: res.status === 400 ? 400 : 502 }
    );
  }

  const json = await res.json();
  const data = json?.data;
  if (!data || json?.status === "error") {
    return NextResponse.json(
      { error: json?.msg || "X user not found" },
      { status: 404 }
    );
  }

  const followers = typeof data.followers === "number" ? data.followers : 0;
  const statusesCount = typeof data.statusesCount === "number" ? data.statusesCount : 0;
  const favouritesCount = typeof data.favouritesCount === "number" ? data.favouritesCount : 0;
  const avgEngagement =
    followers > 0
      ? Math.min(100, Math.round(((statusesCount + favouritesCount) / followers) * 1000) / 10)
      : 0;

  const apiUserName = (data.userName || userName).replace(/\s+/g, "-");
  const normalizedUsername = apiUserName.toLowerCase().trim().replace(/^@/, "").replace(/\s+/g, "-");
  const existingHandle = (profile.twitter_username || "").trim();
  const twitterUsername =
    existingHandle && existingHandle.toLowerCase() !== apiUserName.toLowerCase()
      ? existingHandle
      : apiUserName;

  const updates: Record<string, unknown> = {
    display_name: (data.name || "").trim() || null,
    bio: (data.description || "").trim() || null,
    avatar_url: (data.profilePicture || "").trim() || null,
    twitter_username: twitterUsername,
    followers_total: followers,
    avg_engagement_rate: avgEngagement,
    updated_at: new Date().toISOString(),
    x_last_profile_sync_at: new Date().toISOString(),
    x_sync_status: "ok",
    x_sync_error: null,
    is_indexed: true,
  };

  const { error: updateError } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (updateError) {
    const msg = updateError.message ?? "";
    if (msg.includes("unique") || msg.includes("duplicate") || updateError.code === "23505") {
      return NextResponse.json({ error: "USERNAME_TAKEN_VERIFIED" }, { status: 409 });
    }
    return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  if (normalizedUsername && normalizedUsername.length >= 2) {
    const { error: claimError } = await supabase.rpc("claim_username_for_profile", {
      desired_username: normalizedUsername,
    });
    if (claimError) {
      const msg = claimError.message ?? "";
      if (msg.includes("USERNAME_TAKEN_VERIFIED")) {
        return NextResponse.json({ error: "USERNAME_TAKEN_VERIFIED" }, { status: 409 });
      }
      return NextResponse.json(
        { error: msg.includes("USERNAME_TAKEN") ? "USERNAME_TAKEN_VERIFIED" : msg },
        { status: 409 }
      );
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  await supabase.from("analytics_snapshots").upsert(
    {
      profile_id: user.id,
      platform: "x",
      snapshot_date: today,
      followers_total: followers,
      engagement_rate_proxy: avgEngagement,
    },
    { onConflict: "profile_id,platform,snapshot_date" }
  );

  // One-time baseline for "growth since joining" (first insert wins; ignore duplicate)
  const { error: baselineErr } = await supabase.from("profile_analytics_baseline").insert({
    profile_id: user.id,
    platform: "x",
    followers_total: followers,
    engagement_rate_proxy: avgEngagement,
  });
  if (baselineErr && baselineErr.code !== "23505") {
    // log but don't fail the sync
  }

  // Write today into x_daily_snapshots and enqueue backfill so Analytics shows 7D/30D/90D (worker fills history)
  if (supabaseServiceKey) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const today = new Date().toISOString().slice(0, 10);
    await service.from("x_daily_snapshots").upsert(
      {
        owner_type: "profile",
        owner_id: user.id,
        day: today,
        followers: followers,
        engagement_rate: avgEngagement,
        raw: { from_sync: true },
      },
      { onConflict: "owner_type,owner_id,day" }
    );
    const { count } = await service.from("x_daily_snapshots").select("id", { count: "exact", head: true }).eq("owner_type", "profile").eq("owner_id", user.id);
    if ((count ?? 0) < 7) {
      const now = new Date().toISOString();
      await service.from("analytics_jobs").insert({
        job_type: "x_backfill_90d",
        owner_type: "profile",
        owner_id: user.id,
        run_after: now,
        status: "queued",
        payload: { username: normalizedUsername || userName, user_id: user.id },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    lastSyncedAt: updates.x_last_profile_sync_at,
  });
}
