import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/x/sync-handle
 * Trusted sync: set profiles.twitter_username from current X connection (social_accounts).
 * Bearer required. Only updates from canonical source; use when user clicks "Sync from X".
 */
export async function POST(request: Request) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ ok: false, code: "UNAUTHORIZED", message: "Missing auth" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user?.id) {
    return NextResponse.json({ ok: false, code: "INVALID_SESSION", message: "Invalid session" }, { status: 401 });
  }

  const { data: socialX } = await supabase
    .from("social_accounts")
    .select("username")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .maybeSingle();

  const handle = (socialX as { username?: string | null })?.username?.toString().trim().replace(/^@/, "");
  if (!handle) {
    return NextResponse.json(
      { ok: false, code: "NO_X_CONNECTION", message: "No active X connection. Connect X first." },
      { status: 400 }
    );
  }

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({
      twitter_username: handle,
      twitter_username_candidate: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateErr) {
    return NextResponse.json(
      { ok: false, code: "UPDATE_FAILED", message: updateErr.message },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true, twitter_username: handle });
}
