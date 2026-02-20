import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/** GET: Return existing CDP wallet if any. POST: Persist client-provided address (create). */
export async function GET(request: Request) {
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
    .select("cdp_wallet_address, cdp_wallet_chain, cdp_wallet_type, username")
    .eq("id", user.id)
    .maybeSingle();

  const address = (profile?.cdp_wallet_address as string) ?? null;
  if (address) {
    return NextResponse.json({
      address,
      chain: (profile?.cdp_wallet_chain as string) ?? "base",
      walletType: (profile?.cdp_wallet_type as string) ?? "smart_account",
    });
  }

  return NextResponse.json({ needsCreate: true, address: null, chain: "base", walletType: null });
}

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

  let body: { address?: string } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const address = typeof body.address === "string" ? body.address.trim() : null;
  if (!address || !/^0x[a-fA-F0-9]{40}$/.test(address)) {
    return NextResponse.json({ error: "Valid EVM address required" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("profiles")
    .select("cdp_wallet_address")
    .eq("id", user.id)
    .maybeSingle();

  if ((existing as { cdp_wallet_address?: string } | null)?.cdp_wallet_address) {
    return NextResponse.json({
      address: (existing as { cdp_wallet_address: string }).cdp_wallet_address,
      chain: "base",
      walletType: "smart_account",
    });
  }

  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      cdp_wallet_address: address,
      cdp_wallet_chain: "base",
      cdp_wallet_type: "smart_account",
      cdp_wallet_created_at: new Date().toISOString(),
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save wallet" }, { status: 500 });
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const username = (profile as { username?: string } | null)?.username;
  if (username) {
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceKey) {
      const service = createClient(supabaseUrl, serviceKey);
      await service.from("wallet_handles").upsert(
        {
          username: username.toLowerCase(),
          profile_id: user.id,
          preferred_chain: "base",
          preferred_address: address,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "username" }
      );
    }
  }

  return NextResponse.json({
    address,
    chain: "base",
    walletType: "smart_account",
  });
}
