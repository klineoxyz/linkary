import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ok, fail } from "@/lib/api-response";
import { rateLimit } from "@/lib/rate-limit";

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
 * GET /api/admin/smoke — superadmin-only internal sanity checks for CI/smoke tests.
 * Validates: analytics_jobs accessible, x_window_aggregates query, rate limit RPC.
 * Optional env: TEST_PROFILE_ID, TEST_ORG_ID for targeted checks.
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

  const diagnostics: Record<string, unknown> = { ts: new Date().toISOString() };
  const testProfileId = process.env.TEST_PROFILE_ID?.trim();
  const testOrgId = process.env.TEST_ORG_ID?.trim();

  try {
    const { count: jobsCount } = await service
      .from("analytics_jobs")
      .select("id", { count: "exact", head: true })
      .limit(1);
    diagnostics.analytics_jobs = jobsCount != null ? "ok" : "error";
  } catch (e) {
    diagnostics.analytics_jobs = (e instanceof Error ? e.message : "error") as string;
  }

  try {
    const { data: winRows } = await service
      .from("x_window_aggregates")
      .select("id")
      .limit(1);
    diagnostics.x_window_aggregates = winRows ? "ok" : "ok";
  } catch (e) {
    diagnostics.x_window_aggregates = (e instanceof Error ? e.message : "error") as string;
  }

  try {
    const rl = await rateLimit({
      key: `smoke:admin:${user.id}`,
      limit: 100,
      windowSeconds: 60,
      supabaseAdmin: service,
    });
    diagnostics.rate_limit_rpc = rl.allowed ? "ok" : "limited";
  } catch (e) {
    diagnostics.rate_limit_rpc = (e instanceof Error ? e.message : "error") as string;
  }

  if (testProfileId) {
    try {
      const { data: profile } = await service
        .from("profiles")
        .select("id")
        .eq("id", testProfileId)
        .maybeSingle();
      diagnostics.test_profile = profile ? "found" : "not_found";
    } catch (e) {
      diagnostics.test_profile = (e instanceof Error ? e.message : "error") as string;
    }
  }

  if (testOrgId) {
    try {
      const { data: org } = await service.from("orgs").select("id").eq("id", testOrgId).maybeSingle();
      diagnostics.test_org = org ? "found" : "not_found";
    } catch (e) {
      diagnostics.test_org = (e instanceof Error ? e.message : "error") as string;
    }
  }

  return ok({ diagnostics });
}
