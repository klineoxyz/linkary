"use client";

import React, { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Plus, Users, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Program = { id: string; title: string; description?: string | null; program_type: string; status: string; invites_count: number };
type Org = { id: string; name: string };

export default function CreatorProgramsPage({ setRoute }: { setRoute?: (r: any) => void }) {
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  const loadOrgs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id;
    if (!userId) return;
    const { data: rows } = await supabase.from("org_members").select("org_id").eq("user_id", userId);
    const ids = [...new Set((rows ?? []).map((r: { org_id: string }) => r.org_id))];
    if (ids.length === 0) {
      setOrgs([]);
      return;
    }
    const { data: orgList } = await supabase.from("orgs").select("id, name").in("id", ids);
    setOrgs((orgList ?? []) as Org[]);
  }, []);

  useEffect(() => {
    loadOrgs();
  }, [loadOrgs]);

  const loadPrograms = useCallback(async () => {
    if (!selectedOrgId) {
      setPrograms([]);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setLoading(true);
    const res = await fetch(`${base}/api/creator-programs?org_id=${encodeURIComponent(selectedOrgId)}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const json = await res.json().catch(() => ({}));
    setLoading(false);
    setPrograms(Array.isArray(json.programs) ? json.programs : []);
  }, [selectedOrgId, base]);

  useEffect(() => {
    loadPrograms();
  }, [loadPrograms]);

  const handleCreate = async () => {
    if (!selectedOrgId || !createTitle.trim()) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setCreateSubmitting(true);
    const res = await fetch(`${base}/api/creator-programs`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ org_id: selectedOrgId, title: createTitle.trim(), status: "draft" }),
    });
    setCreateSubmitting(false);
    if (res.ok) {
      setCreateTitle("");
      setCreateOpen(false);
      loadPrograms();
    }
  };

  return (
    <div className="space-y-6 max-w-3xl">
      {setRoute && (
        <button
          type="button"
          onClick={() => setRoute({ name: "overview" })}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      )}
      <div className="flex items-center gap-3">
        <Users className="h-8 w-8 text-primary" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">Creator programs</h1>
          <p className="text-sm text-muted-foreground">Create programs and invite creators from your circles or KOL lists</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-foreground mb-2">Organization</label>
        <select
          value={selectedOrgId ?? ""}
          onChange={(e) => setSelectedOrgId(e.target.value || null)}
          className="w-full max-w-xs h-10 px-3 rounded-lg border border-border bg-background text-foreground"
        >
          <option value="">Select org</option>
          {orgs.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </div>

      {selectedOrgId && (
        <>
          <div className="flex items-center justify-between">
            <h2 className="font-medium text-foreground">Programs</h2>
            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
            >
              <Plus className="h-4 w-4" />
              New program
            </button>
          </div>
          {createOpen && (
            <div className="rounded-xl border border-border bg-card p-4 space-y-3">
              <input
                type="text"
                placeholder="Program title"
                value={createTitle}
                onChange={(e) => setCreateTitle(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-border bg-background text-foreground"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleCreate}
                  disabled={createSubmitting || !createTitle.trim()}
                  className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {createSubmitting ? "Creating…" : "Create"}
                </button>
                <button type="button" onClick={() => setCreateOpen(false)} className="rounded-lg border border-border px-3 py-2 text-sm font-medium text-foreground">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {loading && <p className="text-sm text-muted-foreground">Loading…</p>}
          {!loading && programs.length === 0 && !createOpen && (
            <p className="text-sm text-muted-foreground py-4">No programs yet. Create one to invite creators from circles or KOL lists.</p>
          )}
          {!loading && programs.length > 0 && (
            <ul className="space-y-2">
              {programs.map((p) => (
                <li key={p.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
                  <div>
                    <span className="font-medium text-foreground">{p.title}</span>
                    <span className="ml-2 text-xs text-muted-foreground">({p.status})</span>
                    <p className="text-sm text-muted-foreground mt-0.5">{p.invites_count} invite(s)</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
