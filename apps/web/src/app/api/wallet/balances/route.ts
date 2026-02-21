import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const BASE_RPC = "https://mainnet.base.org";
const USDC_BASE = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

function getToken(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  return authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
}

async function rpc(method: string, params: unknown[]): Promise<unknown> {
  const res = await fetch(BASE_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message || "RPC error");
  return j.result;
}

async function getEthBalance(address: string): Promise<string> {
  const hex = (await rpc("eth_getBalance", [address, "latest"])) as string;
  return hex ? BigInt(hex).toString() : "0";
}

function encodeBalanceOf(address: string): string {
  const addr = address.slice(2).toLowerCase().padStart(64, "0");
  return "0x70a08231" + addr;
}

async function getUsdcBalance(walletAddress: string): Promise<string> {
  const data = encodeBalanceOf(walletAddress);
  const hex = (await rpc("eth_call", [
    { to: USDC_BASE, data },
    "latest",
  ])) as string;
  return hex && hex !== "0x" ? BigInt(hex).toString() : "0";
}

type AssetRow = { symbol: string; balance: string; balanceUsd: number };
type WalletBalance = {
  address: string;
  chain: string;
  label: string | null;
  source: "cdp" | "external";
  assets: AssetRow[];
  totalUsd: number;
};

export async function GET(request: Request) {
  try {
    const token = getToken(request);
    if (!token || !supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json({ error: "Unauthorized", code: "auth" }, { status: 401 });
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user?.id) {
      return NextResponse.json({ error: "Invalid session", code: "auth" }, { status: 401 });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("cdp_wallet_address")
      .eq("id", user.id)
      .maybeSingle();

    const { data: externalRows } = await supabase
      .from("external_wallets")
      .select("chain, address, label")
      .eq("profile_id", user.id);

    const wallets: { address: string; chain: string; label: string | null; source: "cdp" | "external" }[] = [];
    const cdpAddress = (profile as { cdp_wallet_address?: string } | null)?.cdp_wallet_address;
    if (cdpAddress && /^0x[a-fA-F0-9]{40}$/.test(cdpAddress)) {
      wallets.push({ address: cdpAddress, chain: "base", label: "CDP wallet", source: "cdp" });
    }
    for (const row of externalRows ?? []) {
      const r = row as { chain: string; address: string; label: string | null };
      if (r.chain === "base" && /^0x[a-fA-F0-9]{40}$/.test(r.address)) {
        wallets.push({
          address: r.address,
          chain: "base",
          label: r.label,
          source: "external",
        });
      }
    }

    let ethPriceUsd = 0;
    let usdcPriceUsd = 1;
    try {
      const priceRes = await fetch(
        "https://api.coingecko.com/api/v3/simple/price?ids=ethereum,usd-coin&vs_currencies=usd",
        { next: { revalidate: 60 } }
      );
      if (priceRes.ok) {
        const p = (await priceRes.json()) as { ethereum?: { usd?: number }; "usd-coin"?: { usd?: number } };
        ethPriceUsd = p.ethereum?.usd ?? 0;
        usdcPriceUsd = p["usd-coin"]?.usd ?? 1;
      }
    } catch {
      /* use defaults */
    }

    const results: WalletBalance[] = [];
    for (const w of wallets) {
      const assets: AssetRow[] = [];
      try {
        const [ethWei, usdcRaw] = await Promise.all([
          getEthBalance(w.address),
          getUsdcBalance(w.address),
        ]);
        const ethBalance = Number(ethWei) / 1e18;
        const usdcBalance = Number(usdcRaw) / 1e6;
        const ethUsd = ethBalance * ethPriceUsd;
        const usdcUsd = usdcBalance * usdcPriceUsd;
        assets.push({ symbol: "ETH", balance: ethBalance.toFixed(6), balanceUsd: ethUsd });
        assets.push({ symbol: "USDC", balance: usdcBalance.toFixed(2), balanceUsd: usdcUsd });
        const totalUsd = ethUsd + usdcUsd;
        results.push({
          address: w.address,
          chain: w.chain,
          label: w.label,
          source: w.source,
          assets,
          totalUsd,
        });
      } catch {
        results.push({
          address: w.address,
          chain: w.chain,
          label: w.label,
          source: w.source,
          assets: [],
          totalUsd: 0,
        });
      }
    }

    const totalUsd = results.reduce((s, w) => s + w.totalUsd, 0);
    return NextResponse.json({ wallets: results, totalUsd });
  } catch {
    return NextResponse.json({ error: "Unable to load balances", code: "server" }, { status: 500 });
  }
}
