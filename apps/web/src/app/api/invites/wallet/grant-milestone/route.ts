/**
 * POST /api/invites/wallet/grant-milestone — grant +1 reserve credit for a one-time milestone.
 * Body: { reason: 'profile_complete' | 'verified_social' | 'first_activity' | 'invitee_active' | 'org_active' | 'package_purchase' }
 * Calls grant_invite_reserve_for_milestone RPC. Reserve capped at 10.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const VALID_REASONS = ["profile_complete", "verified_social", "first_activity", "invitee_active", "org_active", "package_purchase"] as const;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
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

  let body: { reason?: string };
  try {
    body = await request.json().catch(() => ({}));
  } catch {
    body = {};
  }
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!reason || !VALID_REASONS.includes(reason as typeof VALID_REASONS[number])) {
    return fail("Invalid or missing reason", 400);
  }

  const { data, error } = await supabase.rpc("grant_invite_reserve_for_milestone", {
    p_user_id: user.id,
    p_reason: reason,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string; granted?: number; already_granted?: boolean; capped?: boolean };
  if (!result?.ok && result?.error) {
    const status = result.error === "unauthorized" ? 401 : 400;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json({ ok: true, granted: result.granted ?? 0, already_granted: result.already_granted, capped: result.capped });
}
