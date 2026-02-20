import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/**
 * POST: Ensure social_accounts has an X row when profile has twitter_username
 * (e.g. user logged in with X but persist-social didn't run or failed).
 * Idempotent; safe to call on Integrations page load.
 */
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("twitter_username, twitter_user_id")
    .eq("id", user.id)
    .maybeSingle();
  const username = (profile?.twitter_username as string)?.trim?.()?.replace?.(/^@/, "") || null;
  if (!username) {
    return NextResponse.json({ ok: false, created: false });
  }

  const { data: existing } = await supabase
    .from("social_accounts")
    .select("id")
    .eq("user_id", user.id)
    .eq("provider", "x")
    .maybeSingle();
  if (existing) {
    return NextResponse.json({ ok: true, created: false });
  }

  const now = new Date().toISOString();
  const { error: upsertErr } = await supabase.from("social_accounts").upsert(
    {
      user_id: user.id,
      provider: "x",
      provider_user_id: (profile as { twitter_user_id?: string })?.twitter_user_id ?? null,
      username,
      access_token: null,
      refresh_token: null,
      token_expires_at: null,
      profile_json: null,
      updated_at: now,
      revoked_at: null,
      status: "connected",
    },
    { onConflict: "user_id,provider" }
  );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, created: true });
}
