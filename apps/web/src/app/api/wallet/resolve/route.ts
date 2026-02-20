import { NextResponse } from "next/server";
import { createServiceSupabase } from "@/lib/x-analytics-server";

/** GET ?username=... Resolve Linkary username to preferred wallet address. */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const username = searchParams.get("username");
  const raw = typeof username === "string" ? username.trim().toLowerCase().replace(/^@/, "") : "";
  if (!raw) {
    return NextResponse.json({ error: "username required" }, { status: 400 });
  }

  const supabase = createServiceSupabase();

  // 1) Fast path: wallet_handles (populated when user has linked wallet or set primary)
  const { data: row, error: whError } = await supabase
    .from("wallet_handles")
    .select("preferred_chain, preferred_address")
    .eq("username", raw)
    .maybeSingle();

  if (!whError && row) {
    return NextResponse.json({
      chain: (row as { preferred_chain: string }).preferred_chain,
      address: (row as { preferred_address: string }).preferred_address,
    });
  }
  if (whError) {
    return NextResponse.json({ error: "Lookup failed" }, { status: 500 });
  }

  // 2) Fallback: resolve by profile (usernames table is source of truth; then profiles)
  let profileId: string | null = null;
  let cdpWalletAddress: string | null = null;

  const { data: unRow } = await supabase
    .from("usernames")
    .select("owner_id")
    .eq("owner_type", "profile")
    .ilike("username", raw)
    .maybeSingle();
  if (unRow) {
    profileId = (unRow as { owner_id: string }).owner_id;
  }
  if (!profileId) {
    const { data: profileRow } = await supabase
      .from("profiles")
      .select("id, cdp_wallet_address")
      .ilike("username", raw)
      .maybeSingle();
    const p = profileRow as { id: string; cdp_wallet_address: string | null } | null;
    if (p) {
      profileId = p.id;
      cdpWalletAddress = p.cdp_wallet_address;
    }
  }
  if (!profileId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (cdpWalletAddress == null) {
    const { data: p2 } = await supabase
      .from("profiles")
      .select("cdp_wallet_address")
      .eq("id", profileId)
      .maybeSingle();
    cdpWalletAddress = (p2 as { cdp_wallet_address: string | null } | null)?.cdp_wallet_address ?? null;
  }
  const profile = { id: profileId, cdp_wallet_address: cdpWalletAddress };

  const { data: primaryWallet } = await supabase
    .from("external_wallets")
    .select("address, chain")
    .eq("profile_id", profile.id)
    .eq("is_primary", true)
    .maybeSingle();

  const preferredAddress = primaryWallet
    ? (primaryWallet as { address: string }).address
    : profile.cdp_wallet_address;
  const preferredChain = primaryWallet
    ? (primaryWallet as { chain: string }).chain
    : "base";

  if (!preferredAddress || preferredAddress.trim() === "") {
    return NextResponse.json({
      error: "This user has not set a receive address yet. They can add one in Settings → Wallet.",
    }, { status: 404 });
  }

  return NextResponse.json({
    chain: preferredChain,
    address: preferredAddress.trim(),
  });
}
