/**
 * POST /api/admin/rep/recompute-all
 * Recompute REP for all profiles. Same auth as backfill.
 * Returns total_processed, updated, min_rep_score, max_rep_score.
 */
import { NextRequest } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";
import { computeRep } from "@/lib/repScore";
import { ok, fail } from "@/lib/api-response";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;

function getSuperadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

async function isAdminAllowed(request: NextRequest): Promise<boolean> {
  const adminSecret = request.headers.get("x-admin-secret");
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (adminSecret && (process.env.ADMIN_BACKFILL_SECRET ?? process.env.ADMIN_SECRET) && adminSecret === (process.env.ADMIN_BACKFILL_SECRET ?? process.env.ADMIN_SECRET)) {
    return true;
  }
  if (token) {
    const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    const { data: { user } } = await anon.auth.getUser(token);
    const email = (user?.email ?? "").toString().toLowerCase();
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
    if (serviceKey) {
      const service = createClient(supabaseUrl, serviceKey);
      const { data: superadminRows } = await service.from("superadmin_emails").select("email").limit(500);
      const fromDb = (superadminRows ?? []).map((r: { email?: string }) => (r.email ?? "").toLowerCase().trim()).filter(Boolean);
      const fromEnv = getSuperadminEmailsFromEnv();
      if (new Set([...fromDb, ...fromEnv]).has(email)) return true;
    }
  }
  return false;
}

export async function POST(request: NextRequest) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (!serviceKey || !supabaseUrl) {
    return fail("SERVICE_UNAVAILABLE", "Service role not configured", 503);
  }
  if (!(await isAdminAllowed(request))) {
    return fail("FORBIDDEN", "Forbidden", 403);
  }

  let serviceSupabase;
  try {
    serviceSupabase = createServiceSupabase();
  } catch {
    return fail("SERVICE_UNAVAILABLE", "Service Supabase unavailable", 503);
  }

  const { data: profileRows, error: fetchError } = await serviceSupabase
    .from("profiles")
    .select("id");

  if (fetchError) return fail("DB_ERROR", fetchError.message, 500);

  const ids = (profileRows ?? []).map((r: { id: string }) => r.id);
  let updated = 0;
  let minRep = 100;
  let maxRep = 0;

  for (const profileId of ids) {
    try {
      const result = await computeRep(profileId, serviceSupabase, { write: true });
      updated += 1;
      const r = result.rep;
      if (r < minRep) minRep = r;
      if (r > maxRep) maxRep = r;
    } catch {
      /* continue */
    }
  }

  if (ids.length === 0) {
    minRep = 0;
    maxRep = 0;
  }

  return ok({
    total_processed: ids.length,
    updated,
    min_rep_score: minRep,
    max_rep_score: maxRep,
  });
}
