"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { getMyProfile, disconnectTwitter } from "@/lib/profiles";
import { getMySocialAccountX } from "@/lib/socialAccounts";
import { syncProfileFromX } from "@/lib/x-sync";
import type { Profile } from "@/lib/profiles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
const AUTH_CALLBACK = `${SITE_URL.replace(/\/$/, "")}/auth/callback`;

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
  const [error, setError] = useState<string | null>(null);
  const [twitterUsernameConflict, setTwitterUsernameConflict] = useState(false);
  const [showFallbackNotice, setShowFallbackNotice] = useState(false);

  // X "connected": only trust GET /api/auth/social-x. Keep trying to get token so we never show "Connect X" before the API has run.
  const loadIntegrations = useCallback(async () => {
    if (!userId) {
      setLoading(false);
      return;
    }
    setError(null);
    const base = typeof window !== "undefined" ? window.location.origin : "";

    let token: string | null = null;
    for (let i = 0; i < 12; i++) {
      const { data: { session } } = await supabase.auth.getSession();
      token = session?.access_token ?? null;
      if (token) break;
      if (typeof window !== "undefined") await new Promise((r) => setTimeout(r, 500));
    }

    const [p, clientSocial] = await Promise.all([getMyProfile(userId), getMySocialAccountX(userId)]);
    setProfile(p ?? null);

    const tryApi = async (t: string): Promise<boolean> => {
      try {
        await fetch(`${base}/api/auth/ensure-social-x`, { method: "POST", headers: { Authorization: `Bearer ${t}` }, credentials: "include" });
      } catch {
        /* non-blocking */
      }
      try {
        let res = await fetch(`${base}/api/auth/social-x`, { headers: { Authorization: `Bearer ${t}` }, credentials: "include" });
        if (res.ok) {
          const apiSocial = await res.json();
          if (apiSocial.connected) {
            setSocialX({
              connected: true,
              username: apiSocial.username ?? null,
              provider_user_id: apiSocial.provider_user_id ?? null,
            });
            return true;
          }
          try {
            await fetch(`${base}/api/auth/sync-session-x`, { method: "POST", headers: { Authorization: `Bearer ${t}` } });
            res = await fetch(`${base}/api/auth/social-x`, { headers: { Authorization: `Bearer ${t}` }, credentials: "include" });
            if (res.ok) {
              const again = await res.json();
              if (again.connected) {
                setSocialX({
                  connected: true,
                  username: again.username ?? null,
                  provider_user_id: again.provider_user_id ?? null,
                });
                return true;
              }
            }
          } catch {
            /* ignore */
          }
        }
      } catch {
        /* ignore */
      }
      return false;
    };

    if (token && (await tryApi(token))) {
      setLoading(false);
      return;
    }

    setSocialX((prev) => (prev?.connected ? prev : clientSocial));
    setLoading(false);
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
    let cancelled = false;
    const timers: ReturnType<typeof setTimeout>[] = [];
    (async () => {
      await supabase.auth.refreshSession();
      if (cancelled) return;
      await new Promise((r) => setTimeout(r, 500));
      if (cancelled) return;
      loadIntegrations();
      timers.push(setTimeout(() => { if (!cancelled) loadIntegrations(); }, 1200));
      timers.push(setTimeout(() => { if (!cancelled) loadIntegrations(); }, 2400));
      if (typeof window !== "undefined" && window.history.replaceState) {
        const u = new URL(window.location.href);
        u.searchParams.delete("x_connected");
        window.history.replaceState({}, "", u.pathname + (u.search || ""));
      }
    })();
    return () => {
      cancelled = true;
      timers.forEach((t) => clearTimeout(t));
    };
  }, [searchParams, userId, loadIntegrations]);

  const handleConnectX = async () => {
    setError(null);
    setConnecting(true);
    try {
      sessionStorage.setItem("linkary_oauth_next", "/settings/integrations");
    } catch {
      /* ignore */
    }
    // Supabase Auth uses provider "twitter" for X/Twitter OAuth
    const oauthOpts = { provider: "twitter" as const, options: { redirectTo: AUTH_CALLBACK } };
    const auth = supabase.auth as { linkIdentity?: (opts: { provider: string; options?: { redirectTo?: string } }) => Promise<{ data: { url?: string }; error: { message: string } | null }>; signInWithOAuth: (opts: { provider: string; options?: { redirectTo?: string } }) => Promise<{ data: { url?: string }; error: { message: string } | null }> };
    let data: { url?: string } | null = null;
    let err: { message: string } | null = null;
    if (userId && auth.linkIdentity) {
      const result = await auth.linkIdentity(oauthOpts);
      data = result.data;
      err = result.error;
      if (err) {
        try {
          sessionStorage.setItem("linkary_oauth_fallback", "1");
        } catch {
          /* ignore */
        }
        const { data: fallbackData, error: fallbackErr } = await supabase.auth.signInWithOAuth(oauthOpts);
        if (!fallbackErr && fallbackData?.url) {
          window.location.href = fallbackData.url;
          return;
        }
        try {
          sessionStorage.removeItem("linkary_oauth_fallback");
        } catch {
          /* ignore */
        }
      }
    } else {
      const result = await supabase.auth.signInWithOAuth(oauthOpts);
      data = result.data;
      err = result.error;
    }
    setConnecting(false);
    if (err) {
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
    try {
      await supabase
        .from("social_accounts")
        .update({
          revoked_at: new Date().toISOString(),
          status: "revoked",
          updated_at: new Date().toISOString(),
        })
        .eq("user_id", userId)
        .eq("provider", "x");

      const { data: identities } = await supabase.auth.getUserIdentities();
      const xIdentity = identities?.identities?.find(
        (i) => (i.provider ?? "").toLowerCase() === "twitter" || (i.provider ?? "").toLowerCase() === "x"
      );
      if (xIdentity && (identities?.identities?.length ?? 0) >= 2) {
        await supabase.auth.unlinkIdentity(xIdentity);
      }
    } catch {
      /* unlink may fail; we still clear DB */
    }

    const result = await disconnectTwitter(userId, { clearUsername: false });
    setDisconnecting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setTwitterUsernameConflict(false);
    const [updatedProfile, updatedSocial] = await Promise.all([getMyProfile(userId), getMySocialAccountX(userId)]);
    setProfile(updatedProfile ?? null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (token) {
      try {
        const res = await fetch(typeof window !== "undefined" ? `${window.location.origin}/api/auth/social-x` : "", { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const apiSocial = await res.json();
          setSocialX({ connected: !!apiSocial.connected, username: apiSocial.username ?? null, provider_user_id: apiSocial.provider_user_id ?? null });
          return;
        }
      } catch {
        /* fallback */
      }
    }
    setSocialX(updatedSocial);
  };

  // X connected only when social_accounts has active row (user_id, provider x/twitter, revoked_at null, status connected)
  const isConnected = socialX?.connected ?? false;
  const handle = socialX?.username ?? profile?.twitter_username ?? profile?.twitter_username_candidate ?? null;
  const avatar = profile?.avatar_url ?? null;

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
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Integrations</h1>
      <p className="text-zinc-600 mb-8">Connect your accounts for verification and linking.</p>
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
                        ? "@" + String(handle).replace(/^@/, "")
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
