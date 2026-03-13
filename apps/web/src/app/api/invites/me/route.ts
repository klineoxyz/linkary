/**
 * GET /api/invites/me — current user's 5 individual invite codes (each usable once).
 * Ensures user has 5 one-time codes, then returns them plus invites_used.
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

  await supabase.rpc("ensure_initial_invite_codes", { p_user_id: user.id });

  const { data: wallet, error: walletError } = await supabase.rpc("get_invite_wallet_state", {
    p_user_id: user.id,
  });
  if (walletError) return NextResponse.json({ error: walletError.message }, { status: 500 });
  const state = wallet as { error?: string; codes?: Array<{ id: string; code: string; status: string; expires_at: string | null }> };
  if (state?.error) {
    const status = state.error === "unauthorized" ? 401 : 403;
    return NextResponse.json({ error: state.error }, { status });
  }

  const now = new Date().toISOString();
  const codes = (state.codes ?? []).filter(
    (c) => c.status === "available" && (!c.expires_at || c.expires_at > now)
  );

  const { count, error: countErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  const invites_used = count ?? 0;

  return NextResponse.json({
    codes: codes.map((c) => ({ id: c.id, code: c.code })),
    invites_used,
    max_invites: 5,
  });
}
