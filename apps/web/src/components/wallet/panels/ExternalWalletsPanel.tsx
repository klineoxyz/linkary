"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Plus, Star, Trash2 } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

const CHAINS = ["base", "ethereum", "evm", "solana"] as const;

type ExternalWallet = {
  id: string;
  profile_id: string;
  chain: string;
  address: string;
  label: string | null;
  is_primary: boolean;
  verified_at: string | null;
  created_at: string;
};

function truncateAddress(addr: string): string {
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function validateAddress(chain: string, address: string): boolean {
  const a = address.trim();
  if (chain === "solana") return a.length >= 32 && a.length <= 44;
  return /^0x[a-fA-F0-9]{40}$/.test(a);
}

interface ExternalWalletsPanelProps {
  getToken: () => Promise<string | null>;
  onUpdated: () => void;
}

export default function ExternalWalletsPanel({ getToken, onUpdated }: ExternalWalletsPanelProps) {
  const [list, setList] = useState<ExternalWallet[]>([]);
  const [loading, setLoading] = useState(true);
  const [chain, setChain] = useState<string>("base");
  const [address, setAddress] = useState("");
  const [label, setLabel] = useState("");
  const [setAsPrimary, setSetAsPrimary] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadList = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setLoading(false);
      return;
    }
    const { data, error: e } = await supabase
      .from("external_wallets")
      .select("*")
      .eq("profile_id", uid)
      .order("created_at", { ascending: true });
    if (!e) setList((data ?? []) as ExternalWallet[]);
    setLoading(false);
  }, []);

  useEffect(() => {
    loadList();
  }, [loadList]);

  const handleAdd = async () => {
    setError(null);
    const addr = address.trim();
    if (!addr) {
      setError("Address required");
      return;
    }
    if (!validateAddress(chain, addr)) {
      setError("Invalid address for selected chain");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) {
      setError("Not signed in");
      return;
    }
    setSubmitting(true);
    try {
      const { data: inserted, error: insertError } = await supabase
        .from("external_wallets")
        .insert({
          profile_id: uid,
          chain,
          address: addr,
          label: label.trim() || null,
          is_primary: false,
        })
        .select("id")
        .single();
      if (insertError) {
        if (insertError.code === "23505") setError("This address is already added for this chain");
        else setError(insertError.message);
        return;
      }
      if (setAsPrimary && inserted?.id) {
        const token = await getToken();
        if (token) {
          const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/wallet/external/set-primary`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ externalWalletId: inserted.id }),
          });
          if (!res.ok) setError("Failed to set primary");
        }
      }
      setAddress("");
      setLabel("");
      setSetAsPrimary(false);
      await loadList();
      onUpdated();
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetPrimary = async (id: string) => {
    const token = await getToken();
    if (!token) return;
    setError(null);
    const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/wallet/external/set-primary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ externalWalletId: id }),
    });
    if (res.ok) {
      await loadList();
      onUpdated();
    } else {
      const j = await res.json();
      setError(j.error || "Failed");
    }
  };

  const handleUnsetPrimary = async () => {
    const token = await getToken();
    if (!token) return;
    setError(null);
    const res = await fetch(`${typeof window !== "undefined" ? window.location.origin : ""}/api/wallet/external/set-primary`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ unsetPrimary: true }),
    });
    if (res.ok) {
      await loadList();
      onUpdated();
    } else {
      setError("Failed to unset primary");
    }
  };

  const handleRemove = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;
    const w = list.find((x) => x.id === id);
    const { error: delError } = await supabase
      .from("external_wallets")
      .delete()
      .eq("id", id)
      .eq("profile_id", uid);
    if (!delError) {
      if (w?.is_primary) await handleUnsetPrimary();
      await loadList();
      onUpdated();
    } else {
      setError(delError.message);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-6">
      <h3 className="text-base font-semibold">External wallets</h3>
      <p className="text-sm text-muted-foreground">
        Link external wallet addresses. One can be set as primary for receive and send-by-handle.
      </p>

      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <select
            value={chain}
            onChange={(e) => setChain(e.target.value)}
            className="h-10 rounded-lg border border-border bg-input-background px-3 text-sm"
          >
            {CHAINS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <input
            type="text"
            placeholder="Address"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="h-10 flex-1 min-w-[200px] rounded-lg border border-border bg-input-background px-3 text-sm"
          />
          <input
            type="text"
            placeholder="Label (optional)"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="h-10 w-32 rounded-lg border border-border bg-input-background px-3 text-sm"
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={setAsPrimary}
              onChange={(e) => setSetAsPrimary(e.target.checked)}
            />
            Set as primary
          </label>
          <button
            type="button"
            disabled={submitting}
            onClick={handleAdd}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
              "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
            )}
          >
            <Plus className="h-4 w-4" />
            Add
          </button>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>

      <ul className="space-y-2">
        {list.map((w) => (
          <li
            key={w.id}
            className="flex items-center justify-between rounded-lg border border-border bg-muted/30 px-4 py-3"
          >
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-medium uppercase text-muted-foreground">{w.chain}</span>
              <span className="font-mono text-sm">{truncateAddress(w.address)}</span>
              {w.label && <span className="text-sm text-muted-foreground">{w.label}</span>}
              {w.is_primary && (
                <span className="inline-flex items-center gap-1 rounded bg-primary/20 text-primary px-2 py-0.5 text-xs">
                  <Star className="h-3 w-3" />
                  Primary
                </span>
              )}
              {w.verified_at && (
                <span className="text-xs text-green-600">Verified</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!w.is_primary && (
                <button
                  type="button"
                  onClick={() => handleSetPrimary(w.id)}
                  className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  Set primary
                </button>
              )}
              {w.is_primary && (
                <button
                  type="button"
                  onClick={handleUnsetPrimary}
                  className="rounded-lg border border-border px-2 py-1 text-xs hover:bg-accent"
                >
                  Unset primary
                </button>
              )}
              <button
                type="button"
                onClick={() => handleRemove(w.id)}
                className="rounded-lg border border-border p-1 text-muted-foreground hover:text-destructive"
                aria-label="Remove"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </li>
        ))}
      </ul>
      {list.length === 0 && (
        <p className="text-sm text-muted-foreground">No external wallets added yet.</p>
      )}
    </div>
  );
}
