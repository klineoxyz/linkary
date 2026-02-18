"use client";

import React, { useState, useCallback } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import { ensureProfileForSession } from "@/lib/profiles";
import { upsertWallet } from "@/lib/wallets";

// Load CDP AuthButton on client so Coinbase login option shows reliably
const AuthButton = dynamic(
  () => import("@coinbase/cdp-react/components/AuthButton").then((m) => m.AuthButton as React.ComponentType<Record<string, unknown>>),
  { ssr: false, loading: () => <div className="h-10 rounded-lg bg-zinc-100 animate-pulse" aria-hidden /> }
);

const LINKARY_LOGIN_PREFIX = "Linkary login: ";

function getFunctionsUrl(): string {
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  return base ? `${base.replace(/\/$/, "")}/functions/v1/auth-cdp-login` : "";
}

export default function LoginPage({
  onLoggedIn,
  setRoute,
}: {
  onLoggedIn: () => void;
  setRoute: (r: { name: string }) => void;
}) {
  const cdpAppId =
    (typeof process !== "undefined" && process.env?.NEXT_PUBLIC_CDP_APP_ID) || "";

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <h1 className="text-2xl font-bold text-zinc-900 mb-2">Sign in to Linkary</h1>
        <p className="text-zinc-600 text-sm mb-6">
          Use your Coinbase wallet to sign in. No email or password.
        </p>

        {cdpAppId ? (
          <CoinbaseLoginFlow onLoggedIn={onLoggedIn} />
        ) : (
          <p className="text-zinc-500 text-sm">
            Set <code className="bg-zinc-100 px-1 rounded">NEXT_PUBLIC_CDP_APP_ID</code> and
            restart the app to enable Coinbase login.
          </p>
        )}

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

function CoinbaseLoginFlow({ onLoggedIn }: { onLoggedIn: () => void }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [bridgeStep, setBridgeStep] = useState<"idle" | "signing" | "exchanging">("idle");

  const { isSignedIn, evmAddress, signEvmMessage } = useCdpHooks();

  const runBridge = useCallback(async () => {
    if (!evmAddress || !signEvmMessage) {
      setError("Wallet not ready");
      return;
    }
    setError(null);
    setBridgeStep("signing");
    setLoading(true);
    const message = `${LINKARY_LOGIN_PREFIX}${Date.now()}`;
    try {
      const { signature } = await signEvmMessage({ evmAccount: evmAddress, message });
      setBridgeStep("exchanging");
      const url = getFunctionsUrl();
      if (!url) {
        setError("Missing Supabase URL");
        setLoading(false);
        setBridgeStep("idle");
        return;
      }
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${anonKey}`,
          apikey: anonKey,
        },
        body: JSON.stringify({ address: evmAddress, message, signature }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data?.error ?? "Login failed");
        setLoading(false);
        setBridgeStep("idle");
        return;
      }
      const { token_hash: tokenHash } = data;
      if (!tokenHash) {
        setError("No token received");
        setLoading(false);
        setBridgeStep("idle");
        return;
      }
      const { data: sessionData, error: verifyErr } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: "magiclink",
      });
      if (verifyErr) {
        setError(verifyErr.message);
        setLoading(false);
        setBridgeStep("idle");
        return;
      }
      const userId = sessionData?.session?.user?.id;
      if (!userId) {
        setError("Session missing");
        setLoading(false);
        setBridgeStep("idle");
        return;
      }
      await ensureProfileForSession(userId);
      await upsertWallet(userId, "evm", evmAddress);
      setLoading(false);
      setBridgeStep("idle");
      onLoggedIn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong");
      setLoading(false);
      setBridgeStep("idle");
    }
  }, [evmAddress, signEvmMessage, onLoggedIn]);

  if (!isSignedIn) {
    return (
      <div className="space-y-4">
        <AuthButton />
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {evmAddress && (
        <p className="text-xs text-zinc-500 truncate" title={evmAddress}>
          {evmAddress.slice(0, 6)}…{evmAddress.slice(-4)}
        </p>
      )}
      <button
        type="button"
        disabled={loading}
        onClick={runBridge}
        className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 disabled:opacity-50"
      >
        {loading
          ? bridgeStep === "signing"
            ? "Sign message…"
            : "Signing in…"
          : "Continue with Coinbase"}
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function useCdpHooks(): {
  isSignedIn: boolean;
  evmAddress: string | null;
  signEvmMessage: ((args: { evmAccount: string; message: string }) => Promise<{ signature: string }>) | null;
} {
  const { useIsSignedIn, useEvmAddress, useSignEvmMessage } = require("@coinbase/cdp-hooks");
  const signedIn = useIsSignedIn();
  const evm = useEvmAddress();
  const signMsg = useSignEvmMessage();

  return {
    isSignedIn: !!signedIn?.isSignedIn,
    evmAddress: evm?.evmAddress ?? null,
    signEvmMessage: signMsg?.signEvmMessage ?? null,
  };
}
