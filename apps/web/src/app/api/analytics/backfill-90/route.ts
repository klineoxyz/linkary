import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";
import { isPlanGatingEnabled } from "@/lib/planGating";
import { buildProfileCompScopesMap } from "@/lib/opsEntitlementsMerge";
import { effectiveSelfServe90d } from "@/lib/planCompGate";
import { resolveEffectivePlanKeyForProfile } from "@/lib/subscriptionPlan";

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
    return fail("UNAUTHORIZED", "Unauthorized", 401);
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  if (!supabaseServiceKey) {
    return ok({ enqueued: false, reason: "no_service_key" });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);
  const rl = await rateLimit({
    key: `analytics/backfill-90:u:${user.id}`,
    limit: 3,
    windowSeconds: 1800,
    supabaseAdmin: service,
  });
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "Too many requests. Please try again later.", 429, { resetAt: rl.resetAt });
  }

  const { data: profile } = await service
    .from("profiles")
    .select("id, analytics_initialized_at")
    .eq("id", user.id)
    .maybeSingle();
  if (!profile?.id) {
    return ok({ enqueued: false, reason: "profile_not_found" });
  }
  if (profile.analytics_initialized_at) {
    return ok({ enqueued: false, reason: "already_initialized" });
  }

  const { data: has90 } = await service
    .from("x_window_aggregates")
    .select("id")
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .eq("window_days", 90)
    .limit(1);
  if ((has90 ?? []).length > 0) {
    return ok({ enqueued: false, reason: "already_has_90d" });
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
    return ok({ enqueued: false, reason: "job_pending" });
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
    return ok({ enqueued: false, reason: "no_x_connection" });
  }

  if (isPlanGatingEnabled()) {
    const plan = await resolveEffectivePlanKeyForProfile(service, user.id);
    const compMap = await buildProfileCompScopesMap(service, [user.id]);
    if (!effectiveSelfServe90d(plan, compMap.get(user.id))) {
      return ok({ enqueued: false, reason: "plan_not_eligible_for_backfill" });
    }
  }

  const { error: insertErr } = await service.from("analytics_jobs").insert({
    job_type: "x_backfill_90d",
    owner_type: "profile",
    owner_id: user.id,
    run_after: new Date().toISOString(),
    status: "queued",
    payload: { profile_id: user.id, username },
  });
  if (insertErr) {
    return fail("INTERNAL", insertErr.message, 500, { enqueued: false });
  }
  return ok({ enqueued: true });
}
