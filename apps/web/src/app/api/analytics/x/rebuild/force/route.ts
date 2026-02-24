import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/analytics/x/rebuild/force
 * Auth required. Always inserts a new x_backfill_90d job (no idempotency).
 * Dev only: returns 403 in production. No schema dependency on is_admin.
 */
export async function POST(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return fail("FORBIDDEN", "Force rebuild is only available in development", 403);
  }

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
    force: true,
  });
}
