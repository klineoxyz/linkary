"use client";

import React, { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { getMyProfile, disconnectTwitter } from "@/lib/profiles";
import { syncProfileFromX } from "@/lib/x-sync";
import type { Profile } from "@/lib/profiles";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (typeof window !== "undefined" ? window.location.origin : "http://localhost:3000");
const AUTH_CALLBACK = `${SITE_URL.replace(/\/$/, "")}/auth/callback`;

export default function IntegrationsPage({
  setRoute,
  userId,
}: {
  setRoute: (r: { name: string }) => void;
  userId: string | null;
}) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const syncOnceRef = useRef(false);

  const refreshProfile = async () => {
    if (!userId) return;
    const p = await getMyProfile(userId);
    setProfile(p ?? null);
  };

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }
    getMyProfile(userId).then((p) => {
      setProfile(p ?? null);
      setLoading(false);
    });
  }, [userId]);

  // When X is connected, sync from X once on load so handle/avatar/analytics stay current
  useEffect(() => {
    if (!userId || !profile?.twitter_username || syncOnceRef.current) return;
    syncOnceRef.current = true;
    syncProfileFromX().then((res) => {
      if (res.ok) refreshProfile();
    });
  }, [userId, profile?.twitter_username]);

  const handleConnectX = async () => {
    setError(null);
    setConnecting(true);
    // Use exact callback URL (no query) so it matches Supabase Redirect URLs allow list.
    const redirectTo = AUTH_CALLBACK;
    try {
      sessionStorage.setItem("linkary_oauth_next", "/settings/integrations");
    } catch {
      /* ignore */
    }
    const { data, error: err } = await supabase.auth.signInWithOAuth({
      provider: "x",
      options: { redirectTo },
    });
    setConnecting(false);
    if (err) {
      setError(err.message);
      return;
    }
    if (data?.url) {
      window.location.href = data.url;
      return;
    }
    setError("Could not start X sign-in. Check that Twitter is enabled in Supabase Auth.");
  };

  const handleDisconnectX = async () => {
    if (!userId) return;
    setError(null);
    setDisconnecting(true);
    const result = await disconnectTwitter(userId);
    setDisconnecting(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    const updated = await getMyProfile(userId);
    setProfile(updated ?? null);
  };

  const isConnected = Boolean(
    profile?.twitter_connected_at ?? profile?.twitter_user_id
  );
  const handle = profile?.twitter_username ?? profile?.twitter_username_candidate ?? null;
  const avatar = profile?.avatar_url ?? null;

  if (!userId) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Integrations</h1>
        <p className="text-zinc-600 mb-6">Sign in to connect accounts.</p>
        <button
          type="button"
          onClick={() => setRoute({ name: "login" })}
          className="px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700"
        >
          Sign in
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <button
        type="button"
        onClick={() => setRoute({ name: "preferences" })}
        className="text-sm text-zinc-500 hover:text-zinc-700 mb-6"
      >
        ← Back to Preferences
      </button>
      <h1 className="text-2xl font-bold text-zinc-900 mb-2">Integrations</h1>
      <p className="text-zinc-600 mb-8">Connect your accounts for verification and linking.</p>

      {error && (
        <div className="mb-6 p-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-xl border border-zinc-200 p-6">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-full bg-zinc-100 flex items-center justify-center text-xl">
              𝕏
            </div>
            <div>
              <h2 className="font-semibold text-zinc-900">X (Twitter)</h2>
              <p className="text-sm text-zinc-500">
                {isConnected
                  ? handle
                    ? `@${handle.replace(/^@/, "")}`
                    : "Connected"
                  : "Connect for verification and profile link"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {isConnected ? (
              <>
                {avatar && (
                  <img
                    src={avatar}
                    alt=""
                    className="w-10 h-10 rounded-full object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={async () => {
                    setSyncing(true);
                    setError(null);
                    const res = await syncProfileFromX();
                    setSyncing(false);
                    if (res.ok) await refreshProfile();
                    else setError(res.ok === false ? res.error : "Sync failed");
                  }}
                  disabled={syncing}
                  className="px-4 py-2 rounded-lg border border-zinc-300 text-zinc-700 font-medium hover:bg-zinc-50 disabled:opacity-50"
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
              <button
                type="button"
                onClick={handleConnectX}
                disabled={connecting}
                className="px-4 py-2 rounded-lg bg-zinc-900 text-white font-medium hover:bg-zinc-800 disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect X"}
              </button>
            )}
          </div>
        </div>
      </div>

      <p className="mt-6 text-xs text-zinc-500">
        We use Supabase OAuth to connect your X account. Your handle and avatar are stored in your profile for verification. Disconnecting only removes the link in Linkary; it does not revoke the app in X.
      </p>
    </div>
  );
}
