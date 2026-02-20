"use client";

import React, { useState } from "react";
import { Copy, Check } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

interface DepositUsdcPanelProps {
  address: string | null;
}

export default function DepositUsdcPanel({ address }: DepositUsdcPanelProps) {
  const [copyDone, setCopyDone] = useState(false);

  const handleCopy = () => {
    if (address) {
      navigator.clipboard.writeText(address);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    }
  };

  if (!address) {
    return (
      <div className="space-y-4">
        <h3 className="text-base font-semibold">Deposit USDC</h3>
        <p className="text-sm text-muted-foreground">Create or link your wallet to see your deposit address.</p>
      </div>
    );
  }

  const qrUrl = typeof address === "string" && address
    ? `https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${encodeURIComponent(address)}`
    : null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Deposit USDC</h3>
      <p className="text-sm text-muted-foreground">
        Send USDC on Base to this address. Use Base network only.
      </p>
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        {qrUrl && (
          <div className="flex justify-center">
            <img src={qrUrl} alt="QR code for wallet address" width={150} height={150} className="rounded-lg" />
          </div>
        )}
        <p className="font-mono text-sm break-all">{address}</p>
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
      <p className="text-xs text-muted-foreground">
        Scan the QR code with a Base-compatible wallet or use a deep link in your wallet app.
      </p>
    </div>
  );
}
