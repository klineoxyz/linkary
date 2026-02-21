"use client";

import React, { useCallback, useEffect, useState } from "react";
import { Wallet, ExternalLink } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

type AssetRow = { symbol: string; balance: string; balanceUsd: number };
type WalletBalance = {
  address: string;
  chain: string;
  label: string | null;
  source: "cdp" | "external";
  assets: AssetRow[];
  totalUsd: number;
};

interface BalancePanelProps {
  getToken: () => Promise<string | null>;
}

function truncate(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function BalancePanel({ getToken }: BalancePanelProps) {
  const [data, setData] = useState<{ wallets: WalletBalance[]; totalUsd: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchBalances = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setError("Please sign in to view balances.");
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/balances`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = res.status === 401
          ? "Please sign in again to view balances."
          : (typeof j?.error === "string" ? j.error : "Failed to load balances. Try again.");
        setError(msg);
        setData(null);
        setLoading(false);
        return;
      }
      setData({ wallets: j.wallets ?? [], totalUsd: j.totalUsd ?? 0 });
    } catch {
      setError("Failed to load balances. Check your connection and try again.");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [getToken]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading balances…</p>;
  }
  if (error) {
    return (
      <div className="space-y-2">
        <p className="text-sm text-destructive">{error}</p>
        <button
          type="button"
          onClick={fetchBalances}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-accent"
        >
          Retry
        </button>
      </div>
    );
  }
  if (!data || data.wallets.length === 0) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Balance</h3>
        <p className="text-sm text-muted-foreground">Create or link a wallet to see balances.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Balance</h3>
      <p className="text-sm text-muted-foreground">ETH and USDC on Base. Includes your CDP wallet and linked Base external wallets.</p>
      <div className="rounded-lg border border-border bg-muted/30 p-4">
        <p className="text-xs font-medium text-muted-foreground mb-1">Total (all wallets)</p>
        <p className="text-2xl font-semibold">${data.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
      </div>
      <div className="space-y-4">
        {data.wallets.map((w) => (
          <div key={w.address + w.source} className="rounded-lg border border-border bg-card p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                {w.source === "cdp" ? (
                  <Wallet className="h-4 w-4 shrink-0 text-primary" />
                ) : (
                  <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
                )}
                <span className="font-mono text-sm truncate">{truncate(w.address)}</span>
                {w.label && (
                  <span className="text-xs text-muted-foreground shrink-0">{w.label}</span>
                )}
              </div>
              <span className="text-sm font-medium shrink-0">
                ${w.totalUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <ul className="space-y-1">
              {w.assets.map((a) => (
                <li key={a.symbol} className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{a.symbol}</span>
                  <span>
                    {a.balance} <span className="text-muted-foreground">(${a.balanceUsd.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })})</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
