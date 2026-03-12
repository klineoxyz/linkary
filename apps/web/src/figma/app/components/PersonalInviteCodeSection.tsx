"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Copy, Check, Loader2, Link2, RefreshCw } from "lucide-react";
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
        max_invites: json.max_invites !== undefined ? json.max_invites : 1,
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
            One code works for one invite. Share it with someone to sign up; for more invites use one-time codes in the <strong>Invite wallet</strong> section below.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <code className="px-4 py-3 rounded-lg bg-muted text-lg font-mono font-semibold tracking-wide text-foreground">
              {data.personal_invite_code}
            </code>
            <button
              type="button"
              onClick={copyCode}
              className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium"
            >
              {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <p className="text-xs text-muted-foreground">
            {data.invites_remaining} of {data.max_invites ?? 1} invite remaining with this code. For more invites, use one-time codes in the Invite wallet below.
          </p>
        </>
      ) : null}
    </div>
  );
}
