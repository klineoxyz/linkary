/**
 * POST /api/invites/record-package-attribution
 * Records a package purchase for an org and applies 90-day invite attribution (grants reserve to inviter).
 * Call from billing/purchase flow when an org completes a package purchase.
 * Body: { org_id: string, purchase_id: string, package_type?: string, amount_cents?: number }
 * Caller must be authenticated; org_id is validated (call from trusted server context or org member).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseUuid(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const hex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return hex.test(s) ? s : null;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  let body: { org_id?: string; purchase_id?: string; package_type?: string; amount_cents?: number };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const orgId = parseUuid(body?.org_id);
  const purchaseId = parseUuid(body?.purchase_id);
  if (!orgId || !purchaseId) return fail("org_id and purchase_id (UUIDs) required", 400);

  const { data: member } = await supabase
    .from("org_members")
    .select("org_id")
    .eq("org_id", orgId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (!member) return fail("Forbidden: not a member of this org", 403);

  const { data, error } = await supabase.rpc("record_invite_package_attribution", {
    p_org_id: orgId,
    p_purchase_id: purchaseId,
    p_package_type: typeof body?.package_type === "string" ? body.package_type : null,
    p_amount_cents: typeof body?.amount_cents === "number" ? body.amount_cents : null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string; attributions_updated?: number; reserve_grants?: number };
  if (!result?.ok && result?.error) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({
    ok: true,
    attributions_updated: result.attributions_updated ?? 0,
    reserve_grants: result.reserve_grants ?? 0,
  });
}
