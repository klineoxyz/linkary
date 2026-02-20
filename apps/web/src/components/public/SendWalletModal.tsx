"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, Copy, Check } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

type Props = {
  username: string;
  onClose: () => void;
};

export function SendWalletModal({ username, onClose }: Props) {
  const [resolved, setResolved] = useState<{ chain: string; address: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copyDone, setCopyDone] = useState(false);

  useEffect(() => {
    const raw = username.trim().toLowerCase().replace(/^@/, "");
    if (!raw) {
      setLoading(false);
      setError("Invalid username");
      return;
    }
    let cancelled = false;
    fetch(`/api/wallet/resolve?username=${encodeURIComponent(raw)}`)
      .then((res) => res.json().then((j: { address?: string; chain?: string; error?: string }) => ({ ok: res.ok, j })))
      .then((result) => {
        if (cancelled) return;
        const { ok, j } = result;
        if (ok && j.address) {
          setResolved({ chain: j.chain ?? "base", address: j.address });
        } else {
          setError(j.error || "Could not resolve wallet");
        }
      })
      .catch(() => {
        if (!cancelled) setError("Request failed");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [username]);

  const handleCopy = useCallback(() => {
    if (resolved?.address) {
      navigator.clipboard.writeText(resolved.address);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    }
  }, [resolved?.address]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div
        className="rounded-xl border border-border bg-card p-6 max-w-md w-full shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Send to @{username.replace(/^@/, "")}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        {resolved && !loading && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">Send USDC on Base to this address.</p>
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="font-mono text-sm break-all">{resolved.address}</p>
              <button
                type="button"
                onClick={handleCopy}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg font-medium h-9 px-3 text-sm",
                  "border border-border bg-secondary hover:bg-accent"
                )}
              >
                {copyDone ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                {copyDone ? "Copied" : "Copy address"}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">Asset: USDC on Base</p>
          </div>
        )}
      </div>
    </div>
  );
}
