"use client";

import React, { useState } from "react";
import { AlertTriangle, Key, Copy, Check } from "lucide-react";
import { supabase } from "@/lib/supabase";

const cn = (...a: (string | undefined)[]) => a.filter(Boolean).join(" ");

interface ExportKeysPanelProps {
  getToken: () => Promise<string | null>;
  fetchStatus: () => Promise<void>;
}

export default function ExportKeysPanel({ getToken, fetchStatus }: ExportKeysPanelProps) {
  const [mfaEnabled, setMfaEnabled] = useState<boolean | null>(null);
  const [understood, setUnderstood] = useState(false);
  const [exportedKey, setExportedKey] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [copyDone, setCopyDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
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

  const handleExport = async () => {
    if (!mfaEnabled || !understood) return;
    setError(null);
    setExporting(true);
    try {
      const token = await getToken();
      if (!token) {
        setError("Not signed in");
        return;
      }
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/wallet/cdp/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ confirmToken: "export-keys-confirm" }),
      });
      const j = await res.json();
      if (j.supported === false) {
        setError("Key export is not supported by the current wallet configuration.");
        return;
      }
      if (!res.ok) {
        setError(j.error || "Export failed");
        return;
      }
      setExportedKey(j.privateKey ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setExporting(false);
    }
  };

  const handleCloseModal = () => {
    setExportedKey(null);
    setCopyDone(false);
  };

  const handleCopyKey = () => {
    if (exportedKey) {
      navigator.clipboard.writeText(exportedKey);
      setCopyDone(true);
      setTimeout(() => setCopyDone(false), 2000);
    }
  };

  if (loading) {
    return <p className="text-sm text-muted-foreground">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <h3 className="text-base font-semibold">Export keys</h3>
      <div className="rounded-lg border border-amber-500/50 bg-amber-500/10 p-4 flex gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0 text-amber-600" />
        <p className="text-sm">
          Do not share your private key with anyone. Anyone with this key can control your wallet.
        </p>
      </div>
      {!mfaEnabled ? (
        <p className="text-sm text-muted-foreground">Enable MFA to export keys.</p>
      ) : (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={understood}
              onChange={(e) => setUnderstood(e.target.checked)}
            />
            I understand the risks
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <button
            type="button"
            disabled={!understood || exporting}
            onClick={handleExport}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
              "bg-primary hover:opacity-90 text-primary-foreground disabled:opacity-50"
            )}
          >
            <Key className="h-4 w-4 stroke-[1.75]" />
            {exporting ? "Exporting…" : "Copy key"}
          </button>
        </>
      )}

      {exportedKey != null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="rounded-xl border border-border bg-card p-6 max-w-md w-full shadow-xl">
            <h4 className="font-semibold mb-2">Private key</h4>
            <p className="text-xs text-muted-foreground mb-2">Copy and store securely. It will not be shown again.</p>
            <pre className="rounded-lg bg-muted p-3 text-xs break-all font-mono mb-4 overflow-auto max-h-32">
              {exportedKey}
            </pre>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleCopyKey}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm",
                  "bg-primary hover:opacity-90 text-primary-foreground"
                )}
              >
                {copyDone ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                {copyDone ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleCloseModal}
                className="inline-flex items-center gap-2 rounded-lg font-medium h-10 px-4 text-sm border border-border bg-secondary hover:bg-accent"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
