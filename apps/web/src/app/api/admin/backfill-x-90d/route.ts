import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { enqueueXBackfill90dJobs } from "@/lib/backfill-x-90d";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

function getSuperadminEmailsFromEnv(): string[] {
  return (process.env.SUPERADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

/**
 * POST: Enqueue x_backfill_90d jobs for X-connected profiles (no snapshot writes). Worker builds real 90d.
 * Requires: Authorization Bearer (superadmin) OR X-Admin-Secret header.
 * Query: dryRun=1 to only list; limit=N (default 50, max 200).
 */
export async function POST(request: NextRequest) {
  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const adminSecret = request.headers.get("x-admin-secret");
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;

  let allowed = false;
  if (adminSecret && process.env.ADMIN_BACKFILL_SECRET && adminSecret === process.env.ADMIN_BACKFILL_SECRET) {
    allowed = true;
  }
  if (!allowed && token && supabaseUrl) {
    const anon = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user } } = await anon.auth.getUser(token);
    const email = (user?.email ?? "").toString().toLowerCase();
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const { data: superadminRows } = await service.from("superadmin_emails").select("email").limit(500);
    const fromDb = (superadminRows ?? []).map((r: { email?: string }) => (r.email ?? "").toLowerCase().trim()).filter(Boolean);
    const fromEnv = getSuperadminEmailsFromEnv();
    if (new Set([...fromDb, ...fromEnv]).has(email)) allowed = true;
  }
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const dryRun = request.nextUrl.searchParams.get("dryRun") === "1";
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Math.min(200, Math.max(1, parseInt(limitParam, 10) || 50)) : 50;

  const service = createClient(supabaseUrl, supabaseServiceKey);
  try {
    const result = await enqueueXBackfill90dJobs(service, { limit, dryRun, bypassPlanGate: true });
    return NextResponse.json(result);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Enqueue failed";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
