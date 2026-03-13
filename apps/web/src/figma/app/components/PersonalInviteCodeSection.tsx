"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Copy, Check, Loader2, Link2, RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";

type MeInvites = {
  codes: Array<{ id: string; code: string }>;
  invites_used: number;
  max_invites: number;
};

export default function PersonalInviteCodeSection() {
  const [data, setData] = useState<MeInvites | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchMe = useCallback(async () => {
    setError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      setError("Sign in to see your invite codes.");
      return;
    }
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/invites/me`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    if (res.ok && !json.error && Array.isArray(json.codes)) {
      setData({
        codes: json.codes,
        invites_used: json.invites_used ?? 0,
        max_invites: json.max_invites ?? 5,
      });
    } else {
      setError(json?.error ?? "Could not load your invite codes. Try again.");
    }
  }, []);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  const copyCode = (code: string, id: string) => {
    if (typeof navigator?.clipboard?.writeText === "function") {
      navigator.clipboard.writeText(code);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Link2 className="h-5 w-5 text-primary shrink-0" />
        <h2 className="text-lg font-semibold text-foreground">Your invite codes</h2>
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
            You have 5 individual invite codes. Each code can be used once. Share a code with someone to sign up. For more invites, use the <strong>Invite wallet</strong> section below.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            {data.codes.length === 0 ? (
              <p className="text-sm text-muted-foreground">All 5 codes have been used. Use the Invite wallet below for more.</p>
            ) : (
              data.codes.map(({ id, code }) => (
                <div key={id} className="flex items-center gap-2">
                  <code className="px-4 py-3 rounded-lg bg-muted text-lg font-mono font-semibold tracking-wide text-foreground">
                    {code}
                  </code>
                  <button
                    type="button"
                    onClick={() => copyCode(code, id)}
                    className="inline-flex items-center gap-2 px-4 py-3 rounded-lg border border-border bg-background hover:bg-muted text-sm font-medium"
                  >
                    {copiedId === id ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
                    {copiedId === id ? "Copied" : "Copy"}
                  </button>
                </div>
              ))
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {data.codes.length} of {data.max_invites} codes remaining. {data.invites_used} invite(s) used. For more invites, use one-time codes in the Invite wallet below.
          </p>
        </>
      ) : null}
    </div>
  );
}
