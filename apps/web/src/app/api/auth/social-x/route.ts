import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * GET: Return X connection state from social_accounts using the request's Bearer token.
 * Use this from Integrations so we never rely on the client Supabase instance having the session (RLS uses auth.uid() from the token).
 * Returns { connected, username, provider_user_id }.
 */
export async function GET(request: Request) {
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

  const { data: rows, error } = await supabase
    .from("social_accounts")
    .select("username, provider_user_id, revoked_at, status")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .order("connected_at", { ascending: false })
    .limit(1);

  if (error) {
    return NextResponse.json({ connected: false, username: null, provider_user_id: null });
  }

  const row = Array.isArray(rows) && rows.length ? rows[0] : null;
  const active = row && (row as { status?: string }).status === "connected";
  const r = row as { username?: string | null; provider_user_id?: string | null } | null;

  return NextResponse.json({
    connected: !!active,
    username: active && r?.username ? String(r.username).replace(/^@/, "").trim() : null,
    provider_user_id: active && r?.provider_user_id ? String(r.provider_user_id).trim() : null,
  });
}
