"use client";

import React, { useEffect, useState } from "react";
import { Mail, Link2, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

type LinkedProfile = {
  email: string | null;
  twitter_username: string | null;
};

export default function LinkProfilePanel() {
  const [profile, setProfile] = useState<LinkedProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data: row } = await supabase
        .from("profiles")
        .select("email, twitter_username")
        .eq("id", uid)
        .maybeSingle();
      setProfile(
        row
          ? {
              email: (row as { email?: string | null }).email ?? null,
              twitter_username: (row as { twitter_username?: string | null }).twitter_username ?? null,
            }
          : null
      );
      setLoading(false);
    })();
  }, []);

  const hasEmail = !!profile?.email?.trim();
  const hasX = !!profile?.twitter_username?.trim();

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Link a profile</h3>
      <p className="text-sm text-muted-foreground">
        Your sign-in and profile methods are linked to your wallet for recovery and verification.
      </p>
      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : (
        <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-3">
          <p className="text-xs font-medium text-muted-foreground">Linked to your account</p>
          <div className="flex flex-wrap gap-2">
            {hasEmail && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Mail className="h-3.5 w-3.5" />
                Email
              </span>
            )}
            {hasX && (
              <span className="inline-flex items-center gap-1.5 rounded-md border border-green-500/40 bg-green-500/10 px-2.5 py-1.5 text-xs text-green-700">
                <Check className="h-3.5 w-3.5 shrink-0" />
                <Link2 className="h-3.5 w-3.5" />
                X (@{String(profile?.twitter_username).replace(/^@/, "")})
              </span>
            )}
            {!hasEmail && !hasX && (
              <span className="text-xs text-muted-foreground">Connect email or X in your profile and Integrations.</span>
            )}
          </div>
          <p className="text-xs text-muted-foreground pt-1">
            Additional recovery methods (phone, Google, Apple) may be available in a future configuration.
          </p>
        </div>
      )}
    </div>
  );
}
