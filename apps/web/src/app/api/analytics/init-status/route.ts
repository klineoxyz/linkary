import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * GET /api/analytics/init-status
 * Bearer required. Returns initialized state, 90d aggregate, snapshot count, and current job status.
 */
export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  const service = supabaseServiceKey ? createClient(supabaseUrl, supabaseServiceKey) : supabase;

  const [profileRes, window90Res, snapshotCountRes, jobRes] = await Promise.all([
    service
      .from("profiles")
      .select("analytics_initialized_at, twitter_username, username, x_last_profile_sync_at")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("x_window_aggregates")
      .select("id")
      .eq("owner_type", "profile")
      .eq("owner_id", user.id)
      .eq("window_days", 90)
      .limit(1),
    supabase
      .from("x_daily_snapshots")
      .select("id", { count: "exact", head: true })
      .eq("owner_type", "profile")
      .eq("owner_id", user.id)
      .gte("day", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)),
    service
      .from("analytics_jobs")
      .select("status, attempts, last_error, run_after")
      .eq("owner_type", "profile")
      .eq("owner_id", user.id)
      .eq("job_type", "x_backfill_90d")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const profile = profileRes.data as {
    analytics_initialized_at?: string | null;
    twitter_username?: string | null;
    username?: string | null;
    x_last_profile_sync_at?: string | null;
  } | null;
  const hasXHandle = !!(
    (profile?.twitter_username ?? "").trim() || (profile?.username ?? "").trim()
  );
  const xLastProfileSyncAt = profile?.x_last_profile_sync_at ?? null;
  const has90dAggregate = (window90Res.data ?? []).length > 0;
  const initialized = !!(profile?.analytics_initialized_at ?? null) || has90dAggregate;
  const snapshotDays = snapshotCountRes.count ?? 0;
  const job = jobRes.data as { status?: string; attempts?: number; last_error?: string | null; run_after?: string } | null;
  const jobStatus = job?.status ?? null;
  const lastError = job?.last_error ?? null;
  const buildInProgress = jobStatus === "queued" || jobStatus === "running";
  const refreshFailed = jobStatus === "failed" && !!lastError;
  const staleDays = 7;
  const lastSyncMs = xLastProfileSyncAt ? new Date(xLastProfileSyncAt).getTime() : 0;
  const isStale =
    initialized &&
    hasXHandle &&
    !buildInProgress &&
    lastSyncMs > 0 &&
    Date.now() - lastSyncMs > staleDays * 24 * 60 * 60 * 1000;

  const today = new Date().toISOString().slice(0, 10);
  const { count: todayCount } = await supabase
    .from("x_daily_snapshots")
    .select("id", { count: "exact", head: true })
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .eq("day", today);
  const hasTodaySnapshot = (todayCount ?? 0) > 0;

  /** Single owner-analytics state for UI (real DB facts only). */
  let owner_analytics_state:
    | "no_x_handle"
    | "never_synced"
    | "queued_or_building"
    | "refresh_failed"
    | "partial_data"
    | "ready_stale"
    | "ready_recent";
  if (!hasXHandle) owner_analytics_state = "no_x_handle";
  else if (buildInProgress) owner_analytics_state = "queued_or_building";
  else if (refreshFailed) owner_analytics_state = "refresh_failed";
  else if (!initialized && (snapshotDays > 0 || hasTodaySnapshot)) owner_analytics_state = "partial_data";
  else if (!initialized) owner_analytics_state = "never_synced";
  else if (isStale) owner_analytics_state = "ready_stale";
  else owner_analytics_state = "ready_recent";

  return ok({
    initialized,
    has90dAggregate,
    hasTodaySnapshot,
    snapshotDays,
    analytics_initialized_at: profile?.analytics_initialized_at ?? null,
    has_x_handle: hasXHandle,
    x_last_profile_sync_at: xLastProfileSyncAt,
    build_in_progress: buildInProgress,
    data_stale_hint: isStale,
    owner_analytics_state,
    job: jobStatus ? { status: jobStatus, attempts: job?.attempts ?? 0, last_error: lastError, run_after: job?.run_after ?? null } : null,
  });
}
