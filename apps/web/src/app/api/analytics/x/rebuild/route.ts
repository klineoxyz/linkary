import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/analytics/x/rebuild
 * Auth required. Idempotently enqueue x_backfill_90d for current user's profile.
 * If a queued or running job already exists for this profile, returns that job instead of creating another.
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
    return fail("CONFIG", "Service not configured for rebuild", 503);
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);
  const profileId = user.id;

  // Idempotency: if there is already a queued or running x_backfill_90d for this profile, return it
  const { data: existing } = await service
    .from("analytics_jobs")
    .select("id, status, run_after, attempts, created_at")
    .eq("owner_type", "profile")
    .eq("owner_id", profileId)
    .eq("job_type", "x_backfill_90d")
    .in("status", ["queued", "running"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing) {
    const job = existing as { id: string; status: string; run_after: string; attempts: number; created_at: string };
    return ok({
      job: {
        id: job.id,
        status: job.status,
        run_after: job.run_after,
        attempts: job.attempts,
        created_at: job.created_at,
      },
      existing: true,
    });
  }

  const rl = await rateLimit({
    key: `analytics-x-rebuild:u:${profileId}`,
    limit: 3,
    windowSeconds: 3600,
    supabaseAdmin: service,
  });
  if (!rl.allowed) {
    return fail("RATE_LIMITED", "You can request a refresh a few times per hour. Try again later.", 429, { resetAt: rl.resetAt });
  }

  const now = new Date().toISOString();
  const { data: inserted, error: insertErr } = await service
    .from("analytics_jobs")
    .insert({
      job_type: "x_backfill_90d",
      owner_type: "profile",
      owner_id: profileId,
      status: "queued",
      run_after: now,
      attempts: 0,
      payload: { profile_id: profileId },
    })
    .select("id, status, run_after, attempts, created_at")
    .single();

  if (insertErr) {
    return fail("INTERNAL", insertErr.message, 500);
  }

  const job = inserted as { id: string; status: string; run_after: string; attempts: number; created_at: string };
  return ok({
    job: {
      id: job.id,
      status: job.status,
      run_after: job.run_after,
      attempts: job.attempts,
      created_at: job.created_at,
    },
    existing: false,
  });
}
