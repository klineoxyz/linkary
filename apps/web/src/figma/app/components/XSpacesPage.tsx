"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
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
  x_space_id?: string | null;
  x_space_url?: string | null;
};

type Overlap = { id: string; title: string; scheduled_at: string; host_profile_id: string; duration_mins: number | null };

type AudienceOverlap = {
  other_space_id: string;
  other_space_title: string;
  other_host_username: string | null;
  overlap_percent: number;
  overlap_count: number;
  min_audience_size: number;
};

const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MAX_EVENTS_PER_DAY = 3;

function DiscoverTab({
  loadDiscover,
  onSpaceClick,
}: {
  loadDiscover: () => Promise<Space[]>;
  onSpaceClick: (s: Space) => void;
}) {
  const [list, setList] = useState<Space[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    loadDiscover().then((data) => {
      if (!cancelled) setList(data);
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [loadDiscover]);
  if (loading) return <p className="text-zinc-500">Loading…</p>;
  if (list.length === 0) return <p className="text-zinc-500">No public spaces yet. Invite others.</p>;
  return (
    <div className="space-y-3">
      {list.map((s) => (
        <div
          key={s.id}
          className="p-4 rounded-xl border border-border bg-card flex items-center gap-4 cursor-pointer hover:border-primary/20 transition-all"
          onClick={() => onSpaceClick(s)}
          onKeyDown={(e) => e.key === "Enter" && onSpaceClick(s)}
          role="button"
          tabIndex={0}
        >
          <Clock className="w-5 h-5 text-zinc-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.title}</p>
            <p className="text-sm text-zinc-500">
              {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : "—"} · {s.status}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}

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
  const [speakerRequestMessage, setSpeakerRequestMessage] = useState("");
  const [showAddFromX, setShowAddFromX] = useState(false);
  const [addFromXUrl, setAddFromXUrl] = useState("");
  const [addFromXSaving, setAddFromXSaving] = useState(false);
  const [addFromXError, setAddFromXError] = useState<string | null>(null);
  const [audienceOverlapsBySpaceId, setAudienceOverlapsBySpaceId] = useState<Record<string, AudienceOverlap[]>>({});
  const [overlapsError, setOverlapsError] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"my" | "discover" | "past" | "overlap-alerts">("my");
  const [addFromXSuccess, setAddFromXSuccess] = useState<{ participants_count: number; overlaps: AudienceOverlap[] } | null>(null);
  const [createCohosts, setCreateCohosts] = useState("");
  const [createXSpaceUrl, setCreateXSpaceUrl] = useState("");
  const [overlapsLoading, setOverlapsLoading] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [pastSpaces, setPastSpaces] = useState<Space[]>([]);
  const [pastStatsBySpaceId, setPastStatsBySpaceId] = useState<Record<string, { listeners_total?: number; peak_listeners?: number; duration_seconds?: number }>>({});
  const [pastLoading, setPastLoading] = useState(false);
  const [rsvpStatus, setRsvpStatus] = useState<Record<string, "interested" | "going">>({});
  const [createOnX, setCreateOnX] = useState(true);
  const [createJustDoneSpaceId, setCreateJustDoneSpaceId] = useState<string | null>(null);
  const [detectingSpace, setDetectingSpace] = useState(false);
  const [detectError, setDetectError] = useState<string | null>(null);
  const [xConnected, setXConnected] = useState<boolean | null>(null);
  const [spaceRsvps, setSpaceRsvps] = useState<{ total: number; going_count: number; interested_count: number; attendees?: Array<{ profile_id: string; status: string; username?: string | null }> } | null>(null);
  const [detectCandidates, setDetectCandidates] = useState<Array<{ id: string; title: string | null; state: string | null; created_at: string | null; scheduled_start: string | null; score: number }>>([]);
  const [spaceSpeakerRequests, setSpaceSpeakerRequests] = useState<Array<{ id: string; requester_profile_id: string; status: string; message: string | null; created_at: string; updated_at: string | null; username: string | null }>>([]);
  const [resolvingRequestId, setResolvingRequestId] = useState<string | null>(null);
  const [linkXSpaceUrl, setLinkXSpaceUrl] = useState("");
  const [linkXSpaceSaving, setLinkXSpaceSaving] = useState(false);
  const [showLinkXSpace, setShowLinkXSpace] = useState(false);

  const searchParams = useSearchParams();
  const debug = searchParams?.get("debug") === "1";
  const base = typeof window !== "undefined" ? window.location.origin : "";
  const getToken = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session?.access_token ?? "";
  }, []);

  const loadSpaces = useCallback(async () => {
    setLoading(true);
    const token = await getToken();
    const params = new URLSearchParams();
    if (token) params.set("mine", "1");
    else params.set("upcoming", "1");
    const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaces(data.spaces ?? []);
    setLoading(false);
  }, [base, getToken]);

  const loadDiscover = useCallback(async () => {
    const token = await getToken();
    const params = new URLSearchParams({ upcoming: "1" });
    const res = await fetch(`${base}/api/spaces?${params}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    return data.spaces ?? [];
  }, [base, getToken]);

  const loadPast = useCallback(async () => {
    setPastLoading(true);
    const res = await fetch(`${base}/api/xspaces/past`);
    const data = await res.json().catch(() => ({}));
    setPastSpaces(data.spaces ?? []);
    setPastStatsBySpaceId(data.statsBySpaceId ?? {});
    setPastLoading(false);
  }, [base]);

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

  useEffect(() => {
    if (activeTab === "past") loadPast();
  }, [activeTab, loadPast]);

  useEffect(() => {
    if (!me?.id || !base) return;
    let cancelled = false;
    const token = getToken();
    token.then((t) => {
      if (!t || cancelled) return;
      fetch(`${base}/api/x/me`, { headers: { Authorization: `Bearer ${t}` } })
        .then((r) => r.json())
        .then((d) => { if (!cancelled) setXConnected(d?.connected === true); })
        .catch(() => { if (!cancelled) setXConnected(false); });
    });
    return () => { cancelled = true; };
  }, [me?.id, base, getToken]);

  const loadDetailRsvps = useCallback(async (spaceId: string) => {
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/${spaceId}/rsvps`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaceRsvps(data?.total != null ? { total: data.total, going_count: data.going_count ?? 0, interested_count: data.interested_count ?? 0, attendees: data.attendees } : null);
  }, [base, getToken]);

  const loadDetailSpeakerRequests = useCallback(async (spaceId: string) => {
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/${spaceId}/speaker-requests`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    const data = await res.json().catch(() => ({}));
    setSpaceSpeakerRequests(Array.isArray(data?.requests) ? data.requests : []);
  }, [base, getToken]);

  useEffect(() => {
    if (!detailsSpace) {
      setSpaceRsvps(null);
      setSpaceSpeakerRequests([]);
      setShowLinkXSpace(false);
      return;
    }
    loadDetailRsvps(detailsSpace.id);
    if (me?.id && detailsSpace.host_profile_id === me.id) loadDetailSpeakerRequests(detailsSpace.id);
  }, [detailsSpace?.id, detailsSpace?.host_profile_id, me?.id, loadDetailRsvps, loadDetailSpeakerRequests]);

  const loadAudienceOverlaps = useCallback(
    async (spaceIds: string[]) => {
      if (!me?.id || spaceIds.length === 0) return;
      const token = await getToken();
      if (!token) return;
      setOverlapsError(false);
      setOverlapsLoading(true);
      const next: Record<string, AudienceOverlap[]> = {};
      let hadError = false;
      for (const id of spaceIds) {
        try {
          const res = await fetch(`${base}/api/spaces/audience-overlaps?space_id=${encodeURIComponent(id)}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const data = await res.json().catch(() => ({}));
          next[id] = Array.isArray(data.overlaps) ? data.overlaps : [];
          if (!res.ok) hadError = true;
        } catch {
          hadError = true;
        }
      }
      if (hadError) setOverlapsError(true);
      setAudienceOverlapsBySpaceId((prev) => ({ ...prev, ...next }));
      setOverlapsLoading(false);
    },
    [base, getToken, me?.id]
  );

  useEffect(() => {
    const withX = spaces.filter((s) => s.x_space_id && me?.id && s.host_profile_id === me.id).map((s) => s.id);
    if (withX.length > 0) loadAudienceOverlaps(withX);
    else setOverlapsLoading(false);
  }, [spaces, me?.id, loadAudienceOverlaps]);

  const [overlapsSkeletonShown, setOverlapsSkeletonShown] = useState(false);
  useEffect(() => {
    if (!overlapsLoading) return;
    const t = setTimeout(() => setOverlapsSkeletonShown(true), 1000);
    return () => clearTimeout(t);
  }, [overlapsLoading]);
  useEffect(() => {
    if (!overlapsLoading) setOverlapsSkeletonShown(false);
  }, [overlapsLoading]);

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
    if (!createScheduledAt.trim()) return;
    setSaving(true);
    const token = await getToken();
    const scheduledAtIso = new Date(createScheduledAt).toISOString();
    const res = await fetch(`${base}/api/spaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        title: createTitle.trim(),
        description: createDescription.trim() || null,
        scheduled_at: scheduledAtIso,
        duration_mins: createDurationMins,
        status: "planned",
        cohosts: createCohosts.trim() || undefined,
        x_space_url: createXSpaceUrl.trim() || undefined,
      }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (data.id) {
      if (createOnX) {
        setCreateJustDoneSpaceId(data.id);
        setDetectError(null);
      } else {
        setShowCreate(false);
        setCreateTitle("");
        setCreateDescription("");
        setCreateScheduledAt("");
        setCreatePrefilledDate(null);
        setCreateDurationMins(60);
        setCreateCohosts("");
        setCreateXSpaceUrl("");
        setCreateError(null);
      }
      if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
      else loadSpaces();
    } else {
      setCreateError(data.message || data.error || "Create failed");
    }
  };

  const isHost = (s: Space) => me?.id && s.host_profile_id === me.id;
  const mySpaces = spaces.filter((s) => isHost(s));
  const upcoming = spaces
    .filter(
      (s) =>
        s.status === "planned" ||
        (s.scheduled_at && new Date(s.scheduled_at) >= new Date())
    )
    .sort((a, b) => (a.scheduled_at ?? "9999").localeCompare(b.scheduled_at ?? "9999"));
  const overlapAlertsList = useMemo(() => {
    const list: { space: Space; overlap: AudienceOverlap }[] = [];
    mySpaces.forEach((s) => {
      (audienceOverlapsBySpaceId[s.id] ?? []).forEach((o) => {
        if (o.overlap_percent >= 5) list.push({ space: s, overlap: o });
      });
    });
    list.sort((a, b) => b.overlap.overlap_percent - a.overlap.overlap_percent);
    return list;
  }, [mySpaces, audienceOverlapsBySpaceId]);

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
  const clearCreateAndRefresh = useCallback(() => {
    setCreateJustDoneSpaceId(null);
    setShowCreate(false);
    setCreateTitle("");
    setCreateDescription("");
    setCreateScheduledAt("");
    setCreatePrefilledDate(null);
    setCreateDurationMins(60);
    setCreateCohosts("");
    setCreateXSpaceUrl("");
    setCreateError(null);
    setDetectCandidates([]);
    setDetectError(null);
    if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
    else loadSpaces();
  }, [view, calendarYear, calendarMonth, loadSpaces, loadSpacesForMonth]);

  const handleDetectMySpace = useCallback(async () => {
    const spaceId = createJustDoneSpaceId;
    if (!spaceId) return;
    setDetectingSpace(true);
    setDetectError(null);
    setDetectCandidates([]);
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/detect-my-space`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ space_id: spaceId }),
    });
    const data = await res.json().catch(() => ({}));
    setDetectingSpace(false);
    if (res.status === 429) {
      setDetectError(data.error ?? "Too many attempts. Wait a minute and try again.");
      return;
    }
    if (data.found && data.require_selection && Array.isArray(data.candidates)) {
      setDetectCandidates(data.candidates);
      setDetectError(null);
      return;
    }
    if (data.found && data.linked) {
      setDetectCandidates([]);
      clearCreateAndRefresh();
      return;
    }
    if (data.found === false) {
      setDetectError("No match found — paste the X Space link below.");
      return;
    }
    if (!res.ok) {
      setDetectError("Something went wrong. You can retry or paste the link below.");
    }
  }, [base, createJustDoneSpaceId, getToken, clearCreateAndRefresh]);

  const handleSelectDetectCandidate = useCallback(async (xSpaceId: string) => {
    const spaceId = createJustDoneSpaceId;
    if (!spaceId) return;
    setDetectingSpace(true);
    setDetectError(null);
    const token = await getToken();
    const res = await fetch(`${base}/api/xspaces/link-space`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ space_id: spaceId, x_space_id: xSpaceId }),
    });
    const data = await res.json().catch(() => ({}));
    setDetectingSpace(false);
    if (res.ok && data.x_space_id) {
      setDetectCandidates([]);
      clearCreateAndRefresh();
    } else {
      setDetectError(data.error ?? "Failed to link. Try paste fallback.");
    }
  }, [base, createJustDoneSpaceId, getToken, clearCreateAndRefresh]);

  const handleRequestSpeaker = async () => {
    if (!detailsSpace || !me?.id || isHost(detailsSpace)) return;
    setSpeakerRequesting(true);
    const token = await getToken();
    const body = speakerRequestMessage.trim() ? { message: speakerRequestMessage.trim().slice(0, 500) } : {};
    const res = await fetch(`${base}/api/spaces/${detailsSpace.id}/speaker-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    setSpeakerRequesting(false);
    if (res.ok) {
      setSpeakerRequestMessage("");
      setDetailsSpace(null);
    }
  };

  function OverlapText({ o }: { o: AudienceOverlap }) {
    const pct = Number(o.overlap_percent);
    const isRed = pct >= 5.0;
    const pctDisplay = Number.isFinite(pct) ? pct.toFixed(1) : "0.0";
    return (
      <span className={isRed ? "text-red-600 dark:text-red-400 font-medium" : ""}>
        Audience overlap: {pctDisplay}% ({o.overlap_count} users)
      </span>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">X Spaces</h1>
          <p className="mt-2 text-sm text-muted-foreground">Create and manage your X Spaces. Link to X to auto-detect new Spaces.</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {me?.id && (
            <>
              {xConnected === false && (
                <button
                  type="button"
                  onClick={async () => {
                    const token = await getToken();
                    const res = await fetch(`${base}/api/x/connect`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, redirect: "manual" });
                    if (res.status === 302) {
                      const url = res.headers.get("Location");
                      if (url) window.location.href = url;
                    }
                  }}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent"
                >
                  Connect X
                </button>
              )}
              <button
                type="button"
                onClick={() => { setCreatePrefilledDate(null); setCreateScheduledAt(""); setCreateError(null); setCreateJustDoneSpaceId(null); setShowCreate(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> Create Space
              </button>
              <button
                type="button"
                onClick={() => { setAddFromXUrl(""); setAddFromXError(null); setAddFromXSuccess(null); setShowAddFromX(true); }}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent"
              >
                Add from X
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setView(view === "list" ? "month" : "list")}
            className="flex items-center gap-2 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 text-sm"
          >
            {view === "list" ? <Calendar className="w-4 h-4" /> : <List className="w-4 h-4" />}
            {view === "list" ? "Month" : "List"}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700">
        {(["my", "discover", "past", "overlap-alerts"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTab === tab
                ? "bg-primary/10 text-primary border-b-2 border-primary"
                : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            }`}
          >
            {tab === "my" ? "My Spaces" : tab === "discover" ? "Discover" : tab === "past" ? "Past" : "Overlap Alerts"}
            {tab === "overlap-alerts" && overlapAlertsList.length > 0 && (
              <span className="ml-1.5 rounded-full bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300 px-1.5 py-0.5 text-xs">
                {overlapAlertsList.length}
              </span>
            )}
          </button>
        ))}
      </div>

      {debug && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 p-4 text-sm">
          <p className="font-medium text-amber-800 dark:text-amber-200 mb-2">Debug (/?debug=1)</p>
          {mySpaces.map((s) => {
            const overlaps = audienceOverlapsBySpaceId[s.id] ?? [];
            return (
              <div key={s.id} className="mb-3 pl-2 border-l-2 border-amber-300 dark:border-amber-700">
                <p className="font-medium text-zinc-900 dark:text-zinc-100">{s.title}</p>
                {!s.x_space_id ? (
                  <p className="text-amber-700 dark:text-amber-300">Participants not synced</p>
                ) : (
                  <>
                    <p className="text-zinc-600 dark:text-zinc-400">x_space_id: {s.x_space_id}</p>
                    {overlaps.length > 0 && (
                      <ul className="mt-1 text-zinc-600 dark:text-zinc-400">
                        {overlaps.slice(0, 5).map((o) => (
                          <li key={o.other_space_id}>
                            overlap_count={o.overlap_count}, min_audience_size={o.min_audience_size}, %={Number(o.overlap_percent).toFixed(1)}
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {addFromXSuccess && (
        <div className="p-4 rounded-xl border border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200">
          <p className="font-medium mb-1">Space synced from X</p>
          <p className="text-sm mb-2">Participants captured: {addFromXSuccess.participants_count}</p>
          {addFromXSuccess.overlaps.length > 0 && (
            <p className="text-sm font-medium mt-2">Top overlaps:</p>
          )}
          <ul className="text-sm list-disc list-inside mt-1">
            {addFromXSuccess.overlaps.slice(0, 3).map((o, i) => (
              <li key={i}>
                @{o.other_host_username ?? "user"} — <OverlapText o={o} />
              </li>
            ))}
          </ul>
          <button type="button" onClick={() => setAddFromXSuccess(null)} className="mt-2 text-sm underline">Dismiss</button>
        </div>
      )}

      {loading && activeTab !== "past" ? (
        <p className="text-zinc-500">Loading spaces…</p>
      ) : activeTab === "past" ? (
        <div className="space-y-3">
          {pastLoading ? (
            <p className="text-zinc-500">Loading past spaces…</p>
          ) : pastSpaces.length === 0 ? (
            <p className="text-zinc-500">No ended spaces yet. Stats will appear here once spaces are marked ended.</p>
          ) : (
            pastSpaces.map((s) => {
              const stats = pastStatsBySpaceId[s.id];
              return (
                <div key={s.id} className="p-4 rounded-xl border border-border bg-card">
                  <p className="font-medium text-foreground">{s.title}</p>
                  <p className="text-sm text-zinc-500">
                    {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : "—"} · ended
                  </p>
                  {stats && (stats.listeners_total != null || stats.peak_listeners != null || stats.duration_seconds != null) && (
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                      {stats.listeners_total != null && `Listeners: ${stats.listeners_total}`}
                      {stats.peak_listeners != null && ` · Peak: ${stats.peak_listeners}`}
                      {stats.duration_seconds != null && ` · Duration: ${Math.round(stats.duration_seconds / 60)} min`}
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === "overlap-alerts" ? (
        <div className="space-y-3">
          {overlapsError && (
            <p className="text-sm text-amber-700 dark:text-amber-300">Overlaps unavailable.</p>
          )}
          {!overlapsLoading && overlapAlertsList.length === 0 && !overlapsError && (
            <p className="text-zinc-500">No overlap alerts. You are clear.</p>
          )}
          {(overlapsLoading && !overlapsSkeletonShown) && (
            <div className="animate-pulse space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-16 rounded-xl bg-muted" />
              ))}
            </div>
          )}
          {!overlapsLoading && overlapAlertsList.map(({ space, overlap }) => (
            <div key={`${space.id}-${overlap.other_space_id}`} className="p-4 rounded-xl border border-border bg-card">
              <p className="font-medium text-zinc-900 dark:text-zinc-100">{space.title}</p>
              <p className="text-sm text-zinc-500 mb-2">
                Your space {space.scheduled_at ? new Date(space.scheduled_at).toLocaleString() : ""}
              </p>
              <p className="text-sm">
                ↔ @{overlap.other_host_username ?? "user"} — {overlap.other_space_title} — <OverlapText o={overlap} />
              </p>
            </div>
          ))}
        </div>
      ) : activeTab === "discover" ? (
        <DiscoverTab loadDiscover={loadDiscover} onSpaceClick={(s) => { setDetailsSpace(s); setEditTitle(s.title); setSpeakerRequestMessage(""); }} />
      ) : activeTab === "my" && view === "list" ? (
        <div className="space-y-3">
          {overlapsError && (
            <p className="text-sm text-amber-700 dark:text-amber-300">Overlaps unavailable.</p>
          )}
          {upcoming.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-8 text-center">
              <p className="text-muted-foreground mb-4">No upcoming spaces yet.</p>
              {me?.id && (
                <div className="flex flex-wrap justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => { setCreatePrefilledDate(null); setCreateScheduledAt(""); setCreateError(null); setShowCreate(true); }}
                    className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
                  >
                    Create Space
                  </button>
                  <button
                    type="button"
                    onClick={() => { setAddFromXUrl(""); setAddFromXError(null); setShowAddFromX(true); }}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 text-sm font-medium"
                  >
                    Add from X
                  </button>
                </div>
              )}
            </div>
          ) : (
            upcoming.map((s) => {
              const audienceOverlaps = audienceOverlapsBySpaceId[s.id] ?? [];
              return (
                <div
                  key={s.id}
                  className="p-4 rounded-xl border border-border bg-card flex flex-col gap-2"
                >
                  <div className="flex items-center gap-4">
                    <Clock className="w-5 h-5 text-zinc-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-zinc-900 dark:text-zinc-100 truncate">{s.title}</p>
                      <p className="text-sm text-zinc-500">
                        {s.scheduled_at ? new Date(s.scheduled_at).toLocaleString() : "—"} {s.duration_mins ? ` · ${s.duration_mins} min` : ""}
                      </p>
                    </div>
                    <span className="text-xs px-2 py-1 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 shrink-0">{s.status}</span>
                  </div>
                  {audienceOverlaps.length > 0 && (
                    <div className="flex items-start gap-2 pl-9 text-sm">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                      <span>
                        {audienceOverlaps.map((o, i) => (
                          <span key={o.other_space_id}>
                            {i > 0 && "; "}
                            @{o.other_host_username ?? "user"}: <OverlapText o={o} />
                          </span>
                        ))}
                      </span>
                    </div>
                  )}
                  <div className="pl-9 flex gap-2">
                    <button type="button" onClick={() => { setDetailsSpace(s); setEditTitle(s.title); setSpeakerRequestMessage(""); }} className="text-sm text-primary hover:underline">Details</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : activeTab === "my" && view === "month" ? (
        <div className="rounded-xl border border-border bg-card overflow-hidden">
          <div className="flex items-center justify-between p-3 border-b border-border">
            <button type="button" onClick={() => { if (calendarMonth === 1) { setCalendarYear((y) => y - 1); setCalendarMonth(12); } else setCalendarMonth((m) => m - 1); }} className="p-2 rounded-lg hover:bg-accent">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <span className="font-semibold text-foreground">
              {new Date(calendarYear, calendarMonth - 1).toLocaleDateString("default", { month: "long", year: "numeric" })}
            </span>
            <button type="button" onClick={() => { if (calendarMonth === 12) { setCalendarYear((y) => y + 1); setCalendarMonth(1); } else setCalendarMonth((m) => m + 1); }} className="p-2 rounded-lg hover:bg-accent">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 text-center text-xs font-medium text-muted-foreground border-b border-border">
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
                      className={`min-h-[100px] p-1.5 border-b border-r border-border last:border-r-0 ${cell.isCurrentMonth ? "bg-card" : "bg-muted/30"} ${me?.id ? "cursor-pointer hover:bg-accent" : ""}`}
                    >
                      <div className={`text-sm font-medium mb-1 ${cell.isCurrentMonth ? "text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                        {cell.date.getDate()}
                      </div>
                      {visible.map((s) => (
                        <div
                          key={s.id}
                          onClick={(e) => { e.stopPropagation(); setDetailsSpace(s); setEditTitle(s.title); setSpeakerRequestMessage(""); }}
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
      ) : null}

      {showCreate && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); setCreateError(null); setCreateJustDoneSpaceId(null); setDetectError(null); setDetectCandidates([]); }} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-2xl border border-border bg-card backdrop-blur-xl p-6 z-50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Create X Space</h2>
              <button type="button" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); setCreateError(null); setCreateJustDoneSpaceId(null); setDetectError(null); setDetectCandidates([]); }} className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                <X className="w-5 h-5" />
              </button>
            </div>
            {createError && (
              <p className="mb-3 text-sm text-red-600 dark:text-red-400">{createError}</p>
            )}
            {createJustDoneSpaceId ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Space created on Linkary. Now link it to X:</p>
                <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                  {xConnected !== true && (
                    <p className="text-sm text-amber-600 dark:text-amber-400">1. Connect X first (button above) so we can detect your Space.</p>
                  )}
                  <p className="font-medium text-foreground">2. Open X and create your Space</p>
                  <a href="https://x.com/i/spaces" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:opacity-90">
                    Open X Spaces
                  </a>
                  <p className="text-xs text-muted-foreground">Create a new Space on X, then return here.</p>
                  <p className="font-medium text-foreground">3. Detect my Space</p>
                  <button type="button" onClick={handleDetectMySpace} disabled={detectingSpace || xConnected !== true} className="px-4 py-2 rounded-lg border border-border bg-secondary hover:bg-accent text-foreground text-sm font-medium disabled:opacity-50">
                    {detectingSpace ? "Detecting…" : "Detect my Space"}
                  </button>
                  {detectingSpace && <p className="text-sm text-muted-foreground">Checking your recent X Spaces…</p>}
                  {!detectingSpace && detectCandidates.length > 0 && (
                    <p className="text-sm text-muted-foreground">Found {detectCandidates.length} candidate{detectCandidates.length !== 1 ? "s" : ""} — pick the right one:</p>
                  )}
                  {detectCandidates.length > 0 ? (
                    <div className="space-y-2">
                      {detectCandidates.map((c) => (
                        <button key={c.id} type="button" onClick={() => handleSelectDetectCandidate(c.id)} disabled={detectingSpace} className="w-full text-left px-3 py-2 rounded-lg border border-border bg-card hover:bg-accent text-foreground text-sm disabled:opacity-50">
                          {c.title || c.id} {c.scheduled_start ? ` · ${new Date(c.scheduled_start).toLocaleString()}` : ""}
                        </button>
                      ))}
                    </div>
                  )}
                  {detectError && (
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-amber-600 dark:text-amber-400">{detectError}</p>
                      <button type="button" onClick={() => { setDetectError(null); handleDetectMySpace(); }} disabled={detectingSpace || xConnected !== true} className="px-3 py-1.5 rounded-lg border border-border bg-secondary hover:bg-accent text-foreground text-sm font-medium disabled:opacity-50">
                        Retry
                      </button>
                    </div>
                  )}
                  <p className="text-xs text-muted-foreground pt-2 border-t border-border">If detection fails, paste the X Space link below (fallback):</p>
                  <input type="url" value={createXSpaceUrl} onChange={(e) => setCreateXSpaceUrl(e.target.value)} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                  {createXSpaceUrl.trim() && (
                    <button type="button" onClick={async () => {
                      setDetectError(null);
                      const token = await getToken();
                      const res = await fetch(`${base}/api/spaces/sync-from-x`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ space_url: createXSpaceUrl.trim() }) });
                      const data = await res.json().catch(() => ({}));
                      if (data.space) {
                        setCreateJustDoneSpaceId(null); setShowCreate(false); setCreateTitle(""); setCreateDescription(""); setCreateScheduledAt(""); setCreatePrefilledDate(null); setCreateDurationMins(60); setCreateCohosts(""); setCreateXSpaceUrl(""); setCreateError(null);
                        if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth); else loadSpaces();
                      } else setDetectError(data.message ?? data.error ?? "Failed to link.");
                    }} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm">Link pasted URL</button>
                  )}
                </div>
              </div>
            ) : (
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={createOnX} onChange={(e) => setCreateOnX(e.target.checked)} className="rounded border-border" />
                <span className="text-sm font-medium text-foreground">Create on X (recommended)</span>
              </label>
              {createOnX && xConnected === false && (
                <p className="text-sm text-amber-600 dark:text-amber-400">Connect X first (Settings → Integrations or use Connect X below) to auto-detect your Space.</p>
              )}
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Title</label>
                <input type="text" value={createTitle} onChange={(e) => setCreateTitle(e.target.value)} placeholder="Space title" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Description (optional)</label>
                <textarea value={createDescription} onChange={(e) => setCreateDescription(e.target.value)} rows={2} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Scheduled at (required, local time)</label>
                <input type="datetime-local" value={createScheduledAt} onChange={(e) => setCreateScheduledAt(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Duration (mins)</label>
                <input type="number" min={1} value={createDurationMins} onChange={(e) => setCreateDurationMins(parseInt(e.target.value, 10) || 60)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">Cohosts (optional)</label>
                <input type="text" value={createCohosts} onChange={(e) => setCreateCohosts(e.target.value)} placeholder="@user1 @user2" className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              {!createOnX && (
              <div>
                <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1">X Space URL (optional)</label>
                <input type="url" value={createXSpaceUrl} onChange={(e) => setCreateXSpaceUrl(e.target.value)} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              </div>
              )}
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
            )}
            <div className="mt-4 flex justify-end gap-2">
              {!createJustDoneSpaceId && (
                <>
                  <button type="button" onClick={() => { setShowCreate(false); setCreatePrefilledDate(null); setCreateJustDoneSpaceId(null); }} className="px-4 py-2 rounded-lg border border-border text-foreground">Cancel</button>
                  <button type="button" onClick={handleCreate} disabled={saving || !createTitle.trim() || !createScheduledAt.trim()} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                    {saving ? "Creating…" : "Create"}
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}

      {showAddFromX && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => { setShowAddFromX(false); setAddFromXError(null); }} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-border bg-card p-6 z-50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Add Space from X</h2>
              <button type="button" onClick={() => { setShowAddFromX(false); setAddFromXError(null); }} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-muted-foreground mb-3">Paste an X (Twitter) Space link you host. We’ll pull the details and use it for audience overlap (when both hosts are registered).</p>
            <input
              type="url"
              value={addFromXUrl}
              onChange={(e) => { setAddFromXUrl(e.target.value); setAddFromXError(null); }}
              placeholder="https://x.com/i/spaces/..."
              className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground mb-2"
            />
            {addFromXError && (
              <p className="text-sm text-destructive mb-2">{addFromXError}</p>
            )}
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => { setShowAddFromX(false); setAddFromXError(null); }} className="px-4 py-2 rounded-lg border border-border text-foreground">Cancel</button>
              <button
                type="button"
                disabled={addFromXSaving || !addFromXUrl.trim()}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50"
                onClick={async () => {
                  setAddFromXError(null);
                  setAddFromXSaving(true);
                  const token = await getToken();
                  const res = await fetch(`${base}/api/spaces/sync-from-x`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ space_url: addFromXUrl.trim() }),
                  });
                  const data = await res.json().catch(() => ({}));
                  setAddFromXSaving(false);
                  if (data.space) {
                    setShowAddFromX(false);
                    setAddFromXUrl("");
                    const participantsCount = typeof data.participants_count === "number" ? data.participants_count : 0;
                    setAddFromXSuccess({ participants_count: participantsCount, overlaps: [] });
                    if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth);
                    else loadSpaces();
                    try {
                      const ovRes = await fetch(`${base}/api/spaces/audience-overlaps?space_id=${encodeURIComponent(data.space.id)}`, {
                        headers: { Authorization: `Bearer ${token}` },
                      });
                      const ovData = await ovRes.json().catch(() => ({}));
                      const arr = Array.isArray(ovData.overlaps) ? ovData.overlaps : [];
                      setAddFromXSuccess((prev) => (prev ? { ...prev, overlaps: arr.slice(0, 3) } : null));
                    } catch {
                      // keep success panel with 0 overlaps
                    }
                  } else {
                    setAddFromXError(data.message ?? data.error ?? "Failed to sync Space");
                  }
                }}
              >
                {addFromXSaving ? "Syncing…" : "Add from X"}
              </button>
            </div>
          </div>
        </>
      )}

      {detailsSpace && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setDetailsSpace(null)} aria-hidden />
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md rounded-xl border border-border bg-card p-6 z-50 shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-foreground">Space details</h2>
              <button type="button" onClick={() => setDetailsSpace(null)} className="p-1 rounded-lg hover:bg-accent">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-2 mb-4">
              {isHost(detailsSpace) ? (
                <input type="text" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground" />
              ) : (
                <p className="font-medium text-foreground">{detailsSpace.title}</p>
              )}
              <p className="text-sm text-muted-foreground">
                {detailsSpace.scheduled_at ? new Date(detailsSpace.scheduled_at).toLocaleString() : "—"}
                {detailsSpace.duration_mins ? ` · ${detailsSpace.duration_mins} min` : ""}
              </p>
              {detailsSpace.description && <p className="text-sm text-muted-foreground">{detailsSpace.description}</p>}
              {detailsSpace.x_space_url && (
                <a href={detailsSpace.x_space_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-secondary text-foreground text-sm font-medium hover:bg-accent">
                  Open on X
                </a>
              )}
              {(audienceOverlapsBySpaceId[detailsSpace.id] ?? []).length > 0 && (
                <div className="flex items-start gap-2 p-2 rounded-lg border border-border bg-card text-sm text-foreground">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    {(audienceOverlapsBySpaceId[detailsSpace.id] ?? []).map((o) => (
                      <p key={o.other_space_id}>
                        @{o.other_host_username ?? "user"} — {o.other_space_title}: <OverlapText o={o} />
                      </p>
                    ))}
                  </div>
                </div>
              )}
              {spaceRsvps && (
                <div className="rounded-xl border border-border bg-card p-3 space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Linkary RSVPs</p>
                  <p className="text-sm text-foreground">{spaceRsvps.going_count} going · {spaceRsvps.interested_count} interested</p>
                  {spaceRsvps.attendees && spaceRsvps.attendees.length > 0 && (
                    <ul className="text-xs text-muted-foreground mt-1 space-y-0.5">
                      {spaceRsvps.attendees.slice(0, 10).map((a) => (
                        <li key={a.profile_id}>@{a.username ?? "user"} — {a.status}</li>
                      ))}
                      {spaceRsvps.attendees.length > 10 && <li>+{spaceRsvps.attendees.length - 10} more</li>}
                    </ul>
                  )}
                </div>
              )}
              <div className="rounded-xl border border-border bg-card p-3">
                <p className="text-xs font-medium text-muted-foreground">X reminders</p>
                <p className="text-sm text-muted-foreground">Not available yet</p>
              </div>
              {isHost(detailsSpace) && (
                <>
                  {detailsSpace.status !== "ended" && detailsSpace.status !== "cancelled" && (
                    <button type="button" onClick={async () => {
                      setEditSaving(true);
                      const token = await getToken();
                      const res = await fetch(`${base}/api/spaces/${detailsSpace.id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ status: "ended" }) });
                      setEditSaving(false);
                      if (res.ok) { setDetailsSpace({ ...detailsSpace, status: "ended" }); if (view === "month") loadSpacesForMonth(calendarYear, calendarMonth); else loadSpaces(); }
                    }} disabled={editSaving} className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-accent disabled:opacity-50">Mark as ended</button>
                  )}
                  <button type="button" onClick={() => setShowLinkXSpace(!showLinkXSpace)} className="px-3 py-1.5 rounded-lg border border-border text-sm text-foreground hover:bg-accent">Link X Space</button>
                  {showLinkXSpace && (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <input type="url" value={linkXSpaceUrl} onChange={(e) => setLinkXSpaceUrl(e.target.value)} placeholder="https://x.com/i/spaces/..." className="w-full px-3 py-2 rounded-lg border border-border bg-input-background text-foreground text-sm" />
                      <button type="button" disabled={linkXSpaceSaving} onClick={async () => {
                        if (!linkXSpaceUrl.trim()) return;
                        setLinkXSpaceSaving(true);
                        const token = await getToken();
                        const res = await fetch(`${base}/api/spaces/sync-from-x`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ space_url: linkXSpaceUrl.trim() }) });
                        const data = await res.json().catch(() => ({}));
                        setLinkXSpaceSaving(false);
                        if (data.space) { setDetailsSpace({ ...detailsSpace, x_space_id: data.space.x_space_id ?? detailsSpace.x_space_id, x_space_url: data.space.x_space_url ?? detailsSpace.x_space_url }); setLinkXSpaceUrl(""); setShowLinkXSpace(false); }
                      }} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-sm disabled:opacity-50">Save link</button>
                    </div>
                  )}
                  {spaceSpeakerRequests.length > 0 && (
                    <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                      <p className="text-xs font-medium text-muted-foreground">Speaker requests</p>
                      {spaceSpeakerRequests.map((sr) => (
                        <div key={sr.id} className="flex items-center justify-between gap-2 text-sm">
                          <span className="text-foreground">@{sr.username ?? "user"}{sr.message ? `: ${sr.message.slice(0, 50)}${sr.message.length > 50 ? "…" : ""}` : ""}</span>
                          <span className="text-muted-foreground">{sr.status}</span>
                          {sr.status === "pending" && (
                            <div className="flex gap-1">
                              <button type="button" disabled={resolvingRequestId === sr.id} onClick={async () => {
                                setResolvingRequestId(sr.id);
                                const token = await getToken();
                                await fetch(`${base}/api/xspaces/speaker-request/resolve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_id: sr.id, status: "approved" }) });
                                setResolvingRequestId(null);
                                loadDetailSpeakerRequests(detailsSpace.id);
                              }} className="px-2 py-1 rounded bg-green-600 text-white text-xs disabled:opacity-50">Approve</button>
                              <button type="button" disabled={resolvingRequestId === sr.id} onClick={async () => {
                                setResolvingRequestId(sr.id);
                                const token = await getToken();
                                await fetch(`${base}/api/xspaces/speaker-request/resolve`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ request_id: sr.id, status: "rejected" }) });
                                setResolvingRequestId(null);
                                loadDetailSpeakerRequests(detailsSpace.id);
                              }} className="px-2 py-1 rounded bg-red-600 text-white text-xs disabled:opacity-50">Reject</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
            <div className="flex justify-end gap-2 flex-wrap">
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
                <>
                  <div className="mb-2">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Message to host (optional)</label>
                    <textarea
                      value={speakerRequestMessage}
                      onChange={(e) => setSpeakerRequestMessage(e.target.value)}
                      placeholder="Why you'd like to speak…"
                      rows={2}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={async () => {
                      const token = await getToken();
                      const res = await fetch(`${base}/api/xspaces/rsvp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ space_id: detailsSpace.id, status: "interested" }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data?.status === "interested" || data?.status === "going")) setRsvpStatus((prev) => ({ ...prev, [detailsSpace.id]: data.status }));
                    }}
                    className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                  >
                    Interested
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      const token = await getToken();
                      const res = await fetch(`${base}/api/xspaces/rsvp`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({ space_id: detailsSpace.id, status: "going" }),
                      });
                      const data = await res.json().catch(() => ({}));
                      if (res.ok && (data?.status === "interested" || data?.status === "going")) setRsvpStatus((prev) => ({ ...prev, [detailsSpace.id]: data.status }));
                    }}
                    className="px-4 py-2 rounded-lg border border-primary text-primary hover:bg-primary/10"
                  >
                    Going
                  </button>
                  <button type="button" onClick={handleRequestSpeaker} disabled={speakerRequesting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground disabled:opacity-50">
                    {speakerRequesting ? "…" : "Request speaker"}
                  </button>
                </>
              ) : null}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
