/**
 * POST /api/invites/redeem — redeem invite code for current user. Body: { code: string }
 * Uses Supabase RPC redeem_invite_code. Input is canonicalized before RPC (trim, strip spaces, uppercase).
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Allowed charset for 10-char invite codes (no 0,O,1,l,I). */
const INVITE_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const INVITE_CODE_LEN = 10;

/**
 * Canonicalize redeem input: trim, remove all spaces, uppercase.
 * Returns null if after normalization the value is invalid (wrong length or bad charset).
 */
function canonicalizeInviteCodeInput(raw: string): string | null {
  const trimmed = (raw ?? "").toString().trim();
  const noSpaces = trimmed.replace(/\s+/g, "");
  const canonical = noSpaces.toUpperCase();
  if (canonical.length !== INVITE_CODE_LEN) return null;
  for (let i = 0; i < canonical.length; i++) {
    if (!INVITE_CODE_CHARS.includes(canonical[i])) return null;
  }
  return canonical;
}

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
  const raw = typeof body?.code === "string" ? body.code : "";
  if (!raw || !raw.trim()) return NextResponse.json({ error: "code required" }, { status: 400 });

  const canonical = canonicalizeInviteCodeInput(raw);
  if (!canonical) {
    return NextResponse.json({ error: "Invalid or unavailable code" }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("redeem_invite_code", {
    p_code: canonical,
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
