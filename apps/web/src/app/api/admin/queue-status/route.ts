import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function getSuperadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * GET /api/admin/queue-status — analytics job queue stats. Superadmin only.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return fail("UNAUTHORIZED", "Missing auth", 401);
  }

  const anon = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await anon.auth.getUser(token);
  if (userError || !user?.id) {
    return fail("INVALID_SESSION", "Invalid session", 401);
  }

  if (!supabaseServiceKey) {
    return fail("SERVICE_UNAVAILABLE", "Service role not configured", 503);
  }

  const email = (user.email ?? "").toString().toLowerCase();
  const service = createClient(supabaseUrl, supabaseServiceKey);
  const { data: superadminRows } = await service.from("superadmin_emails").select("email").limit(500);
  const fromDb = (superadminRows ?? []).map((r: { email?: string }) => (r.email ?? "").toLowerCase().trim()).filter(Boolean);
  const fromEnv = getSuperadminEmailsFromEnv();
  if (!new Set([...fromDb, ...fromEnv]).has(email)) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  const now = new Date().toISOString();
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [
    { count: queued },
    { count: running },
    { count: failed },
    { count: doneLast24h },
    { data: oldestQueued },
    { data: latestFailure },
  ] = await Promise.all([
    service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "queued"),
    service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "running"),
    service.from("analytics_jobs").select("id", { count: "exact", head: true }).eq("status", "failed"),
    service
      .from("analytics_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "done")
      .gte("updated_at", oneDayAgo),
    service
      .from("analytics_jobs")
      .select("created_at, run_after")
      .eq("status", "queued")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle(),
    service
      .from("analytics_jobs")
      .select("id, owner_id, last_error, updated_at")
      .eq("status", "failed")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const oldestRow = oldestQueued as { created_at?: string; run_after?: string } | null;
  const oldestQueuedAt = oldestRow?.created_at ?? oldestRow?.run_after ?? undefined;
  const latestFailureRow = latestFailure as { id?: string; owner_id?: string; last_error?: string | null; updated_at?: string } | null;

  return ok({
    analytics_jobs: {
      queued: queued ?? 0,
      running: running ?? 0,
      failed: failed ?? 0,
      doneLast24h: doneLast24h ?? 0,
      ...(oldestQueuedAt && { oldestQueuedAt }),
      ...(latestFailureRow && {
        latestFailure: {
          id: latestFailureRow.id,
          owner_id: latestFailureRow.owner_id,
          last_error: latestFailureRow.last_error,
          updated_at: latestFailureRow.updated_at,
        },
      }),
    },
    worker_hint: "Run pnpm --filter worker run run:jobs every 5-10 minutes",
  });
}
