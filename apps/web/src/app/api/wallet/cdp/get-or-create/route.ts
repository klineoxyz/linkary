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
    const now = new Date().toISOString();
    await supabase.from("cdp_wallets").upsert(
      {
        user_id: user.id,
        wallet_address: address,
        wallet_chain: (profile?.cdp_wallet_chain as string) ?? "base",
        cdp_wallet_id: null,
        updated_at: now,
      },
      { onConflict: "user_id" }
    );
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

  const normalAddress = address.toLowerCase();

  const { data: existing } = await supabase
    .from("profiles")
    .select("cdp_wallet_address")
    .eq("id", user.id)
    .maybeSingle();

  if ((existing as { cdp_wallet_address?: string } | null)?.cdp_wallet_address) {
    const current = String((existing as { cdp_wallet_address: string }).cdp_wallet_address ?? "").trim().toLowerCase();
    if (current === normalAddress) {
      return NextResponse.json({
        address: (existing as { cdp_wallet_address: string }).cdp_wallet_address,
        chain: "base",
        walletType: "smart_account",
      });
    }
  }

  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SERVICE_ROLE_KEY;
  if (serviceKey) {
    const service = createClient(supabaseUrl, serviceKey);
    const { data: other } = await service
      .from("profiles")
      .select("id, cdp_wallet_address")
      .not("cdp_wallet_address", "is", null)
      .neq("id", user.id)
      .limit(100);
    const rows = (other ?? []) as Array<{ id: string; cdp_wallet_address?: string }>;
    const withSameWallet = rows.filter(
      (r) => String(r.cdp_wallet_address ?? "").trim().toLowerCase() === normalAddress
    );
    if (withSameWallet.length > 0) {
      return NextResponse.json(
        {
          error: "This wallet is already linked to another Linkary account. Sign in with that account to use it, or disconnect the wallet there first.",
          code: "WALLET_ALREADY_LINKED",
        },
        { status: 409 }
      );
    }
  }

  const now = new Date().toISOString();
  const { error: updateError } = await supabase
    .from("profiles")
    .update({
      cdp_wallet_address: address,
      cdp_wallet_chain: "base",
      cdp_wallet_type: "smart_account",
      cdp_wallet_created_at: now,
    })
    .eq("id", user.id);

  if (updateError) {
    return NextResponse.json({ error: "Failed to save wallet" }, { status: 500 });
  }

  await supabase.from("cdp_wallets").upsert(
    {
      user_id: user.id,
      wallet_address: address,
      wallet_chain: "base",
      cdp_wallet_id: null,
      updated_at: now,
    },
    { onConflict: "user_id" }
  );

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
