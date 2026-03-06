/**
 * GET /api/me/payout-preferences — return saved default payout method and wallet (host accept flow).
 * PUT /api/me/payout-preferences — save default; body: { default_payout_method?, wallet_address? }.
 */
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const PAYOUT_METHODS = ["saved_wallet", "linkary_wallet"] as const;
const WALLET_MAX_LEN = 200;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  const { data, error } = await supabase
    .from("host_payout_preferences")
    .select("default_payout_method, wallet_address, updated_at")
    .eq("profile_id", user.id)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data) return NextResponse.json({ default_payout_method: null, wallet_address: null });
  const row = data as { default_payout_method: string; wallet_address: string | null; updated_at: string };
  return NextResponse.json({
    default_payout_method: row.default_payout_method,
    wallet_address: row.wallet_address ?? null,
    updated_at: row.updated_at,
  });
}

export async function PUT(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token || !supabaseUrl || !supabaseAnonKey) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, { global: { headers: { Authorization: `Bearer ${token}` } } });
  const { data: { user } } = await supabase.auth.getUser(token);
  if (!user?.id) return NextResponse.json({ error: "Invalid session" }, { status: 401 });

  let body: { default_payout_method?: string; wallet_address?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const method = typeof body.default_payout_method === "string" && PAYOUT_METHODS.includes(body.default_payout_method as typeof PAYOUT_METHODS[number])
    ? body.default_payout_method
    : "linkary_wallet";
  let walletAddress: string | null = null;
  if (method === "saved_wallet") {
    const trimmed = typeof body.wallet_address === "string" ? body.wallet_address.trim() : "";
    if (!trimmed) return NextResponse.json({ error: "wallet_address required when default_payout_method is saved_wallet" }, { status: 400 });
    walletAddress = trimmed.slice(0, WALLET_MAX_LEN) || null;
  }

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("host_payout_preferences")
    .upsert(
      { profile_id: user.id, default_payout_method: method, wallet_address: walletAddress, updated_at: now },
      { onConflict: "profile_id" }
    )
    .select("default_payout_method, wallet_address, updated_at")
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const row = data as { default_payout_method: string; wallet_address: string | null; updated_at: string };
  return NextResponse.json({
    default_payout_method: row.default_payout_method,
    wallet_address: row.wallet_address ?? null,
    updated_at: row.updated_at,
  });
}
