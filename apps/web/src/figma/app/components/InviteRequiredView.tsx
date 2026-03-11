"use client";

import React, { useState } from "react";
import { Shield, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Shown when LINKARY_INVITE_ONLY=true and the signed-in user has not redeemed an invite.
 * User must enter a valid code to access the app.
 */
export default function InviteRequiredView({
  onSuccess,
}: {
  onSuccess: () => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) {
      setError("Enter an invite code.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) {
        setError("Session expired. Please sign in again.");
        setLoading(false);
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/invites/redeem`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ code: trimmed }),
      });
      const json = await res.json().catch(() => ({}));
      if (res.ok && json.ok) {
        onSuccess();
        return;
      }
      const msg = json.error ?? "Invalid or unavailable code.";
      if (msg === "already_redeemed") setError("This code was already used.");
      else if (msg === "invalid_or_unavailable_code") setError("Invalid or expired code. Check the code and try again.");
      else setError(msg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-8 shadow-lg">
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Shield className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Invite required</h1>
            <p className="text-sm text-muted-foreground">
              Linkary is invite-only. Enter a valid invite code to continue.
            </p>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="invite-code" className="block text-sm font-medium text-foreground mb-2">
              Invite code
            </label>
            <input
              id="invite-code"
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="Enter code"
              className="w-full h-11 px-4 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              autoComplete="off"
              disabled={loading}
            />
          </div>
          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 rounded-lg bg-primary text-primary-foreground font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loading ? "Verifying…" : "Continue"}
          </button>
        </form>
      </div>
    </div>
  );
}
