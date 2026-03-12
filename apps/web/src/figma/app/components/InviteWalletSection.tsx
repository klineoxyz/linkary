"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Gift, Plus, Copy, Loader2, Check, Share2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type WalletCode = { id: string; code: string; status: string; expires_at: string | null; source_reason: string | null; created_at: string };
type WalletRedeemed = { id: string; code: string; redeemed_at: string | null; redeemed_by_user_id: string | null };
type WalletState = {
  active_codes_count: number;
  reserve_credits: number;
  max_active: number;
  max_reserve: number;
  codes: WalletCode[];
  redeemed: WalletRedeemed[];
  successful_invites: number;
  frozen_until: string | null;
};

export default function InviteWalletSection() {
  const [state, setState] = useState<WalletState | null>(null);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchWallet = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/invites/wallet`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && !json.error) setState(json as WalletState);
  }, []);

  useEffect(() => {
    fetchWallet();
  }, [fetchWallet]);

  const handleIssue = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setIssuing(true);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/invites/wallet/issue`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    setIssuing(false);
    if (res.ok && json.ok) await fetchWallet();
  };

  const copyCode = (code: string, id: string) => {
    if (typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 flex items-center justify-center min-h-[120px]">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state) {
    return (
      <div className="rounded-xl border border-border bg-card p-4 space-y-3">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary shrink-0" />
          <h2 className="text-lg font-semibold text-foreground">Invite wallet</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Additional one-time invite codes are loaded here when available. Use your invite code above to share with others.
        </p>
      </div>
    );
  }

  const activeCodes = (state.codes ?? []).filter((c) => c.status === "available" && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const canIssue = state.active_codes_count < (state.max_active ?? 5) && !state.frozen_until;

  return (
    <div className="space-y-6">
      {/* Invite wallet: stats + issue */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Invite wallet</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">Active codes</p>
            <p className="font-medium text-foreground">{state.active_codes_count} / {state.max_active ?? 5}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Reserve credits</p>
            <p className="font-medium text-foreground">{Math.min(state.reserve_credits ?? 0, state.max_reserve ?? 10)} / {state.max_reserve ?? 10}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Redeemed</p>
            <p className="font-medium text-foreground">{(state.redeemed ?? []).length}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Successful invites</p>
            <p className="font-medium text-foreground">{state.successful_invites ?? 0}</p>
          </div>
        </div>
        {state.frozen_until && (
          <p className="text-sm text-amber-600">Invites frozen until {new Date(state.frozen_until).toLocaleDateString()}</p>
        )}
        {canIssue && (
          <button
            type="button"
            onClick={handleIssue}
            disabled={issuing}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium disabled:opacity-50"
          >
            {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            {issuing ? "Issuing…" : "Issue new code"}
          </button>
        )}
      </div>

      {/* Invite codes to share — always visible; new codes appear here */}
      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Share2 className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold text-foreground">Invite codes to share</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Share one code per person. When you get new codes (from &quot;Issue new code&quot; or from reserve), they appear here.
        </p>
        {activeCodes.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border bg-muted/30 p-6 text-center">
            <p className="text-sm text-muted-foreground mb-3">No invite codes to share right now.</p>
            <p className="text-xs text-muted-foreground mb-4">
              Use <strong>Issue new code</strong> above to get one, or you may receive more automatically when you have reserve credits.
            </p>
            {canIssue && (
              <button
                type="button"
                onClick={handleIssue}
                disabled={issuing}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 disabled:opacity-50"
              >
                {issuing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                {issuing ? "Issuing…" : "Issue new code"}
              </button>
            )}
          </div>
        ) : (
          <ul className="space-y-3">
            {activeCodes.slice(0, 10).map((c) => (
              <li
                key={c.id}
                className="flex flex-wrap items-center gap-2 p-3 rounded-lg border border-border bg-background hover:bg-muted/50"
              >
                <code className="px-3 py-1.5 rounded bg-muted text-sm font-mono font-medium">{c.code}</code>
                <button
                  type="button"
                  onClick={() => copyCode(c.code, c.id)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-border text-xs font-medium text-foreground hover:bg-muted"
                >
                  {copiedId === c.id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                  {copiedId === c.id ? "Copied" : "Copy"}
                </button>
                {c.expires_at && (
                  <span className="text-xs text-muted-foreground">Expires {new Date(c.expires_at).toLocaleDateString()}</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Redeemed / used — optional */}
      {(state.redeemed ?? []).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <p className="text-sm font-medium text-foreground mb-2">Redeemed / used</p>
          <ul className="space-y-1 text-sm text-muted-foreground">
            {(state.redeemed ?? []).slice(0, 10).map((r) => (
              <li key={r.id}>
                {r.code} · {r.redeemed_at ? new Date(r.redeemed_at).toLocaleDateString() : "—"}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
