import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/** Comma-separated emails; users in this list can trigger backfill for any profile (e.g. superadmin). */
const SUPERADMIN_EMAILS = (process.env.SUPERADMIN_EMAILS ?? "")
  .split(",")
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

/**
 * GET or POST: Ensure 90d backfill is enqueued (and today's snapshot written) for a profile with X.
 * - No body: current user's profile (call on login / first load).
 * - POST body { profile_id: string }: that profile (allowed only if caller is that user or a superadmin).
 * Idempotent. Minimum requirement: on login or when profile is viewed by someone with right, we start
 * logging and backfill last 90 days so analytics are healthy without user action.
 */
export async function GET(request: NextRequest) {
  return ensureBackfill(request);
}
export async function POST(request: NextRequest) {
  return ensureBackfill(request);
}

async function ensureBackfill(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ enqueued: false, reason: "no_service_key" });
  }

  let targetProfileId: string = user.id;
  try {
    if (request.method === "POST") {
      const body = await request.json().catch(() => ({}));
      const requestedId = typeof body?.profile_id === "string" ? body.profile_id.trim() : null;
      if (requestedId && requestedId !== user.id) {
        const email = (user.email ?? "").toString().toLowerCase();
        const isSuperadmin = SUPERADMIN_EMAILS.length > 0 && SUPERADMIN_EMAILS.includes(email);
        if (!isSuperadmin) {
          return NextResponse.json({ error: "Forbidden", enqueued: false }, { status: 403 });
        }
        targetProfileId = requestedId;
      }
    }
  } catch {
    /* body parse failed; use self */
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  const { data: profile, error: profileError } = await service
    .from("profiles")
    .select("id, twitter_username, followers_total, avg_engagement_rate")
    .eq("id", targetProfileId)
    .maybeSingle();

  if (profileError || !profile?.id) {
    return NextResponse.json({ enqueued: false, reason: "profile_not_found" });
  }

  const username = (profile.twitter_username ?? "").toString().trim().replace(/^@/, "").toLowerCase();
  if (!username) {
    return NextResponse.json({ enqueued: false, reason: "no_x_handle" });
  }

  // Already have 90D window data → no need to enqueue
  const { data: window90Rows } = await service
    .from("x_window_aggregates")
    .select("id")
    .eq("owner_type", "profile")
    .eq("owner_id", profile.id)
    .eq("window_days", 90)
    .limit(1);

  if (window90Rows?.length) {
    return NextResponse.json({ enqueued: false, reason: "already_has_90d" });
  }

  // Already a recent queued or running job for this profile → avoid duplicate
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  const { data: recentJobs } = await service
    .from("analytics_jobs")
    .select("id")
    .eq("owner_type", "profile")
    .eq("owner_id", profile.id)
    .eq("job_type", "x_backfill_90d")
    .in("status", ["queued", "running"])
    .gte("created_at", twoHoursAgo)
    .limit(1);

  if (recentJobs?.length) {
    return NextResponse.json({ enqueued: false, reason: "job_pending" });
  }

  const today = new Date().toISOString().slice(0, 10);
  const followers = typeof profile.followers_total === "number" ? profile.followers_total : null;
  const engagementRate =
    typeof profile.avg_engagement_rate === "number" ? profile.avg_engagement_rate : null;

  // Write today's snapshot immediately so Analytics shows at least current stats before worker runs
  const { error: snapshotErr } = await service.from("x_daily_snapshots").upsert(
    {
      owner_type: "profile",
      owner_id: profile.id,
      day: today,
      followers,
      engagement_rate: engagementRate,
      raw: { from_ensure_backfill: true },
    },
    { onConflict: "owner_type,owner_id,day" }
  );
  if (snapshotErr) {
    // Non-fatal; still enqueue job
  }

  const now = new Date().toISOString();
  const { error: insertErr } = await service.from("analytics_jobs").insert({
    job_type: "x_backfill_90d",
    owner_type: "profile",
    owner_id: profile.id,
    run_after: now,
    status: "queued",
    payload: { username, user_id: profile.id },
  });

  if (insertErr) {
    return NextResponse.json(
      { enqueued: false, reason: "insert_failed", error: insertErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ enqueued: true });
}
