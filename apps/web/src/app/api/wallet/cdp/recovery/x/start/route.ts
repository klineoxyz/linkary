import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { randomBytes } from "crypto";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const baseUrl = process.env.NEXT_PUBLIC_SITE_URL ?? process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:3000";

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * POST /api/wallet/cdp/recovery/x/start
 * Bearer required. Creates enrollment state and returns recoveryUrl for client to redirect user.
 * Client should redirect to recoveryUrl; wallet page with ?recovery=x&state= will trigger CDP X recovery flow;
 * CDP redirects to our callback with state + provider_user_id for cross-check.
 */
export async function POST(request: Request) {
  const token = getToken(request);
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

  const { data: socialRow } = await supabase
    .from("social_accounts")
    .select("provider_user_id, username")
    .eq("user_id", user.id)
    .in("provider", ["x", "twitter"])
    .is("revoked_at", null)
    .eq("status", "connected")
    .maybeSingle();

  const providerUserId = (socialRow as { provider_user_id?: string } | null)?.provider_user_id?.toString().trim();
  if (!providerUserId) {
    return NextResponse.json(
      { error: "X account not connected. Connect X in Integrations first." },
      { status: 400 }
    );
  }

  const stateToken = randomBytes(24).toString("hex");
  const { error: insertErr } = await supabase.from("cdp_recovery_enrollment_state").insert({
    state_token: stateToken,
    user_id: user.id,
  });
  if (insertErr) {
    return NextResponse.json({ error: "Failed to create enrollment state" }, { status: 500 });
  }

  const recoveryUrl = `${baseUrl.replace(/\/$/, "")}/settings/wallet?recovery=x&state=${stateToken}`;
  return NextResponse.json({ recoveryUrl, state: stateToken });
}
