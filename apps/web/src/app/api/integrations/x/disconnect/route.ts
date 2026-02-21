import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST /api/integrations/x/disconnect
 * Revoke active X connection for current user. Clears profile twitter_user_id and twitter_connected_at.
 */
export async function POST(request: Request) {
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

  const now = new Date().toISOString();

  const { error: updateSocialErr } = await supabase
    .from("social_accounts")
    .update({
      revoked_at: now,
      status: "revoked",
      updated_at: now,
    })
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"]);

  if (updateSocialErr) {
    return NextResponse.json({ error: updateSocialErr.message }, { status: 500 });
  }

  await supabase
    .from("profiles")
    .update({
      twitter_user_id: null,
      twitter_connected_at: null,
      twitter_username_candidate: null,
    })
    .eq("id", user.id);

  return NextResponse.json({ ok: true, disconnected: true });
}
