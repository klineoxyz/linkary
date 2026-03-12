"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Copy, Check, Loader2, Link2, RefreshCw, Shield } from "lucide-react";
import { supabase } from "@/lib/supabase";

type MeInvites = {
  personal_invite_code: string;
  invites_used: number;
  invites_remaining: number;
  /** null = unlimited (super user) */
  max_invites?: number | null;
};

export default function PersonalInviteCodeSection() {
  const [data, setData] = useState<MeInvites | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const fetchMe = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      setError("Sign in to see your invite code.");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/invites/me`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && !json.error && json.personal_invite_code) {
      setData({
        personal_invite_code: json.personal_invite_code,
        invites_used: json.invites_used ?? 0,
        invites_remaining: json.invites_remaining ?? 0,
        max_invites: json.max_invites !== undefined ? json.max_invites : 5,
      });
    } else {
      setError(json?.error ?? "Could not load your invite code. Try again.");
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const copyCode = () => {
    if (!data?.personal_invite_code) return;
    if (typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(data.personal_invite_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-primary shrink-0" />
        <h2 className="text-lg font-semibold text-foreground">Your invite code</h2>
      </div>
      {loading ? (
        <div className="flex items-center justify-center min-h-[100px]">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <button
            type="button"
            onClick={() => { setLoading(true); fetchMe(); }}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium"
          >
            <RefreshCw className="h-4 w-4" />
            Try again
          </button>
        </div>
      ) : data ? (
        <>
          <p className="text-sm text-muted-foreground">
            Share this code with people you want to invite. They enter it when signing up. Every new user gets 5 invites; you can get more based on your activity later. For one-time codes, use the <strong>Invite wallet</strong> section below.
          </p>

          {/* VIP ticket-style access code */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 via-orange-500 to-amber-600 p-[1px] shadow-lg" style={{ boxShadow: "0 0 40px rgba(245,158,11,0.25)" }}>
            <div className="relative rounded-2xl bg-gradient-to-br from-amber-400/95 via-orange-400/95 to-amber-500/95 px-6 py-5">
              {/* Bokeh / shimmer dots */}
              <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl">
                <div className="absolute top-2 right-4 h-2 w-2 rounded-full bg-white/30" />
                <div className="absolute top-8 right-12 h-1.5 w-1.5 rounded-full bg-amber-200/40" />
                <div className="absolute bottom-6 left-8 h-2 w-2 rounded-full bg-white/25" />
                <div className="absolute bottom-4 right-16 h-1 w-1 rounded-full bg-amber-100/50" />
              </div>
              <p className="relative text-center text-lg font-bold tracking-wide text-white drop-shadow-sm">Join the Invite-Only Beta!</p>
              {/* Ticket body with serrated feel via border */}
              <div className="relative mx-auto mt-4 flex max-w-sm flex-col overflow-hidden rounded-xl border-2 border-amber-600/50 bg-gradient-to-b from-amber-500 to-orange-600 shadow-inner">
                <div className="flex items-center justify-center gap-2 border-b border-amber-600/40 bg-amber-500/80 px-4 py-2.5">
                  <Shield className="h-5 w-5 text-white" aria-hidden />
                  <span className="text-sm font-bold uppercase tracking-wider text-white">VIP Access</span>
                </div>
                {/* EARLY ACCESS CODE band - the code appears here */}
                <div className="flex flex-col items-center justify-center gap-1 bg-stone-800 px-4 py-4">
                  <span className="text-xs font-semibold uppercase tracking-widest text-amber-200/90">Early Access Code</span>
                  <span className="font-mono text-xl font-bold tracking-[0.35em] text-white">{data.personal_invite_code}</span>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="mt-2 inline-flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 text-sm font-medium text-white backdrop-blur-sm transition hover:bg-white/30"
                  >
                    {copied ? <Check className="h-4 w-4 text-emerald-300" /> : <Copy className="h-4 w-4" />}
                    {copied ? "Copied!" : "Copy code"}
                  </button>
                </div>
                <div className="flex items-center justify-center gap-2 border-t border-amber-600/40 bg-amber-500/80 px-4 py-2.5">
                  <Shield className="h-4 w-4 text-white" aria-hidden />
                  <span className="text-base font-semibold text-white">Linkary</span>
                </div>
              </div>
              <div className="relative mt-4 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-xs font-medium text-white/95">
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Limited spots!</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Beta launch soon!</span>
                <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-white" /> Get in first!</span>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">
            {data.max_invites == null
              ? `Unlimited invites (${data.invites_used} used).`
              : `${data.invites_remaining} of ${data.max_invites} invites remaining with this code.`}
          </p>
        </>
      ) : null}
    </div>
  );
}
