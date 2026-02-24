import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * GET /api/analytics/x/job
 * Auth required. Returns the latest x_backfill_90d analytics_jobs row for the current user's profile.
 */
export async function GET(request: NextRequest) {
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
    return fail("CONFIG", "Service not configured", 503);
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  const { data: row, error } = await service
    .from("analytics_jobs")
    .select("id, status, run_after, attempts, created_at, updated_at, last_error")
    .eq("owner_type", "profile")
    .eq("owner_id", user.id)
    .eq("job_type", "x_backfill_90d")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return fail("INTERNAL", error.message, 500);
  }

  if (!row) {
    return ok({ job: null });
  }

  const job = row as {
    id: string;
    status: string;
    run_after: string;
    attempts: number;
    created_at: string;
    updated_at: string;
    last_error: string | null;
  } | null;

  return ok({
    job: job
      ? {
          id: job.id,
          status: job.status,
          run_after: job.run_after,
          attempts: job.attempts,
          created_at: job.created_at,
          updated_at: job.updated_at,
          last_error: job.last_error ?? null,
        }
      : null,
  });
}
