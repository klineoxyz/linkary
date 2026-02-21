"use client";

import React, { useEffect, useState } from "react";
import { Mail, Link2, Check, Phone, Smartphone } from "lucide-react";
import { supabase } from "@/lib/supabase";

type RecoveryMethods = {
  email: boolean;
  phone: boolean;
  google: boolean;
  x: boolean;
};

type CdpStatus = {
  walletAddress?: string;
  address?: string;
  recoveryMethods?: RecoveryMethods;
};

/** Mask email for display: first 2 chars of local part + **** + @domain. */
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
function shortAddr(addr: string): string {
  const t = addr.trim();
  if (t.length <= 10) return t + "…";
  return t.slice(0, 6) + "…" + t.slice(-4);
}

export default function LinkProfilePanel() {
  const [status, setStatus] = useState<CdpStatus | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      const uid = session?.session?.user?.id;
      if (!token || !uid) {
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/cdp/status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const json = await res.json();
        setStatus(json as CdpStatus);
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("email, twitter_username, twitter_username_candidate")
        .eq("id", uid)
        .maybeSingle();
      const r = row as { email?: string | null; twitter_username?: string | null; twitter_username_candidate?: string | null } | null;
      setProfileEmail((r?.email ?? "")?.toString().trim() || null);
      const handle = (r?.twitter_username ?? r?.twitter_username_candidate ?? "").toString().replace(/^@/, "").trim();
      setXHandle(handle || null);
      setLoading(false);
    })();
  }, []);

  const methods = status?.recoveryMethods ?? { email: false, phone: false, google: false, x: false };
  const walletAddress = status?.walletAddress ?? status?.address ?? null;
  const hasAny = methods.email || methods.phone || methods.google || methods.x || !!walletAddress;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Link a profile</h3>
      <p className="text-sm text-muted-foreground">
        Wallet is from Coinbase CDP. Add recovery methods in Settings → Integrations to claim and recover this wallet.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Recovery methods</p>
          <div className="flex flex-wrap gap-2">
            {methods.x && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="X linked">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Link2 className="h-3.5 w-3.5" />
                X{xHandle ? ` (@${xHandle})` : ""}
              </span>
            )}
            {methods.email && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Email linked">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Mail className="h-3.5 w-3.5" />
                Email{profileEmail ? ` (${maskEmail(profileEmail)})` : ""}
              </span>
            )}
            {methods.phone && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Phone linked">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Phone className="h-3.5 w-3.5" />
                Phone
              </span>
            )}
            {methods.google && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Google linked">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Smartphone className="h-3.5 w-3.5" />
                Google
              </span>
            )}
            {walletAddress && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title="CDP wallet">
                Wallet — CDP ({shortAddr(walletAddress)})
              </span>
            )}
            {!hasAny && (
              <span className="text-xs text-muted-foreground">No recovery methods linked yet.</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Add X and email in Settings → Integrations to improve account recovery.
          </p>
        </div>
      )}
    </div>
  );
}
