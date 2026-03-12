/**
 * GET /api/invites/wallet — invite wallet state for current user.
 * Returns: active_codes_count, reserve_credits, codes, redeemed, successful_invites, frozen_until.
 * Uses get_invite_wallet_state RPC.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) return fail("Unauthorized", 401);
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) return fail("Invalid session", 401);

  const { data, error } = await supabase.rpc("get_invite_wallet_state", { p_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { error?: string } | Record<string, unknown>;
  if (result?.error) {
    const status = result.error === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: result.error }, { status });
  }
  return NextResponse.json(result);
}
