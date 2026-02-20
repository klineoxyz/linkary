"use client";

import React, { useState } from "react";
import { Send, ExternalLink } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

interface SendTxPanelProps {
  address: string | null;
  getToken: () => Promise<string | null>;
}

export default function SendTxPanel({ address, getToken }: SendTxPanelProps) {
  const [toAddress, setToAddress] = useState("");
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"ETH" | "USDC">("ETH");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSend = async () => {
    setError(null);
    setTxHash(null);
    setExplorerUrl(null);
    setSending(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not signed in");
        return;
      }
      if (!address) {
        setError("No wallet address");
        return;
      }
      const to = toAddress.trim();
      const value = amount.trim();
      if (!to || !/^0x[a-fA-F0-9]{40}$/.test(to)) {
        setError("Enter a valid 0x address");
        return;
      }
      if (!value || Number.isNaN(Number(value)) || Number(value) <= 0) {
        setError("Enter a valid amount");
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/cdp/send-test`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          toAddress: to,
          amount: value,
          asset,
          txHash: null,
          explorerUrl: null,
        }),
      });
      const j = await res.json();
      if (j.txHash && j.explorerUrl) {
        setTxHash(j.txHash);
        setExplorerUrl(j.explorerUrl);
      } else {
        setError(j.error || "Sign and send the transaction using your wallet, then paste the transaction hash and explorer link here. For now, use your wallet extension or CDP SDK to send.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Send test transaction</h3>
      <p className="text-sm text-muted-foreground">
        Send a test transaction. Signing is done in your wallet or via CDP SDK; this form is for reference.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">To address</label>
          <input
            type="text"
            placeholder="0x..."
            value={toAddress}
            onChange={(e) => setToAddress(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Amount</label>
          <input
            type="text"
            placeholder="0.001"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">Asset</label>
          <select
            value={asset}
            onChange={(e) => setAsset(e.target.value as "ETH" | "USDC")}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          >
            <option value="ETH">ETH</option>
            <option value="USDC">USDC</option>
          </select>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        {txHash && explorerUrl && (
          <div className="rounded-lg border border-border bg-muted/30 p-3 text-sm">
            <p className="font-mono text-xs break-all">{txHash}</p>
            <a
              href={explorerUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 mt-2 text-primary hover:underline"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              View on explorer
            </a>
          </div>
        )}
        <button
          type="button"
          disabled={sending || !address}
          onClick={handleSend}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
            "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
          )}
        >
          <Send className="h-4 w-4 stroke-[1.75]" />
          {sending ? "Sending…" : "Send"}
        </button>
      </div>
    </div>
  );
}
