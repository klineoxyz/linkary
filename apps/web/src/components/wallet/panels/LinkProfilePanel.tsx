"use client";

import React, { useEffect, useState } from "react";
import { Mail, Link2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LinkedProfile = {
  email: string | null;
  twitter_username: string | null;
  twitter_username_candidate: string | null;
};

/** True if this is a wallet placeholder email (e.g. 0x...@wallet.linkary.xyz), not a real user email. */
function isWalletEmail(email: string): boolean {
  const e = email.trim().toLowerCase();
  return e.includes("@wallet.") || /^0x[a-f0-9]+@/i.test(e);
}

/** Mask email for display: first 2 chars of local part + **** + @domain (e.g. xi****@gmail.com). */
function maskEmail(email: string): string {
  const t = email.trim();
  if (!t) return "";
  const at = t.indexOf("@");
  if (at <= 0) return t.slice(0, 2) + "****";
  const local = t.slice(0, at);
  const domain = t.slice(at);
  const show = local.length <= 2 ? local.slice(0, 1) + "****" : local.slice(0, 2) + "****";
  return show + domain;
}

/** Short wallet address for display (0x1234...5678). */
function shortWallet(email: string): string {
  const t = email.trim();
  const at = t.indexOf("@");
  const local = at > 0 ? t.slice(0, at) : t;
  if (local.length <= 10) return local + "…";
  return local.slice(0, 6) + "…" + local.slice(-4);
}

export default function LinkProfilePanel() {
  const [profile, setProfile] = useState<LinkedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("email, twitter_username, twitter_username_candidate")
        .eq("id", uid)
        .maybeSingle();
      const r = row as { email?: string | null; twitter_username?: string | null; twitter_username_candidate?: string | null } | null;
      setProfile(
        r
          ? {
              email: r.email ?? null,
              twitter_username: r.twitter_username ?? null,
              twitter_username_candidate: r.twitter_username_candidate ?? null,
            }
          : null
      );
      setLoading(false);
    })();
  }, []);

  const rawEmail = profile?.email?.trim() ?? "";
  const hasRealEmail = !!rawEmail && !isWalletEmail(rawEmail);
  const hasWalletEmail = !!rawEmail && isWalletEmail(rawEmail);
  const xHandle = (profile?.twitter_username ?? profile?.twitter_username_candidate ?? "").toString().replace(/^@/, "").trim();
  const hasX = !!xHandle;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Link a profile</h3>
      <p className="text-sm text-muted-foreground">
        Wallet is from Coinbase CDP (sign-in). X and email are from Settings → Integrations and are used to claim and recover this wallet.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Recovery methods</p>
          <div className="flex flex-wrap gap-2">
            {hasX && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="X linked to this wallet">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Link2 className="h-3.5 w-3.5" />
                X (@{xHandle})
              </span>
            )}
            {hasRealEmail && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Email linked to this wallet">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Mail className="h-3.5 w-3.5" />
                Email ({maskEmail(rawEmail)})
              </span>
            )}
            {hasWalletEmail && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title="Coinbase CDP wallet (sign-in)">
                Wallet — CDP ({shortWallet(rawEmail)})
              </span>
            )}
            {!hasX && !hasRealEmail && !hasWalletEmail && (
              <span className="text-xs text-muted-foreground">No recovery methods linked yet.</span>
            )}
          </div>
          {!hasX || !hasRealEmail ? (
            <p className="text-xs text-muted-foreground pt-1">
              Add X and email in Settings → Integrations to improve account recovery.
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
