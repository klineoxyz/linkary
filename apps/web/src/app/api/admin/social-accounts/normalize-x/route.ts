import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;

/**
 * POST /api/admin/social-accounts/normalize-x
 * One-time admin: set provider='x' for any active row with provider='twitter' (canonical provider value).
 * Protected by ADMIN_SECRET or CRON_SECRET.
 */
export async function POST(request: NextRequest) {
  const secret =
    request.headers.get("x-admin-secret") ??
    request.headers.get("x-cron-secret") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const adminSecret = process.env.ADMIN_SECRET ?? process.env.CRON_SECRET;
  if (!adminSecret || secret !== adminSecret) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (!supabaseServiceKey) {
    return NextResponse.json({ error: "Service role not configured" }, { status: 503 });
  }

  const service = createClient(supabaseUrl, supabaseServiceKey);

  const { data: rows, error: selectErr } = await service
    .from("social_accounts")
    .select("id")
    .eq("provider", "twitter");

  if (selectErr) {
    return NextResponse.json({ error: selectErr.message }, { status: 500 });
  }

  const toUpdate = (rows ?? []) as { id: string }[];
  if (toUpdate.length === 0) {
    return NextResponse.json({ ok: true, updated: 0, message: "No rows with provider=twitter" });
  }

  const { error: updateErr } = await service
    .from("social_accounts")
    .update({ provider: "x", updated_at: new Date().toISOString() })
    .eq("provider", "twitter");

  if (updateErr) {
    return NextResponse.json({ error: updateErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, updated: toUpdate.length });
}
