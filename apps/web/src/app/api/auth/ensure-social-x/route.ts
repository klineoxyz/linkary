import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Ensure social_accounts has an active X row from profile mirror (no identities).
 * Call on Integrations load so legacy users get a stable row; CDP login does not set identities.
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

  const { data: existingSocial } = await supabase
    .from("social_accounts")
    .select("id, revoked_at, status")
    .eq("user_id", user.id)
    .eq("provider", "x")
    .maybeSingle();

  const active = existingSocial && !(existingSocial as { revoked_at?: string | null }).revoked_at && (existingSocial as { status?: string }).status === "connected";
  if (active) {
    return NextResponse.json({ ok: true, connected: true });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitter_username, twitter_user_id, twitter_connected_at")
    .eq("id", user.id)
    .maybeSingle();

  const p = profile as { twitter_username?: string | null; twitter_user_id?: string | null; twitter_connected_at?: string | null } | null;
  const handle = (p?.twitter_username ?? "").toString().trim().replace(/^@/, "");
  const providerUserId = (p?.twitter_user_id ?? "").toString().trim();

  if (!handle && !providerUserId) {
    return NextResponse.json({ ok: true, connected: false });
  }

  const now = new Date().toISOString();
  const { error: upsertError } = await supabase.from("social_accounts").upsert(
    {
      user_id: user.id,
      provider: "x",
      provider_user_id: providerUserId || null,
      username: handle || null,
      connected_at: p?.twitter_connected_at ?? now,
      updated_at: now,
      revoked_at: null,
      status: "connected",
    },
    { onConflict: "user_id,provider" }
  );

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, connected: true });
}
