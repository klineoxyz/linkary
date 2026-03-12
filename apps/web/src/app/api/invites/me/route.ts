/**
 * GET /api/invites/me — current user's personal invite code (1 code = 1 invite).
 * Returns: { personal_invite_code, invites_used, invites_remaining (0 or 1) }.
 * If profile has no personal_invite_code, generates one (10-char alphanumeric) and saves.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const INVITES_PER_USER = 1;

function fail(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

function generatePersonalCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
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

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, personal_invite_code")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError || !profile) return NextResponse.json({ error: "Profile not found" }, { status: 404 });

  let code = (profile as { personal_invite_code?: string | null }).personal_invite_code?.trim() || null;
  if (!code) {
    for (let attempt = 0; attempt < 20; attempt++) {
      const candidate = generatePersonalCode();
      const { data: existing } = await supabase
        .from("profiles")
        .select("id")
        .ilike("personal_invite_code", candidate)
        .maybeSingle();
      if (!existing) {
        const { error: updateErr } = await supabase
          .from("profiles")
          .update({ personal_invite_code: candidate })
          .eq("id", user.id)
          .is("personal_invite_code", null);
        if (!updateErr) {
          code = candidate;
          break;
        }
      }
    }
    if (!code) {
      const { data: refetch } = await supabase
        .from("profiles")
        .select("personal_invite_code")
        .eq("id", user.id)
        .maybeSingle();
      code = (refetch as { personal_invite_code?: string | null } | null)?.personal_invite_code?.trim() || null;
    }
    if (!code) return NextResponse.json({ error: "Failed to generate invite code" }, { status: 500 });
  }

  const { count, error: countErr } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true })
    .eq("inviter_id", user.id);
  if (countErr) return NextResponse.json({ error: countErr.message }, { status: 500 });
  const invites_used = count ?? 0;
  const invites_remaining = Math.max(0, INVITES_PER_USER - invites_used);

  return NextResponse.json({
    personal_invite_code: code,
    invites_used,
    invites_remaining,
  });
}
