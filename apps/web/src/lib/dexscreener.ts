/**
 * Dexscreener: parse pair URL and fetch pair data from public API.
 * Used server-side only for project token widget on public profile.
 */

const DEXSCREENER_API = "https://api.dexscreener.com/latest/dex/pairs";

export type TokenPayload = {
  url: string;
  chainId?: string;
  pairAddress?: string;
  baseSymbol?: string;
  quoteSymbol?: string;
  priceUsd?: number;
  priceChangeH24?: number;
  liquidityUsd?: number;
  volumeH24?: number;
  fdv?: number;
  marketCap?: number;
  updatedAt?: string;
};

/**
 * Parse Dexscreener pair URL to extract chainId and pairAddress.
 * e.g. https://dexscreener.com/ethereum/0x... or https://dexscreener.com/solana/...
 */
export function parseDexscreenerUrl(url: string): { chainId: string; pairAddress: string } | null {
  const trimmed = (url || "").trim();
  if (!trimmed.startsWith("https://") || !trimmed.includes("dexscreener.com/")) return null;
  try {
    const u = new URL(trimmed);
    if (!u.hostname.includes("dexscreener.com")) return null;
    const path = u.pathname.replace(/^\/+/, "").replace(/\/+$/, "");
    const parts = path.split("/").filter(Boolean);
    if (parts.length >= 2) {
      const chainId = parts[0];
      const pairAddress = parts[1];
      if (chainId && pairAddress) return { chainId, pairAddress };
    }
  } catch {
    /* ignore */
  }
  return null;
}

/**
 * Fetch pair data from Dexscreener API. Returns null on any failure.
 */
export async function fetchDexscreenerPair(
  chainId: string,
  pairAddress: string,
  originalUrl: string
): Promise<TokenPayload | null> {
  try {
    const res = await fetch(`${DEXSCREENER_API}/${chainId}/${pairAddress}`, {
      next: { revalidate: 60 },
      headers: { Accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      pairs?: Array<{
        chainId?: string;
        pairAddress?: string;
        baseToken?: { symbol?: string };
        quoteToken?: { symbol?: string };
        priceUsd?: string;
        priceChange?: { h24?: number };
        liquidity?: { usd?: number };
        volume?: { h24?: number };
        fdv?: number;
        marketCap?: number;
        pairCreatedAt?: number;
      }>;
    };
    const pair = data?.pairs?.[0];
    if (!pair) return null;

    const priceUsd = pair.priceUsd != null ? parseFloat(String(pair.priceUsd)) : undefined;
    const priceChangeH24 = pair.priceChange?.h24;
    const liquidityUsd = pair.liquidity?.usd;
    const volumeH24 = pair.volume?.h24;
    const fdv = pair.fdv;
    const marketCap = pair.marketCap;

    return {
      url: originalUrl,
      chainId: pair.chainId ?? chainId,
      pairAddress: pair.pairAddress ?? pairAddress,
      baseSymbol: pair.baseToken?.symbol,
      quoteSymbol: pair.quoteToken?.symbol,
      priceUsd: Number.isFinite(priceUsd) ? priceUsd : undefined,
      priceChangeH24: typeof priceChangeH24 === "number" ? priceChangeH24 : undefined,
      liquidityUsd: typeof liquidityUsd === "number" ? liquidityUsd : undefined,
      volumeH24: typeof volumeH24 === "number" ? volumeH24 : undefined,
      fdv: typeof fdv === "number" ? fdv : undefined,
      marketCap: typeof marketCap === "number" ? marketCap : undefined,
    };
  } catch {
    return null;
  }
}
