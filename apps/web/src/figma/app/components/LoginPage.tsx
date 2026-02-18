"use client";

import React, { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage({
  onLoggedIn,
  setRoute,
}: {
  onLoggedIn: () => void;
  setRoute: (r: { name: string }) => void;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useMagicLink, setUseMagicLink] = useState(false);

  const handleEmailPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    onLoggedIn();
  };

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: typeof window !== "undefined" ? window.location.origin + "/" : undefined },
    });
    setLoading(false);
    if (err) {
      setError(err.message);
      return;
    }
    setMagicLinkSent(true);
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
          <h1 className="text-xl font-semibold text-zinc-900 mb-2">Check your email</h1>
          <p className="text-zinc-600 text-sm mb-6">
            We sent a sign-in link to <strong>{email}</strong>. Click it to sign in.
          </p>
          <button
            type="button"
            onClick={() => { setMagicLinkSent(false); setError(null); }}
            className="text-sm text-indigo-600 hover:text-indigo-700"
          >
            Use a different email
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Sign in to Linkary</h1>
        <p className="text-zinc-600 text-sm mb-6">Use email + password or magic link.</p>

        <form
          onSubmit={useMagicLink ? handleMagicLink : handleEmailPassword}
          className="space-y-4"
        >
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
            />
          </div>
          {!useMagicLink && (
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required={!useMagicLink}
                placeholder="••••••••"
                className="w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-zinc-900"
              />
            </div>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={loading || !email.trim()}
              className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
            >
              {loading ? "Signing in…" : useMagicLink ? "Send magic link" : "Sign in"}
            </button>
          </div>
        </form>

        <div className="mt-4 flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={() => { setUseMagicLink(!useMagicLink); setError(null); }}
            className="text-zinc-500 hover:text-zinc-700"
          >
            {useMagicLink ? "Use password instead" : "Use magic link instead"}
          </button>
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
