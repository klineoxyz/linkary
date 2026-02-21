"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Link2, Check, Phone, Smartphone, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

const isDev = typeof process !== "undefined" && process.env.NODE_ENV === "development";

/** Load CDP hooks once at module init; null if unavailable. */
const cdpHooks = (() => {
  try {
    return require("@coinbase/cdp-hooks");
  } catch {
    return null;
  }
})();

function useNull(): null {
  return null;
}
function useEmptyOAuth(): { signInWithOAuth: null; oauthState: null } {
  return { signInWithOAuth: null, oauthState: null };
}
function useEmptyLinkOAuth(): { linkOAuth: null; oauthState: null } {
  return { linkOAuth: null, oauthState: null };
}

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

function shortAddr(addr: string): string {
  const t = addr.trim();
  if (t.length <= 10) return t + "…";
  return t.slice(0, 6) + "…" + t.slice(-4);
}

/** Panel that uses CDP hooks when available. Rendered only when cdpHooks exists so hooks are called unconditionally. */
function LinkProfilePanelWithCdp() {
  const h = cdpHooks!;
  const useCurrentUserSafe = h.useCurrentUser ?? useNull;
  const useSignInSafe = h.useSignInWithOAuth ?? useEmptyOAuth;
  const useLinkSafe = h.useLinkOAuth ?? useEmptyLinkOAuth;
  const useEvmAddressSafe = h.useEvmAddress ?? useNull;

  const currentUser = useCurrentUserSafe();
  const signInResult = useSignInSafe();
  const linkResult = useLinkSafe();
  const evmAddress = useEvmAddressSafe();

  const signInWithOAuth = signInResult.signInWithOAuth;
  const linkOAuth = linkResult.linkOAuth;
  const oauthState = linkResult.oauthState ?? signInResult.oauthState;

  const hasCdpUser = h.useCurrentUser ? (currentUser != null) : !!evmAddress;

  const [status, setStatus] = useState<CdpStatus | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [recoveryLinking, setRecoveryLinking] = useState(false);
  const [cdpAuthLoading, setCdpAuthLoading] = useState(false);
  const [cdpAuthError, setCdpAuthError] = useState<string | null>(null);
  const [cdpSignInFailCount, setCdpSignInFailCount] = useState(0);
  const handledOAuthSuccessRef = useRef(false);
  const lastOAuthActionRef = useRef<"signin" | "link" | null>(null);

  const applyStatusPayload = useCallback((payload: CdpStatus | null) => {
    if (!payload) {
      setStatus(null);
      setProfileEmail(null);
      setXHandle(null);
      return;
    }
    setStatus(payload);
    setProfileEmail(payload.profile_email_masked ?? null);
    setXHandle(payload.twitter_username ? String(payload.twitter_username).replace(/^@/, "").trim() || null : null);
  }, []);

  const fetchStatus = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const apiRes = await fetch("/api/wallet/cdp/status", { headers: { Authorization: `Bearer ${token}` } });
    const json = await apiRes.json().catch(() => ({}));
    if (json?.ok === true && json?.status) {
      applyStatusPayload(json.status as CdpStatus);
    } else {
      applyStatusPayload(null);
    }
  }, [applyStatusPayload]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await fetchStatus();
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [fetchStatus]);

  const callMarkLinked = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const res = await fetch("/api/wallet/cdp/recovery/mark-linked", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json?.ok === true && json?.status) {
      applyStatusPayload(json.status as CdpStatus);
    }
  }, [applyStatusPayload]);

  useEffect(() => {
    if (oauthState?.status === "error") {
      lastOAuthActionRef.current = null;
      setRecoveryError("Linking was cancelled or failed. Please try again.");
      setRecoveryLinking(false);
      setCdpAuthError("CDP sign-in failed. Please try again.");
      setCdpAuthLoading(false);
      setCdpSignInFailCount((c) => c + 1);
      if (isDev) console.error("[CDP] oauth error", oauthState);
      return;
    }
    if (oauthState?.status !== "success") return;
    if (lastOAuthActionRef.current !== "link") return;
    const provider = (oauthState as { providerType?: string })?.providerType;
    if (provider && provider !== "x") return;
    if (handledOAuthSuccessRef.current) return;
    handledOAuthSuccessRef.current = true;
    lastOAuthActionRef.current = null;
    setRecoveryError(null);
    setCdpAuthError(null);
    callMarkLinked().finally(() => {
      setRecoveryLinking(false);
      setCdpAuthLoading(false);
    });
  }, [oauthState?.status, oauthState, callMarkLinked]);

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
      {(recoveryError || cdpAuthError) && (
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {recoveryError ?? cdpAuthError}
        </div>
      )}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Wallet recovery</p>
        {recoveryVerifiedAt ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-green-700">
            <Shield className="h-4 w-4 shrink-0" />
            Recovery enabled with X{xHandle ? ` (@${xHandle})` : ""}
          </p>
        ) : !hasCdpUser ? (
          <div className="space-y-2">
            {signInWithOAuth && (
              <>
                <button
                  type="button"
                  onClick={async () => {
                    setCdpAuthError(null);
                    setCdpAuthLoading(true);
                    lastOAuthActionRef.current = "signin";
                    try {
                      await signInWithOAuth("x");
                    } catch (e) {
                      setCdpAuthError("CDP sign-in failed. Please try again.");
                      setCdpAuthLoading(false);
                      setCdpSignInFailCount((c) => c + 1);
                      if (isDev) console.error("[CDP] signInWithOAuth error", e);
                    }
                  }}
                  disabled={cdpAuthLoading}
                  className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
                >
                  <Shield className="h-4 w-4 shrink-0" />
                  {cdpAuthLoading ? "Redirecting…" : "Enable wallet access with X (CDP)"}
                </button>
                {cdpSignInFailCount >= 2 && (
                  <p className="text-xs text-muted-foreground">
                    If this keeps failing, check CDP Portal: Domains allowlist + X OAuth enabled.
                  </p>
                )}
              </>
            )}
            {!signInWithOAuth && (
              <p className="text-sm text-muted-foreground">
                Additional recovery options for this wallet are coming soon.
              </p>
            )}
          </div>
        ) : linkOAuth ? (
          <div className="space-y-2">
            <button
              type="button"
              onClick={async () => {
                setRecoveryError(null);
                handledOAuthSuccessRef.current = false;
                lastOAuthActionRef.current = "link";
                setRecoveryLinking(true);
                try {
                  await linkOAuth("x");
                } catch (e) {
                  const msg = e instanceof Error ? e.message : String(e);
                  const alreadyLinked = /already linked|already have|already connected/i.test(msg);
                  if (alreadyLinked) {
                    handledOAuthSuccessRef.current = true;
                    callMarkLinked().finally(() => setRecoveryLinking(false));
                  } else {
                    setRecoveryError("Something went wrong. Please try again.");
                    setRecoveryLinking(false);
                  }
                  if (isDev) console.error("[CDP] linkOAuth error", e);
                }
              }}
              disabled={recoveryLinking}
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50"
            >
              <Shield className="h-4 w-4 shrink-0" />
              {recoveryLinking ? "Linking…" : "Secure wallet with X"}
            </button>
            <p className="text-xs text-muted-foreground">
              Link X as a recovery method for this wallet (CDP).
            </p>
          </div>
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
            {xHandle && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="App login (Supabase)">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Link2 className="h-3.5 w-3.5" />
                App login: X (@{xHandle})
              </span>
            )}
            {recoveryVerifiedAt && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Wallet recovery (CDP)">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Shield className="h-3.5 w-3.5" />
                Wallet recovery: X enabled
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

function LinkProfilePanelNoCdp() {
  const [status, setStatus] = useState<CdpStatus | null>(null);
  const [profileEmail, setProfileEmail] = useState<string | null>(null);
  const [xHandle, setXHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const methods = status?.recoveryMethods ?? {};
  const walletAddress = status?.walletAddress ?? status?.address ?? null;
  const hasAny = !!methods.email || !!methods.phone || !!methods.google || !!methods.x || !!walletAddress;
  const needsMore = hasAny && (!methods.email || !methods.x);
  const recoveryVerifiedAt = status?.recovery_verified_at ?? null;

  const applyStatusPayload = useCallback((payload: CdpStatus | null) => {
    if (!payload) {
      setStatus(null);
      setProfileEmail(null);
      setXHandle(null);
      return;
    }
    setStatus(payload);
    setProfileEmail(payload.profile_email_masked ?? null);
    setXHandle(payload.twitter_username ? String(payload.twitter_username).replace(/^@/, "").trim() || null : null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        if (!cancelled) setLoading(false);
        return;
      }
      const apiRes = await fetch("/api/wallet/cdp/status", { headers: { Authorization: `Bearer ${token}` } });
      const json = await apiRes.json().catch(() => ({}));
      if (json?.ok === true && json?.status) applyStatusPayload(json.status as CdpStatus);
      else applyStatusPayload(null);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [applyStatusPayload]);

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Wallet (CDP) & account</h3>
      {xHandle && <p className="text-sm text-muted-foreground">Signed in with X: @{xHandle}</p>}
      <p className="text-sm text-muted-foreground">
        Your wallet is from Coinbase CDP. App login is via X (above); wallet access can also use X (CDP).
      </p>
      {walletAddress && <p className="text-sm text-muted-foreground">Wallet (CDP) {shortAddr(walletAddress)}</p>}
      <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
        <p className="text-xs font-medium text-muted-foreground">Wallet recovery</p>
        {recoveryVerifiedAt ? (
          <p className="inline-flex items-center gap-1.5 text-sm text-green-700">
            <Shield className="h-4 w-4 shrink-0" />
            Recovery enabled with X{xHandle ? ` (@${xHandle})` : ""}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">Additional recovery options for this wallet are coming soon.</p>
        )}
      </div>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Status</p>
          <div className="flex flex-wrap gap-2">
            {xHandle && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="App login (Supabase)">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Link2 className="h-3.5 w-3.5" />
                App login: X (@{xHandle})
              </span>
            )}
            {methods.x && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Wallet recovery (CDP)">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Shield className="h-3.5 w-3.5" />
                Wallet recovery: X enabled
              </span>
            )}
            {methods.email && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700" title="Recovery email linked">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Mail className="h-3.5 w-3.5 shrink-0" />
                Email{profileEmail ? ` (${maskEmail(profileEmail)})` : ""}
              </span>
            )}
            {walletAddress && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/50 px-2.5 py-1.5 text-xs text-muted-foreground" title="Wallet (CDP)">
                Wallet (CDP) {shortAddr(walletAddress)}
              </span>
            )}
            {!hasAny && <span className="text-xs text-muted-foreground">No wallet or login methods shown.</span>}
          </div>
          {needsMore && <p className="text-xs text-muted-foreground pt-1">X is your app login (Integrations). Wallet recovery options coming soon.</p>}
        </div>
      )}
    </div>
  );
}

export default function LinkProfilePanel() {
  return cdpHooks ? <LinkProfilePanelWithCdp /> : <LinkProfilePanelNoCdp />;
}
