"use client";

type DexScreenerEmbedProps = {
  dexscreenerUrl: string;
  tokenSymbol?: string | null;
};

function isValidDexScreenerUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.hostname === "dexscreener.com" || u.hostname.endsWith(".dexscreener.com");
  } catch {
    return false;
  }
}

export function DexScreenerEmbed({ dexscreenerUrl, tokenSymbol }: DexScreenerEmbedProps) {
  if (!dexscreenerUrl?.trim() || !isValidDexScreenerUrl(dexscreenerUrl)) return null;

  const copyLink = () => {
    navigator.clipboard.writeText(dexscreenerUrl);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-lg font-semibold text-foreground">
          Token{tokenSymbol ? ` (${tokenSymbol})` : ""}
        </h3>
        <button
          type="button"
          onClick={copyLink}
          className="rounded-lg border border-border bg-muted px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent"
        >
          Copy chart link
        </button>
      </div>
      <div className="relative aspect-[4/2] w-full overflow-hidden rounded-lg border border-border">
        <iframe
          src={dexscreenerUrl}
          title="DexScreener chart"
          className="absolute inset-0 h-full w-full border-0"
          sandbox="allow-scripts allow-same-origin"
          referrerPolicy="no-referrer"
        />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        Chart via DexScreener. Data is not real-time from Linkary.
      </p>
    </div>
  );
}
