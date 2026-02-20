"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Copy, Check, Wallet as WalletIcon } from "lucide-react";
import WalletSidebar from "./WalletSidebar";
import LinkProfilePanel from "./panels/LinkProfilePanel";
import MfaPanel from "./panels/MfaPanel";
import SendTxPanel from "./panels/SendTxPanel";
import ExportKeysPanel from "./panels/ExportKeysPanel";
import DepositUsdcPanel from "./panels/DepositUsdcPanel";
import ExternalWalletsPanel from "./panels/ExternalWalletsPanel";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

function useEvmAddressFromCdp(): string | null {
  try {
    const { useEvmAddress } = require("@coinbase/cdp-hooks");
    const evm = useEvmAddress?.();
    return evm?.evmAddress ?? null;
  } catch {
    return null;
  }
}

type WalletStatus = {
  enabled: boolean;
  chain: string;
  address: string | null;
  needsCreate: boolean;
};

type PanelId =
  | "link-profile"
  | "mfa"
  | "send-tx"
  | "export-keys"
  | "deposit-usdc"
  | "external-wallets";

export default function WalletShell() {
  const evmAddress = useEvmAddressFromCdp();
  const [status, setStatus] = useState<WalletStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [panel, setPanel] = useState<PanelId>("link-profile");
  const [copyDone, setCopyDone] = useState(false);

  const getToken = useCallback(async () => {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? null;
  }, []);

  const fetchStatus = useCallback(async () => {
    const token = await getToken();
    if (!token) {
      setStatus(null);
      setLoading(false);
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/wallet/cdp/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const j = await res.json();
      setStatus({
        enabled: !!j.enabled,
        chain: j.chain ?? "base",
        address: j.address ?? null,
        needsCreate: !!j.needsCreate,
      });
    } else {
      setStatus(null);
    }
    setLoading(false);
  }, [getToken]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const handleCreateWallet = useCallback(async () => {
    const token = await getToken();
    if (!token) return;
    const addr = evmAddress;
    if (!addr) {
      return;
    }
    setCreating(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/cdp/get-or-create`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ address: addr }),
      });
      if (res.ok) {
        await fetchStatus();
      }
    } catch {
      /* ignore */
    } finally {
      setCreating(false);
    }
  }, [getToken, fetchStatus, evmAddress]);

  const handleCopyAddress = useCallback(() => {
    if (!status?.address) return;
    navigator.clipboard.writeText(status.address);
    setCopyDone(true);
    setTimeout(() => setCopyDone(false), 2000);
  }, [status?.address]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[320px] text-muted-foreground">
        Loading wallet…
      </div>
    );
  }

  if (status?.needsCreate) {
    return (
      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card backdrop-blur-xl p-6">
          <h2 className="text-lg font-semibold mb-2">Create wallet</h2>
          <p className="text-sm text-muted-foreground mb-4">
            {evmAddress
              ? "Link your Coinbase wallet to your account. It will be used as your embedded wallet."
              : "Sign in with your Coinbase wallet to create your embedded wallet. Use the sign-in option that supports wallet creation, then return here."}
          </p>
          <button
            type="button"
            disabled={creating || !evmAddress}
            onClick={handleCreateWallet}
            className={cn(
              "inline-flex items-center justify-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
              "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
            )}
          >
            <WalletIcon className="h-4 w-4 stroke-[1.75]" />
            {creating ? "Creating…" : evmAddress ? "Link wallet" : "Create wallet"}
          </button>
        </div>
      </div>
    );
  }

  const address = status?.address ?? null;
  const truncated = address
    ? `${address.slice(0, 6)}…${address.slice(-4)}`
    : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="inline-flex items-center rounded-lg border border-border bg-accent px-2.5 py-1 text-xs font-medium">
            {status?.chain ?? "base"}
          </span>
          {address && (
            <span className="font-mono text-sm text-muted-foreground">
              {truncated}
            </span>
          )}
          {address && (
            <button
              type="button"
              onClick={handleCopyAddress}
              className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary hover:bg-accent px-2.5 py-1.5 text-xs font-medium transition-colors"
            >
              {copyDone ? (
                <Check className="h-3.5 w-3.5 text-green-600" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copyDone ? "Copied" : "Copy"}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        <aside className="lg:w-56 shrink-0">
          <WalletSidebar panel={panel} setPanel={setPanel} />
        </aside>
        <main className="flex-1 min-w-0">
          <div className="rounded-xl border border-border bg-card backdrop-blur-xl p-6">
            {panel === "link-profile" && <LinkProfilePanel />}
            {panel === "mfa" && <MfaPanel getToken={getToken} onUpdated={fetchStatus} />}
            {panel === "send-tx" && <SendTxPanel address={address} getToken={getToken} />}
            {panel === "export-keys" && <ExportKeysPanel getToken={getToken} fetchStatus={fetchStatus} />}
            {panel === "deposit-usdc" && <DepositUsdcPanel address={address} />}
            {panel === "external-wallets" && <ExternalWalletsPanel getToken={getToken} onUpdated={fetchStatus} />}
          </div>
        </main>
      </div>
    </div>
  );
}
