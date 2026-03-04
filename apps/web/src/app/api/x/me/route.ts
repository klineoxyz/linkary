/**
 * GET /api/x/me — X connection status. Always 200 when authenticated; never returns tokens.
 * Source of truth: public.x_oauth_tokens (Supabase). CDP is not used for XSpaces connection.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ connected: false, x_user_id: null, username: null, provider: null }, { status: 200 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ connected: false, x_user_id: null, username: null, provider: null }, { status: 200 });
  }

  const { data: row, error } = await supabase
    .from("x_oauth_tokens")
    .select("x_user_id, x_username")
    .eq("profile_id", user.id)
    .eq("provider", "x")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ connected: false, x_user_id: null, username: null, provider: null }, { status: 200 });
  }
  if (!row) {
    return NextResponse.json({
      connected: false,
      x_user_id: null,
      username: null,
      provider: null,
    }, { status: 200 });
  }

  const r = row as { x_user_id: string | null; x_username: string | null };
  return NextResponse.json({
    connected: true,
    x_user_id: r.x_user_id ?? null,
    username: r.x_username ?? null,
    provider: "supabase",
  });
}
