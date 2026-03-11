"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Loader2, Link2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

const ADMIN_TWITTER = "muazxinthi";

type Code = { id: string; code: string; status: string; batch_id: string; issued_by_type: string; issued_by_id: string; created_at: string; expires_at: string | null };

export default function AdminInvitesPage({ setRoute, me }: { setRoute?: (r: any) => void; me?: { id: string; twitter_username?: string | null } | null }) {
  const [allowed, setAllowed] = useState(false);
  const [allocateType, setAllocateType] = useState<"profile" | "org">("profile");
  const [allocateId, setAllocateId] = useState("");
  const [allocateCount, setAllocateCount] = useState(5);
  const [allocateLoading, setAllocateLoading] = useState(false);
  const [allocateError, setAllocateError] = useState<string | null>(null);
  const [codes, setCodes] = useState<Code[]>([]);
  const [codesLoading, setCodesLoading] = useState(false);

  useEffect(() => {
    const twitter = (me?.twitter_username ?? "").replace(/^@/, "").toLowerCase();
    setAllowed(twitter === ADMIN_TWITTER);
  }, [me?.twitter_username]);

  const loadMyCodes = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    setCodesLoading(true);
    const res = await fetch(`${base}/api/invites/my-codes`, { headers: { Authorization: `Bearer ${token}` } });
    const json = await res.json().catch(() => ({}));
    setCodesLoading(false);
    setCodes(Array.isArray(json.codes) ? json.codes : []);
  }, []);

  useEffect(() => {
    if (allowed) loadMyCodes();
  }, [allowed, loadMyCodes]);

  const handleAllocate = async () => {
    if (!allocateId.trim()) {
      setAllocateError("Enter profile or org ID (UUID).");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    if (!token || !base) return;
    setAllocateLoading(true);
    setAllocateError(null);
    const res = await fetch(`${base}/api/invites/allocate-batch`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        allocated_to_type: allocateType,
        allocated_to_id: allocateId.trim(),
        count: Math.min(Math.max(allocateCount, 1), 1000),
      }),
    });
    const json = await res.json().catch(() => ({}));
    setAllocateLoading(false);
    if (res.ok) {
      setAllocateId("");
      setAllocateCount(5);
      loadMyCodes();
    } else {
      setAllocateError(json?.error ?? "Allocate failed");
    }
  };

  if (!allowed) {
    return (
      <div className="space-y-6 max-w-2xl">
        {setRoute && (
          <button type="button" onClick={() => setRoute({ name: "overview" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
        )}
        <p className="text-destructive">Access restricted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      {setRoute && (
        <button type="button" onClick={() => setRoute({ name: "overview" })} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
      )}
      <div>
        <h1 className="text-xl font-semibold text-foreground">Invite ops (admin)</h1>
        <p className="text-sm text-muted-foreground">Allocate batches and view issued codes.</p>
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <h2 className="font-medium text-foreground">Allocate batch</h2>
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs text-muted-foreground mb-1">To</label>
            <select
              value={allocateType}
              onChange={(e) => setAllocateType(e.target.value as "profile" | "org")}
              className="h-9 rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="profile">Profile</option>
              <option value="org">Org</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">ID (UUID)</label>
            <input
              type="text"
              value={allocateId}
              onChange={(e) => setAllocateId(e.target.value)}
              placeholder="Profile or org UUID"
              className="h-9 w-48 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs text-muted-foreground mb-1">Count</label>
            <input
              type="number"
              min={1}
              max={1000}
              value={allocateCount}
              onChange={(e) => setAllocateCount(Number(e.target.value) || 1)}
              className="h-9 w-20 rounded-lg border border-border bg-background px-3 text-sm"
            />
          </div>
          <button
            type="button"
            onClick={handleAllocate}
            disabled={allocateLoading}
            className="h-9 px-4 rounded-lg bg-primary text-primary-foreground text-sm hover:opacity-90 disabled:opacity-50"
          >
            {allocateLoading ? "…" : "Allocate"}
          </button>
        </div>
        {allocateError && <p className="text-sm text-destructive">{allocateError}</p>}
      </div>

      <div className="rounded-xl border border-border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-medium text-foreground">My issued codes</h2>
          <button type="button" onClick={loadMyCodes} className="text-xs text-primary hover:underline">Refresh</button>
        </div>
        {codesLoading ? (
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        ) : codes.length === 0 ? (
          <p className="text-sm text-muted-foreground">No codes yet. Allocate a batch to a profile/org; they can then issue codes.</p>
        ) : (
          <div className="max-h-64 overflow-y-auto space-y-2">
            {codes.slice(0, 100).map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-2 py-2 px-3 rounded-lg border border-border text-sm">
                <code className="truncate font-mono text-xs">{c.code}</code>
                <span className="text-muted-foreground shrink-0">{c.status}</span>
              </div>
            ))}
            {codes.length > 100 && <p className="text-xs text-muted-foreground">Showing first 100</p>}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card p-4">
        <h2 className="font-medium text-foreground mb-2">Who invited whom</h2>
        <p className="text-sm text-muted-foreground mb-2">View invite lineage (inviter → invitee chain).</p>
        <button
          type="button"
          onClick={() => setRoute?.({ name: "inviteLineage" })}
          className="flex items-center gap-2 text-sm text-primary hover:underline"
        >
          <Link2 className="h-4 w-4" />
          Open Invite lineage
        </button>
      </div>
    </div>
  );
}
