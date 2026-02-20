import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/x-analytics-server";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

/** POST { externalWalletId: string } Set an external wallet as primary and update wallet_handles. */
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

  let body: { externalWalletId?: string; unsetPrimary?: boolean } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (body.unsetPrimary) {
    await supabase
      .from("external_wallets")
      .update({ is_primary: false })
      .eq("profile_id", user.id);
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("cdp_wallet_address, username")
      .eq("id", user.id)
      .maybeSingle();
    const profile = profileRow as { cdp_wallet_address?: string; username?: string } | null;
    const fallbackAddress = profile?.cdp_wallet_address ?? "";
    const username = profile?.username;
    if (username && fallbackAddress) {
      const service = createServiceSupabase();
      await service.from("wallet_handles").upsert(
        {
          username: username.toLowerCase(),
          profile_id: user.id,
          preferred_chain: "base",
          preferred_address: fallbackAddress,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "username" }
      );
    }
    return NextResponse.json({ ok: true });
  }

  const externalWalletId = body.externalWalletId;
  if (!externalWalletId) {
    return NextResponse.json({ error: "externalWalletId required" }, { status: 400 });
  }

  const { data: ext, error: fetchError } = await supabase
    .from("external_wallets")
    .select("id, profile_id, address, chain")
    .eq("id", externalWalletId)
    .eq("profile_id", user.id)
    .maybeSingle();

  if (fetchError || !ext) {
    return NextResponse.json({ error: "Wallet not found" }, { status: 404 });
  }

  await supabase
    .from("external_wallets")
    .update({ is_primary: false })
    .eq("profile_id", user.id);
  await supabase
    .from("external_wallets")
    .update({ is_primary: true })
    .eq("id", externalWalletId);

  const service = createServiceSupabase();
  const { data: profile } = await service
    .from("profiles")
    .select("username")
    .eq("id", user.id)
    .maybeSingle();
  const username = (profile as { username?: string } | null)?.username;
  if (username) {
    await service.from("wallet_handles").upsert(
      {
        username: username.toLowerCase(),
        profile_id: user.id,
        preferred_chain: (ext as { chain: string }).chain,
        preferred_address: (ext as { address: string }).address,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "username" }
    );
  }

  return NextResponse.json({ ok: true });
}
