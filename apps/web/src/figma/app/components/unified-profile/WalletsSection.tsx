"use client";

import React, { useEffect, useState } from "react";
import { Wallet } from "lucide-react";
import { Card, Button } from "./ProfileComponents";
import {
  getWalletsByUserId,
  upsertWallet,
  type WalletRow,
} from "@/lib/wallets";
import { supabase } from "@/lib/supabase";

function shortenAddress(chain: string, address: string): string {
  if (chain === "evm" && address.startsWith("0x")) {
    if (address.length <= 14) return address;
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  }
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}...${address.slice(-2)}`;
}

interface WalletsSectionProps {
  profileId: string | undefined;
}

export default function WalletsSection({ profileId }: WalletsSectionProps) {
  const [session, setSession] = useState<{ user: { id: string } } | null>(null);
  const [wallets, setWallets] = useState<WalletRow[]>([]);
  const [loading, setLoading] = useState(!!profileId);
  const [evmInput, setEvmInput] = useState("");
  const [solanaInput, setSolanaInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const isOwner = !!profileId && !!session && session.user.id === profileId;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => setSession(s ?? null));
  }, []);

  useEffect(() => {
    if (!profileId) {
      setWallets([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    getWalletsByUserId(profileId)
      .then(setWallets)
      .catch(() => setWallets([]))
      .finally(() => setLoading(false));
  }, [profileId]);

  const handleSave = async () => {
    if (!session?.user?.id || session.user.id !== profileId) return;
    setMessage(null);
    setSaving(true);
    const errors: string[] = [];
    try {
      if (evmInput.trim()) {
        const r = await upsertWallet(session.user.id, "evm", evmInput.trim());
        if (!r.ok) errors.push(r.error);
      }
      if (solanaInput.trim()) {
        const r = await upsertWallet(session.user.id, "solana", solanaInput.trim());
        if (!r.ok) errors.push(r.error);
      }
      if (errors.length > 0) {
        setMessage({ type: "error", text: errors.join(" ") });
      } else {
        setMessage({ type: "success", text: "Wallets saved." });
        setEvmInput("");
        setSolanaInput("");
        const next = await getWalletsByUserId(profileId!);
        setWallets(next);
      }
    } catch (e) {
      setMessage({ type: "error", text: e instanceof Error ? e.message : "Failed to save." });
    } finally {
      setSaving(false);
    }
  };

  const evmWallet = wallets.find((w) => w.chain === "evm");
  const solanaWallet = wallets.find((w) => w.chain === "solana");

  return (
    <Card>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h2 className="text-lg font-semibold text-neutral-900">
            Wallets (manual for now)
          </h2>
          <span className="text-xs text-neutral-500">Connect wallet (coming soon)</span>
        </div>

        {loading ? (
          <p className="text-sm text-neutral-500">Loading wallets…</p>
        ) : wallets.length === 0 && !isOwner ? (
          <p className="text-sm text-neutral-500">No wallets linked</p>
        ) : (
          <ul className="space-y-2">
            {evmWallet && (
              <li className="text-sm text-neutral-700">
                <span className="font-medium">EVM:</span>{" "}
                {shortenAddress("evm", evmWallet.address)}
              </li>
            )}
            {solanaWallet && (
              <li className="text-sm text-neutral-700">
                <span className="font-medium">Solana:</span>{" "}
                {shortenAddress("solana", solanaWallet.address)}
              </li>
            )}
            {wallets.length === 0 && isOwner && (
              <p className="text-sm text-neutral-500">No wallets linked yet.</p>
            )}
          </ul>
        )}

        {isOwner && (
          <div className="space-y-3 pt-2 border-t border-neutral-200">
            <p className="text-sm font-medium text-neutral-700">Add / Manage wallets</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label className="block text-xs text-neutral-500 mb-1">EVM address</label>
                <input
                  type="text"
                  placeholder="0x..."
                  value={evmInput}
                  onChange={(e) => setEvmInput(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs text-neutral-500 mb-1">Solana address</label>
                <input
                  type="text"
                  placeholder="Base58..."
                  value={solanaInput}
                  onChange={(e) => setSolanaInput(e.target.value)}
                  className="w-full rounded-lg border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={handleSave}
              icon={<Wallet className="h-4 w-4" />}
              className={saving ? "opacity-70 pointer-events-none" : ""}
            >
              {saving ? "Saving…" : "Save"}
            </Button>
            {message && (
              <p
                className={`text-sm ${message.type === "success" ? "text-emerald-600" : "text-red-600"}`}
              >
                {message.text}
              </p>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}
