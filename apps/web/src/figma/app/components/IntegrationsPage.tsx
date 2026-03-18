"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyProfile } from "@/lib/profiles";
import { getMySocialAccountX } from "@/lib/socialAccounts";
import { syncProfileFromX } from "@/lib/x-sync";
import type { Profile } from "@/lib/profiles";
import { PATH_ANALYTICS } from "@/lib/analytics-owner-state-presentation";

type RoutePayload = { name: string };
interface IntegrationsPageProps {
  setRoute: (r: RoutePayload) => void;
  userId: string | null;
}

function formatSyncTime(iso: string): string {
  if (!iso) return "\u2014";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "\u2014";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

export default function IntegrationsPage({ setRoute, userId }: IntegrationsPageProps) {
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [socialX, setSocialX] = useState<Awaited<ReturnType<typeof getMySocialAccountX>> | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingHandle, setSyncingHandle] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [twitterUsernameConflict, setTwitterUsernameConflict] = useState(false);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);
  const [authUidChanged, setAuthUidChanged] = useState(false);
  const [devBanner, setDevBanner] = useState<{ profileMissing?: boolean; profileIdMismatch?: boolean; otherUsersWithSameX?: { user_id: string; username: string | null }[] } | null>(null);

  // Connected = social_accounts only. If not connected, self-heal: call claim once (migrate X onto current user_id), then refetch.
  const loadIntegrations = useCallback(async () => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const { data: { session } } = await supabase.auth.getSession();
    const currentUid = session?.user?.id ?? userId ?? null;
    if (!currentUid) {
      setLoading(false);
      return;
    }
    if (typeof window !== "undefined") {
      const last = sessionStorage.getItem("linkary_last_auth_uid");
      if (last && last !== currentUid) {
        setAuthUidChanged(true);
      }
      sessionStorage.setItem("linkary_last_auth_uid", currentUid);
    }
    setError(null);
    let [p, clientSocial] = await Promise.all([getMyProfile(currentUid), getMySocialAccountX(currentUid)]);
    if (!clientSocial?.connected && session?.access_token) {
      try {
        const claimRes = await fetch(`${base}/api/integrations/x/claim`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (claimRes.ok) {
          const [p2, social2] = await Promise.all([getMyProfile(currentUid), getMySocialAccountX(currentUid)]);
          p = p2;
          clientSocial = social2;
        }
      } catch {
        /* non-blocking */
      }
    }
    setProfile(p ?? null);
    setSocialX(clientSocial);
    setLoading(false);
    if (session?.access_token) {
      fetch(`${base}/api/auth/ensure-social-x`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}` },
      }).catch((err) => console.error("[ANALYTICS_INIT_FAILED] ensure-social-x", err));
    }
  }, [userId]);

  useEffect(() => {
    loadIntegrations();
  }, [loadIntegrations]);

  useEffect(() => {
    if (!userId) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.access_token) loadIntegrations();
    });
    return () => subscription?.unsubscribe();
  }, [userId, loadIntegrations]);

  useEffect(() => {
    if (searchParams.get("x_fallback") === "1") {
      setShowFallbackNotice(true);
      if (typeof window !== "undefined" && window.history.replaceState) {
        const u = new URL(window.location.href);
        u.searchParams.delete("x_fallback");
        window.history.replaceState({}, "", u.pathname + (u.search || ""));
      }
    }
  }, [searchParams]);

  useEffect(() => {
    if (searchParams.get("x_connected") !== "1" || !userId) return;
    setLoading(true);
    (async () => {
      await supabase.auth.refreshSession();
      loadIntegrations();
    })();
    if (typeof window !== "undefined" && window.history.replaceState) {
      const u = new URL(window.location.href);
      u.searchParams.delete("x_connected");
      window.history.replaceState({}, "", u.pathname + (u.search || ""));
    }
  }, [searchParams, userId, loadIntegrations]);

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;
      try {
        const res = await fetch(
          `${typeof window !== "undefined" ? window.location.origin : ""}/api/debug/x-connection`,
          { headers: { Authorization: `Bearer ${session.access_token}` } }
        );
        if (!res.ok || cancelled) return;
        const data = await res.json();
        if (data.devBanner && !cancelled) {
          setDevBanner({
            profileMissing: data.profileMissing,
            profileIdMismatch: data.profileIdMismatch,
            otherUsersWithSameX: (data.otherUsersWithSameX ?? []).map((r: { user_id: string; username: string | null }) => ({ user_id: r.user_id, username: r.username })),
          });
        } else {
          setDevBanner(null);
        }
      } catch {
        setDevBanner(null);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  const handleConnectX = async () => {
    setError(null);
    setConnecting(true);
    try {
      sessionStorage.setItem("linkary_oauth_next", "/settings/integrations");
    } catch {
      /* ignore */
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const safeRes = origin ? await fetch(`${origin}/api/auth/safe-redirect-url?for=callback`).catch(() => null) : null;
    const safeJson = safeRes?.ok ? await safeRes.json().catch(() => ({})) : null;
    const callbackUrl = (safeJson?.redirectUrl as string) || `${origin}/auth/callback`;
    const oauthOpts = { provider: "x" as const, options: { redirectTo: callbackUrl } };
    const auth = supabase.auth as { linkIdentity: (opts: { provider: string; options?: { redirectTo?: string } }) => Promise<{ data: { url?: string }; error: { message: string } | null }> };
    const result = await auth.linkIdentity(oauthOpts);
    const data = result.data;
    const err = result.error;
    setConnecting(false);
    if (err) {
      const msg = (err?.message ?? "").toLowerCase();
      if (msg.includes("manual linking") || msg.includes("linking is disabled")) {
        setError(
          "Enable Allow manual linking in Supabase Auth settings, then retry Connect X."
        );
        return;
      }
      if (msg.includes("identity already") || msg.includes("already been linked") || msg.includes("belongs to another")) {
        setError(
          "This X account is already connected to another Linkary account. Disconnect it there first."
        );
        return;
      }
      if (msg.includes("provider is not enabled") || msg.includes("unsupported provider")) {
        setError(
          "X (Twitter) sign-in is not enabled in your Supabase project. In Supabase Dashboard go to Authentication → Providers → Twitter, turn it ON, and add your API Key and Secret from the X Developer Portal (developer.x.com)."
        );
        return;
      }
      setError(err.message);
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    setError("Could not start X connection. Try again.");
  };

  const handleDisconnectX = async () => {
    if (!userId) return;
    setError(null);
    setDisconnecting(true);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setDisconnecting(false);
      setError("Not signed in.");
      return;
    }
    try {
      const res = await fetch(`${base}/api/integrations/x/disconnect`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setError((err as { error?: string }).error ?? "Disconnect failed.");
        setDisconnecting(false);
        return;
      }
    } catch {
      setError("Disconnect failed.");
      setDisconnecting(false);
      return;
    }
    setDisconnecting(false);
    setTwitterUsernameConflict(false);
    const [updatedProfile, updatedSocial] = await Promise.all([getMyProfile(userId), getMySocialAccountX(userId)]);
    setProfile(updatedProfile ?? null);
    setSocialX(updatedSocial);
  };

  // Connected = exists social_accounts where user_id = auth.uid() AND provider in ('x','twitter') AND status='connected' AND revoked_at IS NULL. Do not require username.
  const isConnected = !!(socialX?.connected === true);
  const handle = socialX?.username ?? profile?.twitter_username ?? profile?.twitter_username_candidate ?? null;
  const avatar = profile?.avatar_url ?? null;

  /** Trusted sync: update profile handle only from social_accounts (no 24h cooldown). */
  const handleSyncHandleFromX = async () => {
    setSyncingHandle(true);
    setError(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setError("Not signed in");
      setSyncingHandle(false);
      return;
    }
    const res = await fetch(`${base}/api/x/sync-handle`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    if (res.ok && json.ok) {
      const updatedProfile = await getMyProfile(userId!);
      setProfile(updatedProfile ?? null);
      setSocialX(await getMySocialAccountX(userId!));
    } else {
      setError(json?.message ?? json?.code ?? "Failed to sync handle");
    }
    setSyncingHandle(false);
  };

  const handleSyncFromX = async () => {
    setSyncing(true);
    setError(null);
    const res = await syncProfileFromX();
    setSyncing(false);
    if (res.ok) {
      const updatedProfile = await getMyProfile(userId!);
      setProfile(updatedProfile ?? null);
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (token) {
        try {
          const sxRes = await fetch(typeof window !== "undefined" ? `${window.location.origin}/api/auth/social-x` : "", { headers: { Authorization: `Bearer ${token}` } });
          if (sxRes.ok) {
            const apiSocial = await sxRes.json();
            setSocialX({ connected: !!apiSocial.connected, username: apiSocial.username ?? null, provider_user_id: apiSocial.provider_user_id ?? null });
            return;
          }
        } catch {
          /* fallback */
        }
      }
      setSocialX(await getMySocialAccountX(userId!));
    } else {
      const resObj = res as Record<string, unknown>;
      const errMsg = typeof resObj?.error === "string" ? resObj.error : "Sync failed";
      setError(
        errMsg === "USERNAME_TAKEN_VERIFIED"
          ? "That X handle is already taken by a verified account. Your profile was updated; you can keep a different handle or contact support."
          : errMsg
      );
    }
  };

  const showLastSynced = isConnected && (profile?.x_last_profile_sync_at ?? profile?.x_last_tweets_sync_at);
  const lastSyncedProfile = profile?.x_last_profile_sync_at ? formatSyncTime(profile.x_last_profile_sync_at) : "\u2014";
  const lastSyncedTweets = profile?.x_last_tweets_sync_at ? formatSyncTime(profile.x_last_tweets_sync_at) : "\u2014";
  const goToPreferences = () => setRoute({ name: "overview" });
  const goToLogin = () => setRoute({ name: "login" });

  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Integrations</h1>
        <p className="text-zinc-600 mb-6">Sign in to connect accounts.</p>
        <button
          type="button"
          onClick={goToLogin}
          className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white font-medium"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button type="button" onClick={goToPreferences} className="text-sm text-zinc-500 hover:text-zinc-700 mb-6">
        {"\u2190"} Back to Preferences
      </button>
      {devBanner ? (
        <div className="mb-6 p-4 rounded-lg bg-red-500/15 border-2 border-red-500 text-red-900 dark:text-red-200 text-sm font-medium">
          <p className="font-bold uppercase tracking-wide mb-1">DEV: Identity mismatch</p>
          <p>{devBanner.profileMissing ? "Profile row missing for auth.uid()." : ""} {devBanner.profileIdMismatch ? "profiles.id !== auth.uid()." : ""}</p>
          {devBanner.otherUsersWithSameX?.length ? (
            <p className="mt-1">Same X connected to other user_id(s): {devBanner.otherUsersWithSameX.map((r) => r.user_id).join(", ")}</p>
          ) : null}
          <p className="mt-1 text-xs">Check GET /api/debug/x-connection with Bearer token.</p>
        </div>
      ) : null}
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Integrations</h1>
      <p className="text-zinc-600 mb-8">Connect your accounts for verification and linking.</p>
      {authUidChanged ? (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm flex items-start justify-between gap-2">
          <p>
            Auth user changed; integrations may appear disconnected. Check <strong>/api/debug/x-connection</strong> (with Bearer token) for authUid vs social_accounts.user_id and rlsBlocking.
          </p>
          <button type="button" onClick={() => setAuthUidChanged(false)} className="shrink-0 font-medium" aria-label="Dismiss">Dismiss</button>
        </div>
      ) : null}
      {error != null ? (
        <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-border text-foreground text-sm">
          {error}
        </div>
      ) : null}
      {showFallbackNotice ? (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm flex items-start justify-between gap-2">
          <p>
            You signed in with X instead of linking to this account. To have one account for CDP and X, enable <strong>Allow manual linking</strong> in Supabase Dashboard → Authentication → User Signups, then click Connect X again here.
          </p>
          <button type="button" onClick={() => setShowFallbackNotice(false)} className="shrink-0 text-amber-700 hover:text-amber-900 font-medium" aria-label="Dismiss">Dismiss</button>
        </div>
      ) : null}
      {twitterUsernameConflict ? (
        <div className="mb-6 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-sm">
          Your connected X account differs from your stored handle. We kept your existing handle; the connected account is saved as a suggestion. You can disconnect and reconnect with the correct account, or keep your current handle.
        </div>
      ) : null}
      <div className="space-y-6">
        <div className="bg-white rounded-xl border border-zinc-200 p-6">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl font-bold text-zinc-900">
                {"\uD835\uDD4F"}
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900">X</h2>
                <p className="text-sm text-zinc-500">
                  {loading
                    ? "Loading…"
                    : isConnected
                      ? handle != null
                        ? "@" + String(handle).replace(/^@/, "") + " (read-only; sync from X to update)"
                        : "Connected"
                      : "Connect for verification and profile link"}
                  {showLastSynced ? (
                    <span className="block mt-1 text-xs text-zinc-400">
                      Synced {lastSyncedProfile !== "\u2014" ? lastSyncedProfile : lastSyncedTweets}
                    </span>
                  ) : null}
                </p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {loading ? null : isConnected ? (
              <>
                {avatar != null ? (
                  <img src={avatar} alt="" className="w-10 h-10 rounded-full object-cover" />
                ) : null}
                <button
                  type="button"
                  onClick={handleSyncHandleFromX}
                  disabled={syncingHandle}
                  className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 disabled:opacity-50 text-sm"
                  title="Update profile handle from connected X account"
                >
                  {syncingHandle ? "Updating…" : "Sync handle"}
                </button>
                <button
                  type="button"
                  onClick={handleSyncFromX}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {syncing ? "Syncing…" : "Sync from X"}
                </button>
                <button
                  type="button"
                  onClick={handleDisconnectX}
                  disabled={disconnecting}
                  className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 disabled:opacity-50"
                >
                  {disconnecting ? "Disconnecting…" : "Disconnect"}
                </button>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleConnectX}
                  disabled={connecting}
                  className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-medium hover:opacity-90 disabled:opacity-50"
                >
                  {connecting ? "Connecting…" : "Connect X"}
                </button>
                <button
                  type="button"
                  onClick={() => { setLoading(true); loadIntegrations(); }}
                  className="px-3 py-2 rounded-lg border border-zinc-300 text-zinc-600 text-sm font-medium hover:bg-zinc-50"
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
          {!loading && !isConnected && (
            <p className="mt-3 text-xs text-zinc-500">
              To keep X connected when you sign in with CDP or email, enable <strong>Allow manual linking</strong> in Supabase Dashboard → Authentication → User Signups, then connect again.
            </p>
          )}
          {!loading && isConnected && (
            <p className="mt-3 text-xs text-zinc-500 border-t border-zinc-100 pt-3">
              After <strong>Sync from X</strong>, open{" "}
              <a href={PATH_ANALYTICS} className="text-zinc-800 font-medium hover:underline">
                Analytics
              </a>{" "}
              for charts and to <strong>request an analytics refresh</strong> (queued background update).
            </p>
          )}
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-6 opacity-90">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900 flex items-center gap-2">YouTube <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Soon</span></h2>
                <p className="text-sm text-zinc-500">Connect for video analytics. API integration coming next.</p>
              </div>
            </div>
            <button type="button" disabled className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-400 font-medium cursor-not-allowed">
              Connect YouTube
            </button>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-zinc-200 p-6 opacity-90">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center">
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </div>
              <div>
                <h2 className="font-semibold text-zinc-900 flex items-center gap-2">TikTok <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Soon</span></h2>
                <p className="text-sm text-zinc-500">Connect for short-form video analytics. API integration coming next.</p>
              </div>
            </div>
            <button type="button" disabled className="px-4 py-2 rounded-lg border border-zinc-200 text-zinc-400 font-medium cursor-not-allowed">
              Connect TikTok
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
