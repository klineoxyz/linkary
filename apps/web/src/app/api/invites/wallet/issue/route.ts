/**
 * POST /api/invites/wallet/issue — issue one wallet invite code (up to 5 active).
 * Uses issue_wallet_invite_code RPC. Does not consume reserve; reserve used by replenishment.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

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

  const { data, error } = await supabase.rpc("issue_wallet_invite_code", { p_user_id: user.id });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const result = data as { ok?: boolean; error?: string; id?: string; code?: string; expires_at?: string };
  if (!result?.ok) {
    const status = result.error === "unauthorized" ? 401 : result.error === "invite_frozen" ? 403 : 400;
    return NextResponse.json({ error: result.error ?? "failed" }, { status });
  }
  return NextResponse.json({ ok: true, id: result.id, code: result.code, expires_at: result.expires_at });
}
