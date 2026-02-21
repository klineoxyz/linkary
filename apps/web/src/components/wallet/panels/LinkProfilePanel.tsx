"use client";

import React, { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Mail, Link2, Check, Phone, Smartphone, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

type RecoveryMethods = {
  email?: boolean;
  phone?: boolean;
  google?: boolean;
  x?: boolean;
  wallet?: boolean;
};

type CdpStatus = {
  walletAddress?: string;
  address?: string;
  recoveryMethods?: RecoveryMethods;
  recovery_verified_at?: string | null;
  profile_email_masked?: string;
  twitter_username?: string;
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
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const uid = session?.user?.id;
      if (!token || !uid) {
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const [apiRes, profileRes] = await Promise.all([
        fetch(`${base}/api/wallet/cdp/status`, { headers: { Authorization: `Bearer ${token}` } }),
        supabase.from("profiles").select("email, twitter_username, twitter_username_candidate").eq("id", uid).maybeSingle(),
      ]);
      const r = profileRes.data as { email?: string | null; twitter_username?: string | null; twitter_username_candidate?: string | null } | null;
      const profileEmailVal = (r?.email ?? "")?.toString().trim() || null;
      const profileHandle = (r?.twitter_username ?? r?.twitter_username_candidate ?? "").toString().replace(/^@/, "").trim() || null;
      if (apiRes.ok) {
        const json = await apiRes.json();
        setStatus(json as CdpStatus);
        const j = json as CdpStatus & { twitter_username?: string; profile_email_masked?: string };
        setProfileEmail(j.profile_email_masked ?? profileEmailVal);
        setXHandle((j.twitter_username ? String(j.twitter_username).replace(/^@/, "").trim() : null) ?? profileHandle);
      } else {
        setProfileEmail(profileEmailVal && !/^0x[a-f0-9]+@/i.test(profileEmailVal) && !profileEmailVal.includes("@wallet.") ? profileEmailVal : null);
        setXHandle(profileHandle);
        setStatus({
          recoveryMethods: {
            email: !!profileEmailVal && !profileEmailVal.includes("@wallet.") && !/^0x[a-f0-9]+@/i.test(profileEmailVal),
            phone: false,
            google: false,
            x: !!profileHandle,
            wallet: false,
          },
        });
      }
      setLoading(false);
    })();
  }, []);

  const searchParams = useSearchParams();
  useEffect(() => {
    const recovery = searchParams.get("recovery");
    const message = searchParams.get("message");
    if (recovery === "error" && message === "x_account_mismatch") {
      setRecoveryError("X account mismatch. The X account you used does not match the one linked to this profile.");
    } else if (recovery === "enabled") {
      setRecoveryError(null);
      setStatus((s) => (s ? { ...s, recovery_verified_at: new Date().toISOString() } : null));
    }
  }, [searchParams]);

  const methods = status?.recoveryMethods ?? {};
  const walletAddress = status?.walletAddress ?? status?.address ?? null;
  const hasAny = !!methods.email || !!methods.phone || !!methods.google || !!methods.x || !!walletAddress;
  const needsMore = hasAny && (!methods.email || !methods.x);
  const recoveryVerifiedAt = status?.recovery_verified_at ?? null;

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Wallet (CDP) & account</h3>
      {xHandle && (
        <p className="text-sm text-muted-foreground">
          Signed in with X: @{xHandle}
        </p>
      )}
      <p className="text-sm text-muted-foreground">
        Your wallet is from Coinbase CDP. App login is via X (above); wallet access can also use X (CDP).
      </p>
      {walletAddress && (
        <p className="text-sm text-muted-foreground">
          Wallet (CDP) {shortAddr(walletAddress)}
        </p>
      )}
      {recoveryError && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {recoveryError}
        </div>
      )}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Wallet recovery</p>
        {recoveryVerifiedAt ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-green-700">
            <Shield className="h-4 w-4 shrink-0" />
            Recovery enabled with X{xHandle ? ` (@${xHandle})` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Additional recovery options for this wallet are coming soon.
          </p>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {methods.x && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="App login">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Link2 className="h-3.5 w-3.5" />
                Signed in with X{xHandle ? ` (@${xHandle})` : ""}
              </span>
            )}
            {methods.email && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Recovery email linked">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Mail className="h-3.5 w-3.5 shrink-0" />
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
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title="Wallet (CDP)">
                Wallet (CDP) {shortAddr(walletAddress)}
              </span>
            )}
            {!hasAny && (
              <span className="text-xs text-muted-foreground">No wallet or login methods shown.</span>
            )}
          </div>
          {needsMore && (
            <p className="text-xs text-muted-foreground pt-1">
              X is your app login (Integrations). Wallet recovery options coming soon.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
