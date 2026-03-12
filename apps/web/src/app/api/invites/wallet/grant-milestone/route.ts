/**
 * POST /api/invites/wallet/grant-milestone — grant +1 reserve credit for a milestone.
 * One-time (no reference): profile_complete, verified_social, first_activity.
 * Repeatable (reference_id required): invitee_active (attribution id), org_active (org id), package_purchase (purchase/attribution id).
 * Body: { reason, reference_type?, reference_id? }
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const ONE_TIME_REASONS = ["profile_complete", "verified_social", "first_activity"] as const;
const REPEATABLE_REASONS = ["invitee_active", "org_active", "package_purchase"] as const;
const VALID_REASONS = [...ONE_TIME_REASONS, ...REPEATABLE_REASONS] as const;

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

  let body: { reason?: string; reference_type?: string; reference_id?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason || !VALID_REASONS.includes(reason as (typeof VALID_REASONS)[number])) {
    return fail("Invalid or missing reason", 400);
  }
  const isRepeatable = REPEATABLE_REASONS.includes(reason as (typeof REPEATABLE_REASONS)[number]);
  const referenceId = parseUuid(body?.reference_id);
  const referenceType = typeof body?.reference_type === "string" ? body.reference_type.trim() : null;
  if (isRepeatable && !referenceId) {
    return fail("Repeatable reason requires reference_id (e.g. attribution id, org id, purchase id)", 400);
  }
  if (!isRepeatable && (referenceType || referenceId)) {
    return fail("One-time reason must not include reference_type or reference_id", 400);
  }

  const { data, error } = await supabase.rpc("grant_invite_reserve_for_milestone", {
    p_user_id: user.id,
    p_reason: reason,
    p_reference_type: referenceType || null,
    p_reference_id: referenceId || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string; granted?: number; already_granted?: boolean; capped?: boolean };
  if (!result?.ok && result?.error) {
    const status = result.error === "unauthorized" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, granted: result.granted ?? 0, already_granted: result.already_granted, capped: result.capped });
}
