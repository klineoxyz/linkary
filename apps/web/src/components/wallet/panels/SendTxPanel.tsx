"use client";

import React, { useState } from "react";
import { Send, ExternalLink } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

function looksLikeAddress(input: string): boolean {
  const t = input.trim();
  if (t.startsWith("0x") && t.length === 42) return true;
  if (t.length >= 32 && t.length <= 44 && !t.startsWith("0x")) return true;
  return false;
}

interface SendTxPanelProps {
  address: string | null;
  getToken: () => Promise<string | null>;
}

export default function SendTxPanel({ address, getToken }: SendTxPanelProps) {
  const [toInput, setToInput] = useState("");
  const [resolvedAddress, setResolvedAddress] = useState<string | null>(null);
  const [resolving, setResolving] = useState(false);
  const [amount, setAmount] = useState("");
  const [asset, setAsset] = useState<"ETH" | "USDC">("ETH");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [explorerUrl, setExplorerUrl] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toAddress = resolvedAddress ?? (looksLikeAddress(toInput) ? toInput.trim() : null);
  const isHandle = toInput.trim() && !looksLikeAddress(toInput.trim());

  const resolveHandle = async (): Promise<string | null> => {
    const raw = toInput.trim().toLowerCase().replace(/^@/, "");
    if (!raw) {
      setResolvedAddress(null);
      return null;
    }
    if (looksLikeAddress(raw)) {
      setResolvedAddress(raw);
      return raw;
    }
    setResolving(true);
    setError(null);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/resolve?username=${encodeURIComponent(raw)}`);
      const j = await res.json();
      if (res.ok && j.address) {
        setResolvedAddress(j.address);
        return j.address;
      }
      setResolvedAddress(null);
      setError(
        "This handle is not registered on Linkary. Double-check the username or send to their wallet address (0x...) instead."
      );
      return null;
    } catch {
      setResolvedAddress(null);
      setError(
        "Could not look up this handle. Double-check the username or send to their wallet address (0x...) instead."
      );
      return null;
    } finally {
      setResolving(false);
    }
  };

  const handleSend = async () => {
    setTxHash(null);
    setExplorerUrl(null);
    let to: string | null = looksLikeAddress(toInput) ? toInput.trim() : resolvedAddress;
    if (!to && toInput.trim()) {
      setError(null);
      to = await resolveHandle();
      if (!to) return;
    } else if (!to) {
      setError("Enter a Linkary handle (@username) or a wallet address");
      return;
    } else {
      setError(null);
    }
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
      const value = amount.trim();
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
        Send to a Linkary handle (e.g. @muazxinthi) or to any wallet address. Signing is done in your wallet or via CDP SDK.
      </p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-muted-foreground mb-1">
            To (Linkary handle or wallet address)
          </label>
          <input
            type="text"
            placeholder="@username or 0x..."
            value={toInput}
            onChange={(e) => {
              setToInput(e.target.value);
              setResolvedAddress(null);
              setError(null);
            }}
            onBlur={() => {
              if (isHandle && toInput.trim()) resolveHandle();
            }}
            className="h-10 w-full rounded-lg border border-border bg-input-background px-3 text-sm"
          />
          {resolving && <p className="text-xs text-muted-foreground mt-1">Resolving handle…</p>}
          {resolvedAddress && isHandle && (
            <p className="text-xs text-muted-foreground mt-1 font-mono">Resolved to: {resolvedAddress.slice(0, 10)}…{resolvedAddress.slice(-8)}</p>
          )}
          {isHandle && !resolvedAddress && !resolving && !error && (
            <p className="text-xs text-muted-foreground mt-1">Not on Linkary? Enter their wallet address (0x...) to send.</p>
          )}
          {error && isHandle && (
            <div className="mt-2 rounded-lg border border-amber-500/50 bg-amber-500/10 px-3 py-2 text-sm text-amber-800">
              {error}
            </div>
          )}
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
        {error && !isHandle && <p className="text-sm text-destructive">{error}</p>}
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
          disabled={sending || !address || (!toAddress && !toInput.trim())}
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
