"use client";

import React, { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Shield, Check } from "lucide-react";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

interface MfaPanelProps {
  getToken: () => Promise<string | null>;
  onUpdated: () => void;
}

export default function MfaPanel({ getToken, onUpdated }: MfaPanelProps) {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [enabling, setEnabling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        setLoading(false);
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("cdp_mfa_enabled")
        .eq("id", uid)
        .maybeSingle();
      setMfaEnabled(!!(profile as { cdp_mfa_enabled?: boolean } | null)?.cdp_mfa_enabled);
      setLoading(false);
    })();
  }, []);

  const handleEnableMfa = useCallback(async () => {
    setError(null);
    setEnabling(true);
    try {
      const { data } = await supabase.auth.getSession();
      const uid = data.session?.user?.id;
      if (!uid) {
        setError("Not signed in");
        return;
      }
      const { error: updateError } = await supabase
        .from("profiles")
        .update({ cdp_mfa_enabled: true })
        .eq("id", uid);
      if (updateError) {
        setError(updateError.message);
        return;
      }
      setMfaEnabled(true);
      onUpdated();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setEnabling(false);
    }
  }, [onUpdated]);

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Multi-factor authentication</h3>
      {mfaEnabled ? (
        <div className="flex items-center gap-2 text-sm text-green-700">
          <Check className="h-4 w-4 shrink-0" />
          Enabled
        </div>
      ) : (
        <>
          <p className="text-sm text-muted-foreground">
            Enable MFA to protect your wallet and to allow key export.
          </p>
          {error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          <button
            type="button"
            disabled={enabling}
            onClick={handleEnableMfa}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
              "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
            )}
          >
            <Shield className="h-4 w-4 stroke-[1.75]" />
            {enabling ? "Enabling…" : "Enable MFA"}
          </button>
        </>
      )}
    </div>
  );
}
