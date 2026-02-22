import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/analytics/backfill-90
 * Bearer required. Idempotently enqueue x_backfill_90d for current user if not initialized and no recent queued/running job.
 * Returns { ok: true, enqueued: true|false }.
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, error: "Invalid session" }, { status: 401 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "no_service_key" });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile } = await service
    .from("profiles")
    .select("id, analytics_initialized_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.id) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "profile_not_found" });
  }
  if (profile.analytics_initialized_at) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "already_initialized" });
  }

  const { data: has90 } = await service
    .from("x_window_aggregates")
    .select("id")
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .eq("window_days", 90)
    .limit(1);
  if ((has90 ?? []).length > 0) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "already_has_90d" });
  }

  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentJob } = await service
    .from("analytics_jobs")
    .select("id")
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .eq("job_type", "x_backfill_90d")
    .in("status", ["queued", "running"])
    .gte("created_at", twoHoursAgo)
    .limit(1);
  if ((recentJob ?? []).length > 0) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "job_pending" });
  }

  const { data: socialX } = await service
    .from("social_accounts")
    .select("username")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .maybeSingle();
  const username = (socialX as { username?: string | null })?.username?.toString().trim().replace(/^@/, "").toLowerCase();
  if (!username) {
    return NextResponse.json({ ok: true, enqueued: false, reason: "no_x_connection" });
  }

  const { error: insertErr } = await service.from("analytics_jobs").insert({
    job_type: "x_backfill_90d",
    owner_type: "profile",
    owner_id: user.id,
    run_after: new Date().toISOString(),
    status: "queued",
    payload: { username, user_id: user.id },
  });
  if (insertErr) {
    return NextResponse.json({ ok: false, enqueued: false, error: insertErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, enqueued: true });
}
