/**
 * GET /api/x/me — verify token and return x_user_id + username from x_oauth_tokens for current user.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ error: "Invalid session" }, { status: 401 });
  }

  const { data: row, error } = await supabase
    .from("x_oauth_tokens")
    .select("x_user_id, x_username")
    .eq("profile_id", user.id)
    .eq("provider", "x")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: "X not connected", connected: false }, { status: 404 });
  }

  const r = row as { x_user_id: string | null; x_username: string | null };
  return NextResponse.json({
    x_user_id: r.x_user_id ?? null,
    username: r.x_username ?? null,
    connected: true,
  });
}
