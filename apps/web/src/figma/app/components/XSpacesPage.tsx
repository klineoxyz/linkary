"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { Calendar, List, Plus, Clock, AlertCircle, X, ChevronLeft, ChevronRight } from "lucide-react";
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

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS_PER_DAY = 3;

function getMonthStart(year: number, month: number): Date {
  return new Date(year, month - 1, 1);
}
function getMonthEnd(year: number, month: number): Date {
  return new Date(year, month, 0, 23, 59, 59, 999);
}
function toYMD(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function getCalendarGrid(year: number, month: number): { date: Date; isCurrentMonth: boolean }[][] {
  const start = getMonthStart(year, month);
  const startDay = start.getDay();
  const monFirst = startDay === 0 ? 6 : startDay - 1;
  const startPad = new Date(start);
  startPad.setDate(startPad.getDate() - monFirst);
  const weeks: { date: Date; isCurrentMonth: boolean }[][] = [];
  let row: { date: Date; isCurrentMonth: boolean }[] = [];
  const cur = new Date(startPad);
  const end = getMonthEnd(year, month);
  const endTime = end.getTime();
  while (cur.getTime() <= endTime || row.length > 0) {
    row.push({ date: new Date(cur), isCurrentMonth: cur.getMonth() === month - 1 });
    if (row.length === 7) {
      weeks.push(row);
      row = [];
    }
    cur.setDate(cur.getDate() + 1);
  }
  if (row.length) {
    while (row.length < 7) {
      row.push({ date: new Date(cur), isCurrentMonth: false });
      cur.setDate(cur.getDate() + 1);
    }
    weeks.push(row);
  }
  return weeks;
}

export default function XSpacesPage({ setRoute, me }: { setRoute: (r: { name: string }) => void; me: { id: string } | null }) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"month" | "list">("list");
  const [calendarYear, setCalendarYear] = useState(() => new Date().getFullYear());
  const [calendarMonth, setCalendarMonth] = useState(() => new Date().getMonth() + 1);
  const [showCreate, setShowCreate] = useState(false);
  const [createPrefilledDate, setCreatePrefilledDate] = useState<string | null>(null);
  const [createTitle, setCreateTitle] = useState("");
  const [createDescription, setCreateDescription] = useState("");
  const [createScheduledAt, setCreateScheduledAt] = useState("");
  const [createDurationMins, setCreateDurationMins] = useState(60);
  const [overlaps, setOverlaps] = useState<Overlap[]>([]);
  const [overlapLabel, setOverlapLabel] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [detailsSpace, setDetailsSpace] = useState<Space | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [speakerRequesting, setSpeakerRequesting] = useState(false);

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

  const loadSpacesForMonth = useCallback(async (year: number, month: number) => {
    setLoading(true);
    const token = await getToken();
    const from = toYMD(getMonthStart(year, month));
    const to = toYMD(getMonthEnd(year, month));
    const params = new URLSearchParams({ from, to, scope: "public" });
    if (token) params.set("mine", "1");
    const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaces(data.spaces ?? []);
    setLoading(false);
  }, [base, getToken]);

  const spacesByDay = useMemo(() => {
    const map = new Map<string, Space[]>();
    for (const s of spaces) {
      if (!s.scheduled_at) continue;
      const day = s.scheduled_at.slice(0, 10);
      if (!map.has(day)) map.set(day, []);
      map.get(day)!.push(s);
    }
    for (const arr of map.values()) arr.sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));
    return map;
  }, [spaces]);

  useEffect(() => {
    if (view === "list") loadSpaces();
  }, [view, loadSpaces]);

  useEffect(() => {
    if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
  }, [view, calendarYear, calendarMonth, loadSpacesForMonth]);

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
      setCreatePrefilledDate(null);
      setCreateDurationMins(60);
      if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    } else {
      console.error(data.error || "Create failed");
    }
  };

  const upcoming = spaces.filter((s) => s.scheduled_at && new Date(s.scheduled_at) >= new Date()).sort((a, b) => (a.scheduled_at ?? "").localeCompare(b.scheduled_at ?? ""));

  const isHost = (s: Space) => me?.id && s.host_profile_id === me.id;
  const handleSaveEdit = async () => {
    if (!detailsSpace || !isHost(detailsSpace)) return;
    setEditSaving(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ title: editTitle.trim() }),
    });
    setEditSaving(false);
    if (res.ok) {
      setDetailsSpace(null);
      if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    }
  };
  const handleCancelSpace = async () => {
    if (!detailsSpace || !isHost(detailsSpace)) return;
    setEditSaving(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ status: "cancelled" }),
    });
    setEditSaving(false);
    if (res.ok) {
      setDetailsSpace(null);
      if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    }
  };
  const handleRequestSpeaker = async () => {
    if (!detailsSpace || !me?.id || isHost(detailsSpace)) return;
    setSpeakerRequesting(true);
    const token = await getToken();
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}/speaker-request`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
    setSpeakerRequesting(false);
    if (res.ok) setDetailsSpace(null);
  };

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
              onClick={() => { setCreatePrefilledDate(null); setCreateScheduledAt(""); setShowCreate(true); }}
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
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white/50 dark:bg-zinc-900/50 overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-zinc-200 dark:border-zinc-700">
            <button type="button" onClick={() => { if (calendarMonth === 1) { setCalendarYear((y) => y - 1); setCalendarMonth(12); } else setCalendarMonth((m) => m - 1); }} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {new Date(calendarYear, calendarMonth - 1).toLocaleDateString("default", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => { if (calendarMonth === 12) { setCalendarYear((y) => y + 1); setCalendarMonth(1); } else setCalendarMonth((m) => m + 1); }} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-zinc-600 dark:text-zinc-400 border-b border-zinc-200 dark:border-zinc-700">
            {WEEKDAY_LABELS.map((l) => (
              <div key={l} className="py-2">{l}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getCalendarGrid(calendarYear, calendarMonth).map((week, wi) => (
              <React.Fragment key={wi}>
                {week.map((cell, di) => {
                  const ymd = toYMD(cell.date);
                  const daySpaces = spacesByDay.get(ymd) ?? [];
                  const visible = daySpaces.slice(0, MAX_EVENTS_PER_DAY);
                  const more = daySpaces.length - MAX_EVENTS_PER_DAY;
                  return (
                    <div
                      key={di}
                      onClick={() => {
                        if (me?.id) {
                          setCreatePrefilledDate(ymd);
                          setCreateScheduledAt(ymd + "T12:00");
                          setShowCreate(true);
                        }
                      }}
                      className={`min-h-[100px] p-1.5 border-b border-r border-zinc-200 dark:border-zinc-700 last:border-r-0 ${cell.isCurrentMonth ? "bg-white dark:bg-zinc-900" : "bg-zinc-50 dark:bg-zinc-800/50"} ${me?.id ? "cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-800" : ""}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${cell.isCurrentMonth ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                        {cell.date.getDate()}
                      </div>
                      {visible.map((s) => (
                        <div
                          key={s.id}
                          onClick={(e) => { e.stopPropagation(); setDetailsSpace(s); setEditTitle(s.title); }}
                          className="text-xs truncate rounded px-1 py-0.5 bg-primary/10 text-primary dark:bg-primary/20 mb-0.5 cursor-pointer hover:bg-primary/20 dark:hover:bg-primary/30"
                        >
                          {s.title}
                        </div>
                      ))}
                      {more > 0 && <div className="text-xs text-zinc-500 px-1">+{more} more</div>}
                    </div>
                  );
                })}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); }} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 z-50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Create X Space</h2>
              <button type="button" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); }} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
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
              <button type="button" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); }} className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300">Cancel</button>
              <button type="button" onClick={handleCreate} disabled={saving || !createTitle.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                {saving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </>
      )}

      {detailsSpace && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDetailsSpace(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 z-50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Space details</h2>
              <button type="button" onClick={() => setDetailsSpace(null)} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {isHost(detailsSpace) ? (
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100" />
              ) : (
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{detailsSpace.title}</p>
              )}
              <p className="text-sm text-zinc-500">
                {detailsSpace.scheduled_at ? new Date(detailsSpace.scheduled_at).toLocaleString() : "—"}
                {detailsSpace.duration_mins ? ` · ${detailsSpace.duration_mins} min` : ""}
              </p>
              {detailsSpace.description && <p className="text-sm text-zinc-600 dark:text-zinc-400">{detailsSpace.description}</p>}
            </div>
            <div className="flex justify-end gap-2">
              {isHost(detailsSpace) ? (
                <>
                  <button type="button" onClick={handleCancelSpace} disabled={editSaving} className="px-4 py-2 rounded-lg border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/20 disabled:opacity-50">
                    {editSaving ? "…" : "Cancel space"}
                  </button>
                  <button type="button" onClick={handleSaveEdit} disabled={editSaving || !editTitle.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                    {editSaving ? "…" : "Save"}
                  </button>
                </>
              ) : me?.id ? (
                <button type="button" onClick={handleRequestSpeaker} disabled={speakerRequesting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                  {speakerRequesting ? "…" : "Request speaker"}
                </button>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
