import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/** POST: Persist X (or other) OAuth connection to social_accounts and optionally enqueue backfill. */
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

  let body: { provider: string; provider_token?: string; provider_refresh_token?: string; provider_user_id?: string; username?: string; profile_json?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body?.provider || body.provider !== "x") {
    return NextResponse.json({ error: "Provider must be x" }, { status: 400 });
  }

  const providerUserId = body.provider_user_id ?? null;
  const username = body.username ?? null;
  const now = new Date().toISOString();

  const { error: upsertErr } = await supabase.from("social_accounts").upsert(
    {
      user_id: user.id,
      provider: "x",
      provider_user_id: providerUserId,
      username: username,
      access_token: body.provider_token ?? null,
      refresh_token: body.provider_refresh_token ?? null,
      token_expires_at: null,
      profile_json: body.profile_json ?? null,
      updated_at: now,
      revoked_at: null,
      status: "connected",
    },
    { onConflict: "user_id,provider" }
  );
  if (upsertErr) {
    return NextResponse.json({ error: upsertErr.message }, { status: 500 });
  }

  if (supabaseServiceKey && username) {
    const service = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await service.from("profiles").select("id").eq("id", user.id).maybeSingle();
    if (profile?.id) {
      const { count } = await service.from("x_daily_snapshots").select("id", { count: "exact", head: true }).eq("owner_type", "profile").eq("owner_id", profile.id);
      const shouldBackfill = (count ?? 0) < 7;
      if (shouldBackfill) {
        const { error: jobErr } = await service.from("analytics_jobs").insert({
          job_type: "x_backfill_90d",
          owner_type: "profile",
          owner_id: profile.id,
          run_after: now,
          status: "queued",
          payload: { username: String(username).replace(/^@/, "").toLowerCase(), user_id: user.id },
        });
        if (jobErr) {
          // log but do not fail the request
        }
      }
    }
  }

  return NextResponse.json({ ok: true });
}
