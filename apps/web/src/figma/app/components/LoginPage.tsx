"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

const SITE_URL = typeof window !== "undefined" ? (process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin) : "http://localhost:3000";
const AUTH_CALLBACK = `${SITE_URL.replace(/\/$/, "")}/auth/callback`;

/**
 * Login: X only (Supabase OAuth). CDP is not an auth method; wallet is created after login via Settings → Wallet.
 */
export default function LoginPage({
  onLoggedIn,
  setRoute,
}: {
  onLoggedIn: () => void;
  setRoute: (r: { name: string }) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSignInWithX = async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider: "x",
        options: { redirectTo: AUTH_CALLBACK, queryParams: { next: "/overview" } },
      });
      if (oauthError) {
        setError(oauthError.message);
        setLoading(false);
        return;
      }
      if (data?.url) {
        window.location.href = data.url;
        return;
      }
      setError("Could not start sign in.");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Sign in to Linkary</h1>
        <p className="text-zinc-600 text-sm mb-6">
          Sign in with X to create your profile and claim your handle. You can add a Coinbase wallet in Settings after signing in.
        </p>

        <div className="space-y-4">
          <button
            type="button"
            disabled={loading}
            onClick={handleSignInWithX}
            className="w-full py-2.5 rounded-lg bg-zinc-900 text-white font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? "Redirecting…" : "Sign in with X"}
          </button>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="mt-4 flex justify-end text-sm">
          <button
            type="button"
            onClick={() => setRoute({ name: "landing" })}
            className="text-zinc-500 hover:text-zinc-700"
          >
            Back
          </button>
        </div>
      </div>
    </div>
  );
}
