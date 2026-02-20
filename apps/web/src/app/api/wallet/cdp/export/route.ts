import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/**
 * Export keys: gated behind MFA + explicit confirmation.
 * CDP typically does not expose private key export from server; return supported: false.
 * Never store or log exported material.
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

  const { data: profile } = await supabase
    .from("profiles")
    .select("cdp_mfa_enabled")
    .eq("id", user.id)
    .maybeSingle();

  const mfaEnabled = !!(profile as { cdp_mfa_enabled?: boolean } | null)?.cdp_mfa_enabled;
  if (!mfaEnabled) {
    return NextResponse.json({ error: "MFA must be enabled to export keys", supported: true }, { status: 403 });
  }

  let body: { confirmToken?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body", supported: true }, { status: 400 });
  }
  if (!body.confirmToken) {
    return NextResponse.json({ error: "Explicit confirmation required", supported: true }, { status: 400 });
  }

  // CDP embedded wallet export is not supported from server in this config
  return NextResponse.json({ supported: false });
}
