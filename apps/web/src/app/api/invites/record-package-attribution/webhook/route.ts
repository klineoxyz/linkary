/**
 * POST /api/invites/record-package-attribution/webhook
 *
 * Server-to-server hook for package purchase attribution. Call from your billing
 * success path (e.g. Stripe webhook handler) after a successful org purchase.
 * Uses service role; no user session. Protected by LINKARY_BILLING_WEBHOOK_SECRET.
 *
 * Headers: X-Linkary-Billing-Secret: <LINKARY_BILLING_WEBHOOK_SECRET>
 * Body: { org_id: string (UUID), purchase_id: string (UUID), package_type?: string, amount_cents?: number }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
const billingSecret = process.env.LINKARY_BILLING_WEBHOOK_SECRET ?? "";

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function parseUuid(s: unknown): string | null {
  if (typeof s !== "string") return null;
  const hex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return hex.test(s) ? s : null;
}

export async function POST(request: NextRequest) {
  if (!billingSecret) {
    return fail("Billing webhook not configured (LINKARY_BILLING_WEBHOOK_SECRET)", 503);
  }
  const secret = request.headers.get("x-linkary-billing-secret") ?? request.headers.get("X-Linkary-Billing-Secret") ?? "";
  if (secret !== billingSecret) {
    return fail("Unauthorized", 401);
  }

  if (!supabaseUrl || !serviceKey) {
    return fail("Server configuration error", 503);
  }

  let body: { org_id?: string; purchase_id?: string; package_type?: string; amount_cents?: number };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const orgId = parseUuid(body?.org_id);
  const purchaseId = parseUuid(body?.purchase_id);
  if (!orgId || !purchaseId) {
    return fail("org_id and purchase_id (UUIDs) required", 400);
  }

  const supabase = createClient(supabaseUrl, serviceKey);
  const { data, error } = await supabase.rpc("record_invite_package_attribution", {
    p_org_id: orgId,
    p_purchase_id: purchaseId,
    p_package_type: typeof body?.package_type === "string" ? body.package_type : null,
    p_amount_cents: typeof body?.amount_cents === "number" ? body.amount_cents : null,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const result = data as { ok?: boolean; error?: string; attributions_updated?: number; reserve_grants?: number };
  if (!result?.ok && result?.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({
    ok: true,
    attributions_updated: result.attributions_updated ?? 0,
    reserve_grants: result.reserve_grants ?? 0,
  });
}
