"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Calendar, List, Plus, Clock, Mic, AlertCircle, X } from "lucide-react";
import { supabase } from "@/lib/supabase";

type Space = {
  id: string;
  host_profile_id: string;
  title: string;
  description: string | null;
  scheduled_at: string | null;
  duration_mins: number | null;
  status: string;
  created_at: string;
};

type Overlap = { id: string; title: string; scheduled_at: string; host_profile_id: string; duration_mins: number | null };

export default function XSpacesPage({ setRoute, me }: { setRoute: (r: { name: string }) => void; me: { id: string } | null }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "list">("list");
  const [showCreate, setShowCreate] = useState(false);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  const [createDurationMins, setCreateDurationMins] = useState(60);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [overlapLabel, setOverlapLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const base = typeof window !== "undefined" ? window.location.origin : "";
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, []);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const params = new URLSearchParams({ upcoming: "1" });
    const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaces(data.spaces ?? []);
    setLoading(false);
  }, [base, getToken]);

  useEffect(() => {
    loadSpaces();
  }, [loadSpaces]);

  const checkOverlaps = useCallback(async (scheduledAt: string, durationMins: number, excludeSpaceId?: string) => {
    if (!scheduledAt) return;
    const params = new URLSearchParams({ scheduled_at: scheduledAt, duration_mins: String(durationMins) });
    if (excludeSpaceId) params.set("exclude_space_id", excludeSpaceId);
    const res = await fetch(`${base}/api/spaces/overlaps?${params}`);
    const data = await res.json().catch(() => ({}));
    setOverlaps(data.overlaps ?? []);
    setOverlapLabel(data.overlaps?.length ? `Conflict: ${data.overlaps.length} space(s) within ±60 min` : null);
  }, [base]);

  useEffect(() => {
    if (showCreate && createScheduledAt) {
      checkOverlaps(createScheduledAt, createDurationMins);
    } else {
      setOverlaps([]);
      setOverlapLabel(null);
    }
  }, [showCreate, createScheduledAt, createDurationMins, checkOverlaps]);

  const handleCreate = async () => {
    if (!createTitle.trim() || !me?.id) return;
    setSaving(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        scheduled_at: createScheduledAt || null,
        duration_mins: createDurationMins,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (data.id) {
      setShowCreate(false);
      setCreateTitle("");
      setCreateDescription("");
      setCreateScheduledAt("");
      setCreateDurationMins(60);
      loadSpaces();
    } else {
      console.error(data.error || "Create failed");
    }
  };

  const upcoming = spaces.filter((s) => s.scheduled_at && new Date(s.scheduled_at) >= new Date()).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">XSpaces</h1>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setView(view === "list" ? "month" : "list")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm"
          >
            {view === "list" ? <Calendar className="w-4 h-4" /> : <List className="w-4 h-4" />}
            {view === "list" ? "Month" : "List"}
          </button>
          {me?.id && (
            <button
              type="button"
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
            >
              <Plus className="w-4 h-4" /> Create Space
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <p className="text-zinc-500">Loading spaces…</p>
      ) : view === "list" ? (
        <div className="space-y-3">
          {upcoming.length === 0 ? (
            <p className="text-zinc-500">No upcoming spaces. Create one to get started.</p>
          ) : (
            upcoming.map((s) => (
              <div
                key={s.id}
                className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 flex items-center gap-4"
              >
                <Clock className="w-5 h-5 text-zinc-400" />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.title}</p>
                  <p className="text-sm text-zinc-500">
                    {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : "—"} {s.duration_mins ? ` · ${s.duration_mins} min` : ""}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400">{s.status}</span>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="p-6 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 text-center text-zinc-500">
          Calendar month view: events from list above. (Use List view for upcoming.)
        </div>
      )}

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowCreate(false)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 z-50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create X Space</h2>
              <button type="button" onClick={() => setShowCreate(false)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                <input type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Space title" className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description (optional)</label>
                <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Scheduled at (ISO)</label>
                <input type="datetime-local" value={createScheduledAt} onChange={(e) => setCreateScheduledAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Duration (mins)</label>
                <input type="number" min={1} value={createDurationMins} onChange={(e) => setCreateDurationMins(parseInt(e.target.value, 10) || 60)} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
              </div>
              {overlapLabel && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 text-sm">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {overlapLabel}
                  {overlaps.length > 0 && (
                    <ul className="list-disc list-inside text-xs mt-1">
                      {overlaps.slice(0, 3).map((o) => (
                        <li key={o.id}>{o.title} — {new Date(o.scheduled_at).toLocaleString()}</li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
              <p className="text-xs text-zinc-500">Overlap: {overlaps.length ? "conflicts detected (±60 min)" : "unavailable (MVP)"}</p>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setShowCreate(false)} className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={saving || !createTitle.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
