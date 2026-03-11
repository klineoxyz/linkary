/**
 * POST /api/invites/redeem — redeem invite code for current user. Body: { code: string }
 * Uses Supabase RPC redeem_invite_code. Sets profile.inviter_id on first redemption.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  let body: { code?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const code = typeof body?.code === "string" ? body.code.trim() : "";
  if (!code) return NextResponse.json({ error: "code required" }, { status: 400 });

  const { data, error } = await supabase.rpc("redeem_invite_code", {
    p_code: code,
    p_redeemer_profile_id: user.id,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const result = data as { ok?: boolean; error?: string };
  if (!result?.ok) {
    const msg = result?.error ?? "Invalid or unavailable code";
    const status = msg === "inviter_limit_reached" ? 403 : 400;
    return NextResponse.json({ error: msg }, { status });
  }
  return NextResponse.json({ ok: true });
}
