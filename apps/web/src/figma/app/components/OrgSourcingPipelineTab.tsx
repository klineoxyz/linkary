"use client";

import React, { useMemo, useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import {
  Users,
  Eye,
  Ban,
  Sparkles,
  Briefcase,
  ExternalLink,
  ListChecks,
  Search,
  X,
  PanelRightOpen,
  Zap,
  LayoutList,
  Bookmark,
  Copy,
  Loader2,
  Trash2,
  Rows3,
  AlignJustify,
  UserCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  History,
} from "lucide-react";

type Prof = { profile_id: string; username: string | null; display_name: string | null };

type JobPipeRow = Prof & {
  job_id: string;
  job_title: string;
  invited_at: string;
  creator_response?: string;
  viewed_at?: string | null;
  has_application?: boolean;
  has_active_deal?: boolean;
  active_deal_id?: string | null;
  kol_list_id?: string | null;
  kol_list_name?: string | null;
};

type ProgPipeRow = Prof & {
  id?: string;
  creator_program_id: string;
  program_title: string;
  status: string;
  invited_at: string;
  invitee_inbox_seen_at?: string | null;
  source_type?: string | null;
  source_id?: string | null;
};

type ShortlistRow = Prof & { list_names: string[]; has_any_job_invite: boolean };

export type CreatorWorkflowRow = {
  assignee_user_id: string | null;
  follow_up_status: string;
  internal_note: string | null;
  updated_at: string | null;
  follow_up_due_at?: string | null;
  snoozed_until?: string | null;
  last_operator_action_at?: string | null;
  last_operator_action_by?: string | null;
};

export type SavedViewFilters = {
  search: string;
  priorityFilter: string;
  stageFilter: string;
  jobFilter: string;
  programFilter: string;
  listFilter: string;
  compact: boolean;
  archiveOpen: boolean;
  teamAssignFilter: string;
  timingFilter: string;
};

export type OrgSourcingPipelineTabProps = {
  orgId: string;
  pipeline: {
    shortlisted_profiles?: ShortlistRow[];
    job_invite_unseen_pending?: JobPipeRow[];
    job_invite_seen_pending?: JobPipeRow[];
    job_interested_not_applied?: JobPipeRow[];
    job_creator_passed?: JobPipeRow[];
    job_applied_after_invite?: JobPipeRow[];
    job_active_deal?: JobPipeRow[];
    program_invite_unseen?: ProgPipeRow[];
    program_invite_seen_pending?: ProgPipeRow[];
    program_progressed?: ProgPipeRow[];
    program_declined_or_removed?: ProgPipeRow[];
  } | null;
  jobInvitesFull: JobPipeRow[];
  programInvitesFull: ProgPipeRow[];
  kolListOptions: Array<{ id: string; name: string }>;
  summary: {
    job_invites_count?: number;
    program_invites_pending?: number;
    shortlisted_org_members_count?: number;
  } | null;
  setTab: (t: "jobs" | "dashboard" | "sourcing") => void;
  setSelectedJobId: (id: string | null) => void;
  setSelectedProgramId: (id: string | null) => void;
  onOpenOrgKolLists?: (orgId: string, hint?: { suggestJobId?: string; suggestProgramId?: string }) => void;
  setRoute: (r: { name: string; data?: Record<string, unknown> }) => void;
  onSourcingRefresh?: () => void | Promise<void>;
  creatorWorkflowByProfile?: Record<string, CreatorWorkflowRow>;
  orgAssignableMembers?: Array<{ user_id: string; username: string | null; display_name: string | null }>;
  currentUserId?: string | null;
};

type Waiting = "org" | "creator" | "settled" | "both";
type Track = "jobs" | "programs" | "kol";

type FlatRow = {
  key: string;
  profile_id: string;
  username: string | null;
  display_name: string | null;
  stage: string;
  stageId: string;
  track: Track;
  waiting: Waiting;
  detail: string;
  sub?: string;
  job_id?: string;
  program_id?: string;
  deal_id?: string | null;
  unresolved: boolean;
};

function profLabel(row: Prof) {
  return row.display_name?.trim() || (row.username ? `@${row.username}` : null) || row.profile_id.slice(0, 8) + "…";
}

function matchesSearch(row: Prof, q: string) {
  if (!q.trim()) return true;
  const s = q.trim().toLowerCase();
  return (
    (row.username?.toLowerCase().includes(s) ?? false) ||
    (row.display_name?.toLowerCase().includes(s) ?? false) ||
    row.profile_id.toLowerCase().includes(s)
  );
}

const FOLLOW_UP_ACTIVE = new Set(["needs_review", "follow_up_needed", "waiting_internal", "blocked"]);

const FOLLOW_UP_LABELS: Record<string, string> = {
  none: "None",
  needs_review: "Needs review",
  follow_up_needed: "Follow-up needed",
  waiting_internal: "Waiting internal",
  blocked: "Blocked",
  resolved: "Resolved",
};

function dueBlocksOverdue(wf: CreatorWorkflowRow | undefined): boolean {
  if (!wf?.follow_up_due_at) return false;
  if (wf.follow_up_status === "none" || wf.follow_up_status === "resolved") return false;
  if (wf.snoozed_until && new Date(wf.snoozed_until) > new Date()) return false;
  return new Date(wf.follow_up_due_at).getTime() < Date.now();
}

function dueIsToday(wf: CreatorWorkflowRow | undefined): boolean {
  if (!wf?.follow_up_due_at || wf.follow_up_status === "none" || wf.follow_up_status === "resolved") return false;
  if (wf.snoozed_until && new Date(wf.snoozed_until) > new Date()) return false;
  const d = new Date(wf.follow_up_due_at);
  const t = new Date();
  return d.getFullYear() === t.getFullYear() && d.getMonth() === t.getMonth() && d.getDate() === t.getDate();
}

function dueIsSoon(wf: CreatorWorkflowRow | undefined): boolean {
  if (!wf?.follow_up_due_at || wf.follow_up_status === "none" || wf.follow_up_status === "resolved") return false;
  if (wf.snoozed_until && new Date(wf.snoozed_until) > new Date()) return false;
  const due = new Date(wf.follow_up_due_at).getTime();
  const now = Date.now();
  if (due <= now) return false;
  return due - now < 72 * 3600 * 1000;
}

function recentlyTeamTouched(wf: CreatorWorkflowRow | undefined): boolean {
  const t = wf?.last_operator_action_at || wf?.updated_at;
  if (!t) return false;
  return Date.now() - new Date(t).getTime() < 5 * 24 * 3600 * 1000;
}

function isoToDatetimeLocal(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 16);
}

function filtersPayload(
  search: string,
  priorityFilter: string,
  stageFilter: string,
  jobFilter: string,
  programFilter: string,
  listFilter: string,
  compact: boolean,
  archiveOpen: boolean,
  teamAssignFilter: string,
  timingFilter: string
): SavedViewFilters {
  return {
    search,
    priorityFilter,
    stageFilter,
    jobFilter,
    programFilter,
    listFilter,
    compact,
    archiveOpen,
    teamAssignFilter,
    timingFilter,
  };
}

export default function OrgSourcingPipelineTab({
  orgId,
  pipeline,
  jobInvitesFull,
  programInvitesFull,
  kolListOptions,
  summary,
  setTab,
  setSelectedJobId,
  setSelectedProgramId,
  onOpenOrgKolLists,
  setRoute,
  onSourcingRefresh,
  creatorWorkflowByProfile: workflowProp,
  orgAssignableMembers = [],
  currentUserId = null,
}: OrgSourcingPipelineTabProps) {
  const creatorWorkflowByProfile = workflowProp ?? {};
  const [search, setSearch] = useState("");
  const [teamAssignFilter, setTeamAssignFilter] = useState<"all" | "mine" | "unassigned" | "follow_up">("all");
  const [timingFilter, setTimingFilter] = useState<"all" | "overdue" | "due_today" | "due_soon" | "recent_touch">("all");
  const [followUpQueueOpen, setFollowUpQueueOpen] = useState(true);
  const [overdueQueueOpen, setOverdueQueueOpen] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "needs_org" | "awaiting_creator" | "unresolved">("all");
  const [stageFilter, setStageFilter] = useState<string>("all");
  const [jobFilter, setJobFilter] = useState("");
  const [programFilter, setProgramFilter] = useState("");
  const [listFilter, setListFilter] = useState("");
  const [compact, setCompact] = useState(false);
  const [drawerProfileId, setDrawerProfileId] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [selectedProfiles, setSelectedProfiles] = useState<Set<string>>(new Set());
  const [savedViews, setSavedViews] = useState<Array<{ id: string; name: string; filters: SavedViewFilters }>>([]);
  const [viewsLoading, setViewsLoading] = useState(false);
  const [activeViewId, setActiveViewId] = useState<string | null>(null);
  const [saveNameInput, setSaveNameInput] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [bulkListId, setBulkListId] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const [wfDraftAssignee, setWfDraftAssignee] = useState("");
  const [wfDraftStatus, setWfDraftStatus] = useState("none");
  const [wfDraftNote, setWfDraftNote] = useState("");
  const [wfDraftDue, setWfDraftDue] = useState("");
  const [wfDraftSnooze, setWfDraftSnooze] = useState("");
  const [wfSaving, setWfSaving] = useState(false);
  const [activityItems, setActivityItems] = useState<
    Array<{ id: string; at: string; kind: string; source: string; detail: Record<string, unknown>; actor_user_id?: string | null }>
  >([]);
  const [activityLoading, setActivityLoading] = useState(false);

  const wDrawer = drawerProfileId ? creatorWorkflowByProfile[drawerProfileId] : undefined;
  const drawerWfKey = drawerProfileId
    ? `${drawerProfileId}:${wDrawer?.assignee_user_id ?? ""}:${wDrawer?.follow_up_status ?? "none"}:${wDrawer?.internal_note ?? ""}:${wDrawer?.follow_up_due_at ?? ""}:${wDrawer?.snoozed_until ?? ""}`
    : "";
  useEffect(() => {
    if (!drawerProfileId) return;
    const w = creatorWorkflowByProfile[drawerProfileId];
    setWfDraftAssignee(w?.assignee_user_id ?? "");
    setWfDraftStatus(w?.follow_up_status ?? "none");
    setWfDraftNote(w?.internal_note ?? "");
    setWfDraftDue(isoToDatetimeLocal(w?.follow_up_due_at ?? null));
    setWfDraftSnooze(isoToDatetimeLocal(w?.snoozed_until ?? null));
  }, [drawerProfileId, drawerWfKey]);

  useEffect(() => {
    if (!drawerProfileId) {
      setActivityItems([]);
      return;
    }
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      if (!token) return;
      setActivityLoading(true);
      try {
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const res = await fetch(
          `${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/activity?profile_id=${encodeURIComponent(drawerProfileId)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const data = await res.json().catch(() => ({}));
        if (!cancelled && res.ok && Array.isArray(data.timeline)) {
          setActivityItems(data.timeline);
        }
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [drawerProfileId, orgId, drawerWfKey]);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4500);
  }, []);

  const applyFilters = useCallback((f: SavedViewFilters) => {
    setSearch(f.search ?? "");
    setPriorityFilter((f.priorityFilter as typeof priorityFilter) || "all");
    setStageFilter(f.stageFilter ?? "all");
    setJobFilter(f.jobFilter ?? "");
    setProgramFilter(f.programFilter ?? "");
    setListFilter(f.listFilter ?? "");
    setCompact(!!f.compact);
    setArchiveOpen(!!f.archiveOpen);
    setTeamAssignFilter((f.teamAssignFilter as typeof teamAssignFilter) || "all");
    setTimingFilter((f.timingFilter as typeof timingFilter) || "all");
  }, []);

  const loadSavedViews = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setViewsLoading(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/saved-views`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && Array.isArray(data.views)) {
        setSavedViews(
          data.views.map((v: { id: string; name: string; filters: unknown }) => ({
            id: v.id,
            name: v.name,
            filters: (v.filters && typeof v.filters === "object" ? v.filters : {}) as SavedViewFilters,
          }))
        );
      }
    } finally {
      setViewsLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    void loadSavedViews();
  }, [loadSavedViews]);

  const openKol = useCallback(
    (hint?: { suggestJobId?: string; suggestProgramId?: string }) => {
      if (onOpenOrgKolLists) onOpenOrgKolLists(orgId, hint);
      else if (typeof window !== "undefined") window.location.href = "/app/kol-lists";
    },
    [onOpenOrgKolLists, orgId]
  );

  const flatRows = useMemo((): FlatRow[] => {
    if (!pipeline) return [];
    const out: FlatRow[] = [];
    const add = (r: FlatRow) => out.push(r);

    (pipeline.shortlisted_profiles ?? []).forEach((row) => {
      add({
        key: `sl-${row.profile_id}`,
        profile_id: row.profile_id,
        username: row.username,
        display_name: row.display_name,
        stage: "Shortlisted",
        stageId: "shortlist",
        track: "kol",
        waiting: row.has_any_job_invite ? "creator" : "org",
        detail: row.list_names.join(", ") || "Org KOL lists",
        sub: row.has_any_job_invite ? undefined : "Invite to job or program",
        unresolved: true,
      });
    });

    const jobStage = (rows: JobPipeRow[], stage: string, stageId: string, waiting: Waiting, unresolved: boolean) => {
      rows.forEach((row) => {
        add({
          key: `j-${row.profile_id}-${row.job_id}-${stageId}`,
          profile_id: row.profile_id,
          username: row.username,
          display_name: row.display_name,
          stage,
          stageId,
          track: "jobs",
          waiting,
          detail: row.job_title,
          sub: row.kol_list_name ? `Via ${row.kol_list_name}` : undefined,
          job_id: row.job_id,
          deal_id: row.active_deal_id ?? null,
          unresolved,
        });
      });
    };

    jobStage(pipeline.job_invite_unseen_pending ?? [], "Job invite — not opened", "job_unseen", "creator", true);
    jobStage(pipeline.job_invite_seen_pending ?? [], "Job invite — no response", "job_seen", "creator", true);
    jobStage(pipeline.job_interested_not_applied ?? [], "Interested (no application)", "interested", "creator", true);
    jobStage(pipeline.job_creator_passed ?? [], "Passed / hidden", "passed", "settled", false);
    jobStage(pipeline.job_applied_after_invite ?? [], "Applied", "applied", "org", true);
    jobStage(pipeline.job_active_deal ?? [], "Active deal", "deal", "both", true);

    const progStage = (rows: ProgPipeRow[], stage: string, stageId: string, waiting: Waiting, unresolved: boolean) => {
      rows.forEach((row) => {
        add({
          key: `p-${row.id ?? row.profile_id}-${row.creator_program_id}-${stageId}`,
          profile_id: row.profile_id,
          username: row.username,
          display_name: row.display_name,
          stage,
          stageId,
          track: "programs",
          waiting,
          detail: row.program_title,
          program_id: row.creator_program_id,
          unresolved,
        });
      });
    };

    progStage(pipeline.program_invite_unseen ?? [], "Program — inbox unseen", "prog_unseen", "creator", true);
    progStage(pipeline.program_invite_seen_pending ?? [], "Program — pending response", "prog_pending", "creator", true);
    progStage(pipeline.program_progressed ?? [], "Program — in progress", "prog_ok", "both", true);
    progStage(pipeline.program_declined_or_removed ?? [], "Program — out", "prog_out", "settled", false);

    return out;
  }, [pipeline]);

  const jobOptions = useMemo(() => {
    const m = new Map<string, string>();
    jobInvitesFull.forEach((j) => m.set(j.job_id, j.job_title));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [jobInvitesFull]);

  const programOptions = useMemo(() => {
    const m = new Map<string, string>();
    programInvitesFull.forEach((p) => m.set(p.creator_program_id, p.program_title));
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [programInvitesFull]);

  const baseFiltered = useMemo(() => {
    return flatRows.filter((r) => {
      if (!matchesSearch(r, search)) return false;
      if (stageFilter !== "all" && r.stageId !== stageFilter) return false;
      if (jobFilter && r.job_id !== jobFilter) return false;
      if (programFilter && r.program_id !== programFilter) return false;
      if (listFilter) {
        if (r.track !== "jobs") return false;
        const inv = jobInvitesFull.find((j) => j.profile_id === r.profile_id && j.job_id === r.job_id);
        if (!inv?.kol_list_id || inv.kol_list_id !== listFilter) return false;
      }
      if (priorityFilter === "needs_org") {
        const ok = r.stageId === "applied" || (r.stageId === "shortlist" && r.waiting === "org");
        if (!ok) return false;
      }
      if (priorityFilter === "awaiting_creator") {
        const ok = ["job_unseen", "job_seen", "interested", "prog_unseen", "prog_pending"].includes(r.stageId);
        if (!ok) return false;
      }
      if (priorityFilter === "unresolved" && !r.unresolved) return false;
      return true;
    });
  }, [flatRows, search, stageFilter, jobFilter, programFilter, listFilter, priorityFilter, jobInvitesFull]);

  const filtered = useMemo(() => {
    return baseFiltered.filter((r) => {
      const wf = creatorWorkflowByProfile[r.profile_id];
      if (teamAssignFilter === "mine") {
        if (wf?.assignee_user_id !== currentUserId) return false;
      } else if (teamAssignFilter === "unassigned") {
        if (wf?.assignee_user_id) return false;
      } else if (teamAssignFilter === "follow_up") {
        if (!(wf && FOLLOW_UP_ACTIVE.has(wf.follow_up_status))) return false;
      }
      if (timingFilter === "overdue" && !dueBlocksOverdue(wf)) return false;
      if (timingFilter === "due_today" && !dueIsToday(wf)) return false;
      if (timingFilter === "due_soon" && !dueIsSoon(wf)) return false;
      if (timingFilter === "recent_touch" && !recentlyTeamTouched(wf)) return false;
      return true;
    });
  }, [baseFiltered, teamAssignFilter, timingFilter, creatorWorkflowByProfile, currentUserId]);

  const overdueRows = useMemo(() => {
    return baseFiltered.filter((r) => dueBlocksOverdue(creatorWorkflowByProfile[r.profile_id]));
  }, [baseFiltered, creatorWorkflowByProfile]);

  const followUpQueueRows = useMemo(() => {
    return baseFiltered.filter((r) => {
      const st = creatorWorkflowByProfile[r.profile_id]?.follow_up_status;
      return st && FOLLOW_UP_ACTIVE.has(st);
    });
  }, [baseFiltered, creatorWorkflowByProfile]);

  const assigneeLabel = useCallback(
    (uid: string | null | undefined) => {
      if (!uid) return "—";
      if (currentUserId && uid === currentUserId) return "You";
      const m = orgAssignableMembers.find((x) => x.user_id === uid);
      return m?.display_name?.trim() || (m?.username ? `@${m.username}` : `${uid.slice(0, 8)}…`);
    },
    [orgAssignableMembers, currentUserId]
  );

  const filteredProfileIds = useMemo(() => [...new Set(filtered.map((r) => r.profile_id))], [filtered]);

  const needsOrgRows = useMemo(() => {
    return filtered.filter((r) => r.stageId === "applied" || (r.stageId === "shortlist" && r.waiting === "org"));
  }, [filtered]);
  const awaitingRows = useMemo(
    () => filtered.filter((r) => ["job_unseen", "job_seen", "interested", "prog_unseen", "prog_pending"].includes(r.stageId)),
    [filtered]
  );
  const inMotionRows = useMemo(() => filtered.filter((r) => ["deal", "prog_ok"].includes(r.stageId)), [filtered]);
  const archiveRows = useMemo(() => filtered.filter((r) => ["passed", "prog_out"].includes(r.stageId)), [filtered]);

  const drawerJobs = drawerProfileId ? jobInvitesFull.filter((j) => j.profile_id === drawerProfileId) : [];
  const drawerProgs = drawerProfileId ? programInvitesFull.filter((p) => p.profile_id === drawerProfileId) : [];
  const drawerShort = drawerProfileId
    ? (pipeline?.shortlisted_profiles ?? []).find((s) => s.profile_id === drawerProfileId)
    : undefined;

  const toggleProfile = (pid: string) => {
    setSelectedProfiles((prev) => {
      const n = new Set(prev);
      if (n.has(pid)) n.delete(pid);
      else n.add(pid);
      return n;
    });
  };

  const selectAllFiltered = () => setSelectedProfiles(new Set(filteredProfileIds));
  const clearSelection = () => setSelectedProfiles(new Set());

  const selectedRowsData = useMemo(() => {
    const profiles = [...selectedProfiles];
    const handles = profiles
      .map((pid) => flatRows.find((r) => r.profile_id === pid)?.username)
      .filter(Boolean) as string[];
    const dealIds = new Set<string>();
    filtered.forEach((r) => {
      if (selectedProfiles.has(r.profile_id) && r.deal_id) dealIds.add(r.deal_id);
    });
    return { profiles, handles: [...new Set(handles)], dealIds: [...dealIds] };
  }, [selectedProfiles, filtered, flatRows]);

  const bulkShortlist = async (shortlisted: boolean) => {
    if (!bulkListId || selectedProfiles.size === 0) {
      showToast("Pick a KOL list and select creators.");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setBulkBusy(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/bulk-shortlist`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          kol_list_id: bulkListId,
          profile_ids: [...selectedProfiles],
          shortlisted,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast(data.message ?? "Updated");
        await onSourcingRefresh?.();
      } else showToast(data.error ?? "Bulk shortlist failed");
    } finally {
      setBulkBusy(false);
    }
  };

  const saveDrawerWorkflow = async () => {
    if (!drawerProfileId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setWfSaving(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const res = await fetch(`${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/creator-workflow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          profile_id: drawerProfileId,
          assignee_user_id: wfDraftAssignee.trim() || null,
          follow_up_status: wfDraftStatus,
          internal_note: wfDraftNote.trim() || null,
          follow_up_due_at: wfDraftDue.trim() ? new Date(wfDraftDue).toISOString() : null,
          snoozed_until: wfDraftSnooze.trim() ? new Date(wfDraftSnooze).toISOString() : null,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showToast("Team workflow saved");
        await onSourcingRefresh?.();
      } else showToast(data.error ?? "Save failed");
    } finally {
      setWfSaving(false);
    }
  };

  const exportCsv = () => {
    const lines = ["creator,stage,track,context,waiting,assignee,follow_up,follow_up_due,profile_id"];
    filtered.forEach((r) => {
      const w = r.waiting === "org" ? "you" : r.waiting === "creator" ? "creator" : r.waiting;
      const wf = creatorWorkflowByProfile[r.profile_id];
      const due = wf?.follow_up_due_at ? new Date(wf.follow_up_due_at).toISOString() : "";
      lines.push(
        `"${profLabel(r).replace(/"/g, '""')}","${r.stage}","${r.track}","${r.detail.replace(/"/g, '""')}","${w}","${(assigneeLabel(wf?.assignee_user_id) || "").replace(/"/g, '""')}","${(wf?.follow_up_status ?? "none").replace(/"/g, '""')}","${due}","${r.profile_id}"`
      );
    });
    void navigator.clipboard.writeText(lines.join("\n"));
    showToast("CSV copied to clipboard");
  };

  const p = pipeline;
  if (!p) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center text-sm text-zinc-500">
        Loading pipeline…
      </div>
    );
  }

  const hasAny = flatRows.length > 0;
  const py = compact ? "py-1.5" : "py-2.5";

  const stageSelectOptions = [
    { id: "all", label: "All stages" },
    { id: "shortlist", label: "Shortlisted" },
    { id: "job_unseen", label: "Job invite unseen" },
    { id: "job_seen", label: "Job — no response" },
    { id: "interested", label: "Interested" },
    { id: "applied", label: "Applied" },
    { id: "deal", label: "Active deal" },
    { id: "prog_unseen", label: "Program unseen" },
    { id: "prog_pending", label: "Program pending" },
    { id: "prog_ok", label: "Program in progress" },
    { id: "passed", label: "Passed / hidden" },
    { id: "prog_out", label: "Program out" },
  ];

  const renderRowActions = (r: FlatRow) => (
    <div className="flex flex-wrap gap-1.5 justify-end">
      {r.job_id && (
        <button
          type="button"
          onClick={() => {
            setSelectedJobId(r.job_id!);
            setTab("jobs");
          }}
          className="text-[11px] px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
        >
          Job
        </button>
      )}
      {r.deal_id && (
        <button
          type="button"
          onClick={() => setRoute({ name: "dealDetail", data: { dealId: r.deal_id } })}
          className="text-[11px] px-2 py-1 rounded-md bg-violet-100 dark:bg-violet-900/40 text-violet-800 dark:text-violet-200 hover:opacity-90"
        >
          Deal
        </button>
      )}
      {r.program_id && (
        <button
          type="button"
          onClick={() => {
            setSelectedProgramId(r.program_id!);
            setTab("jobs");
          }}
          className="text-[11px] px-2 py-1 rounded-md bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 hover:opacity-90"
        >
          Program
        </button>
      )}
      {r.stageId === "shortlist" && (
        <button type="button" onClick={() => openKol()} className="text-[11px] px-2 py-1 rounded-md border border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300">
          KOL
        </button>
      )}
      {r.stageId === "applied" && (
        <button
          type="button"
          onClick={() => {
            if (r.job_id) setSelectedJobId(r.job_id);
            setTab("jobs");
          }}
          className="text-[11px] px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700"
        >
          Review
        </button>
      )}
      {r.stageId === "shortlist" && r.waiting === "org" && (
        <button type="button" onClick={() => openKol()} className="text-[11px] px-2 py-1 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
          Invite
        </button>
      )}
    </div>
  );

  const TableBlock = ({
    title,
    subtitle,
    rows,
    accent,
  }: {
    title: string;
    subtitle: string;
    rows: FlatRow[];
    accent: "amber" | "slate" | "violet" | "zinc";
  }) => {
    if (rows.length === 0) return null;
    const ring =
      accent === "amber"
        ? "border-amber-200 dark:border-amber-900/50 bg-amber-50/30 dark:bg-amber-950/15"
        : accent === "violet"
          ? "border-violet-200 dark:border-violet-900/40 bg-violet-50/20 dark:bg-violet-950/10"
          : accent === "slate"
            ? "border-slate-200 dark:border-slate-700 bg-slate-50/40 dark:bg-slate-900/30"
            : "border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/60";
    return (
      <div className={`rounded-2xl border shadow-sm ${ring}`}>
        <div className="px-4 py-3 border-b border-zinc-200/80 dark:border-zinc-700/80 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h3>
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">{subtitle}</p>
          </div>
          <span className="text-xs font-bold tabular-nums px-2.5 py-1 rounded-full bg-white/80 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-600">
            {rows.length}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">
              <tr>
                <th className={`pl-3 pr-1 ${py} w-8`}>
                  <input
                    type="checkbox"
                    className="rounded border-zinc-300"
                    checked={rows.length > 0 && rows.every((r) => selectedProfiles.has(r.profile_id))}
                    onChange={(e) => {
                      e.stopPropagation();
                      if (e.target.checked) {
                        setSelectedProfiles((prev) => {
                          const n = new Set(prev);
                          rows.forEach((r) => n.add(r.profile_id));
                          return n;
                        });
                      } else {
                        setSelectedProfiles((prev) => {
                          const n = new Set(prev);
                          rows.forEach((r) => n.delete(r.profile_id));
                          return n;
                        });
                      }
                    }}
                    title="Select section"
                  />
                </th>
                <th className={`px-2 ${py} font-medium`}>Creator</th>
                <th className={`px-2 ${py} font-medium`}>Stage</th>
                <th className={`px-2 ${py} font-medium`}>Track</th>
                <th className={`px-2 ${py} font-medium`}>Context</th>
                <th className={`px-2 ${py} font-medium`}>Waiting</th>
                {!compact && (
                  <>
                    <th className={`px-2 ${py} font-medium whitespace-nowrap`}>Assignee</th>
                    <th className={`px-2 ${py} font-medium whitespace-nowrap`}>Follow-up</th>
                    <th className={`px-2 ${py} font-medium whitespace-nowrap`}>Due</th>
                  </>
                )}
                <th className={`px-2 ${py} font-medium text-right w-[1%]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const wf = creatorWorkflowByProfile[r.profile_id];
                return (
                <tr
                  key={r.key}
                  className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/40 cursor-pointer transition-colors"
                  onClick={() => setDrawerProfileId(r.profile_id)}
                >
                  <td className={`pl-3 pr-1 ${py}`} onClick={(e) => e.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="rounded border-zinc-300"
                      checked={selectedProfiles.has(r.profile_id)}
                      onChange={() => toggleProfile(r.profile_id)}
                    />
                  </td>
                  <td className={`px-2 ${py}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-zinc-900 dark:text-zinc-100">{profLabel(r)}</span>
                      {r.username && (
                        <Link
                          href={`/${encodeURIComponent(r.username)}`}
                          className="text-zinc-400 hover:text-indigo-500 shrink-0"
                          onClick={(e) => e.stopPropagation()}
                          title="Profile"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                    {compact && (
                      <div className="text-[10px] text-zinc-500 mt-0.5">
                        {assigneeLabel(wf?.assignee_user_id)}
                        {wf?.follow_up_status && wf.follow_up_status !== "none" && (
                          <span className="text-teal-700 dark:text-teal-300">
                            {" "}
                            · {FOLLOW_UP_LABELS[wf.follow_up_status] ?? wf.follow_up_status}
                          </span>
                        )}
                        {wf?.follow_up_due_at && (
                          <span className={dueBlocksOverdue(wf) ? " text-rose-600 dark:text-rose-400 font-semibold" : ""}>
                            {" "}
                            · Due {new Date(wf.follow_up_due_at).toLocaleDateString()}
                            {dueBlocksOverdue(wf) ? " (overdue)" : ""}
                          </span>
                        )}
                      </div>
                    )}
                  </td>
                  <td className={`px-2 ${py} text-zinc-700 dark:text-zinc-300 whitespace-nowrap`}>{r.stage}</td>
                  <td className={`px-2 ${py}`}>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                        r.track === "jobs"
                          ? "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200"
                          : r.track === "programs"
                            ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100"
                            : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200"
                      }`}
                    >
                      {r.track}
                    </span>
                  </td>
                  <td className={`px-2 ${py} text-zinc-600 dark:text-zinc-400 max-w-[200px]`}>
                    <div className="truncate" title={r.detail}>
                      {r.detail}
                    </div>
                    {r.sub && <div className="text-[10px] text-zinc-500 truncate">{r.sub}</div>}
                  </td>
                  <td className={`px-2 ${py} text-zinc-600 dark:text-zinc-400 text-[11px]`}>
                    {r.waiting === "org" && <span className="text-indigo-700 dark:text-indigo-300 font-medium">You</span>}
                    {r.waiting === "creator" && <span>Creator</span>}
                    {r.waiting === "both" && <span>Both</span>}
                    {r.waiting === "settled" && <span className="text-zinc-400">Settled</span>}
                  </td>
                  {!compact && (
                    <>
                      <td className={`px-2 ${py} text-[11px] text-zinc-600 dark:text-zinc-400 max-w-[100px] truncate`} title={assigneeLabel(wf?.assignee_user_id)}>
                        {assigneeLabel(wf?.assignee_user_id)}
                      </td>
                      <td className={`px-2 ${py}`}>
                        {wf?.follow_up_status && wf.follow_up_status !== "none" ? (
                          <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-teal-100 dark:bg-teal-900/40 text-teal-900 dark:text-teal-100 whitespace-nowrap">
                            {FOLLOW_UP_LABELS[wf.follow_up_status] ?? wf.follow_up_status}
                          </span>
                        ) : (
                          <span className="text-zinc-400 text-[11px]">—</span>
                        )}
                      </td>
                      <td className={`px-2 ${py} text-[11px] whitespace-nowrap`}>
                        {wf?.follow_up_due_at ? (
                          <span
                            className={
                              dueBlocksOverdue(wf)
                                ? "text-rose-700 dark:text-rose-300 font-semibold"
                                : dueIsSoon(wf)
                                  ? "text-amber-700 dark:text-amber-300"
                                  : "text-zinc-600 dark:text-zinc-400"
                            }
                          >
                            {new Date(wf.follow_up_due_at).toLocaleString(undefined, {
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                            {wf.snoozed_until && new Date(wf.snoozed_until) > new Date() && (
                              <span className="block text-[10px] text-zinc-400">Snoozed</span>
                            )}
                          </span>
                        ) : (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>
                    </>
                  )}
                  <td className={`px-2 ${py}`} onClick={(e) => e.stopPropagation()}>
                    {renderRowActions(r)}
                  </td>
                </tr>
              );})}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const resetFilters = () => {
    setSearch("");
    setStageFilter("all");
    setJobFilter("");
    setProgramFilter("");
    setListFilter("");
    setPriorityFilter("all");
    setTeamAssignFilter("all");
    setTimingFilter("all");
    setActiveViewId(null);
  };

  const saveCurrentView = async () => {
    const name = saveNameInput.trim();
    if (!name) {
      showToast("Enter a name for this view");
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setSaveBusy(true);
    try {
      const base = typeof window !== "undefined" ? window.location.origin : "";
      const filters = filtersPayload(
        search,
        priorityFilter,
        stageFilter,
        jobFilter,
        programFilter,
        listFilter,
        compact,
        archiveOpen,
        teamAssignFilter,
        timingFilter
      );
      const res = await fetch(`${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/saved-views`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name, filters }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.view) {
        setSaveNameInput("");
        setActiveViewId(data.view.id);
        await loadSavedViews();
        showToast("View saved");
      } else showToast(data.error ?? "Save failed");
    } finally {
      setSaveBusy(false);
    }
  };

  const deleteView = async (id: string) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/saved-views/${encodeURIComponent(id)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      if (activeViewId === id) {
        setActiveViewId(null);
        resetFilters();
      }
      await loadSavedViews();
      showToast("View deleted");
    }
  };

  const renameView = async (id: string, name: string) => {
    const n = name.trim();
    if (!n) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    const base = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${base}/api/orgs/${encodeURIComponent(orgId)}/sourcing/saved-views/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ name: n }),
    });
    if (res.ok) {
      await loadSavedViews();
      showToast("Renamed");
    }
  };

  return (
    <div className="space-y-5 relative pb-24">
      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[130] px-4 py-2 rounded-lg bg-zinc-900 text-white text-sm shadow-lg max-w-md text-center">
          {toast}
        </div>
      )}

      <div className="rounded-2xl border border-indigo-200/80 dark:border-indigo-900/50 bg-gradient-to-br from-indigo-50/90 to-white dark:from-indigo-950/40 dark:to-zinc-900 p-4 sm:p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <ListChecks className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              Sourcing workbench
            </h1>
            <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-2xl">
              Team workflow: assignee + follow-up metadata (separate from pipeline truth). Saved views, bulk shortlist, export.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => openKol()}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            >
              <Users className="h-3.5 w-3.5" />
              KOL lists
            </button>
            <button
              type="button"
              onClick={() => setTab("jobs")}
              className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-700"
            >
              <Briefcase className="h-3.5 w-3.5" />
              Jobs
            </button>
          </div>
        </div>
        {summary && (
          <div className="mt-4 flex flex-wrap gap-4 text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              Shortlisted: <strong className="text-zinc-900 dark:text-zinc-100">{summary.shortlisted_org_members_count ?? 0}</strong>
            </span>
            <span>
              Job invites: <strong className="text-zinc-900 dark:text-zinc-100">{summary.job_invites_count ?? 0}</strong>
            </span>
            <span>
              Program pending: <strong className="text-zinc-900 dark:text-zinc-100">{summary.program_invites_pending ?? 0}</strong>
            </span>
          </div>
        )}
      </div>

      <div className="sticky top-0 z-20 -mx-1 px-1 py-2 bg-[#F7F8FB]/95 dark:bg-zinc-950/95 backdrop-blur-md border-b border-zinc-200/80 dark:border-zinc-800 space-y-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-2 justify-between">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[180px] max-w-md">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-400" />
              <input
                type="search"
                placeholder="Search creator name or @handle…"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setActiveViewId(null);
                }}
                className="w-full pl-8 pr-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
              />
            </div>
            <button
              type="button"
              onClick={() => setCompact(!compact)}
              className={`text-xs px-2 py-2 rounded-lg border inline-flex items-center gap-1 ${
                compact ? "border-indigo-500 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-800 dark:text-indigo-200" : "border-zinc-200 dark:border-zinc-600"
              }`}
              title="Compact rows"
            >
              <AlignJustify className="h-3.5 w-3.5" />
              Compact
            </button>
            {(search ||
              stageFilter !== "all" ||
              jobFilter ||
              programFilter ||
              listFilter ||
              priorityFilter !== "all" ||
              teamAssignFilter !== "all" ||
              timingFilter !== "all") && (
              <button
                type="button"
                onClick={resetFilters}
                className="text-xs px-2 py-2 rounded-lg border border-zinc-200 dark:border-zinc-600 text-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 inline-flex items-center gap-1"
              >
                <X className="h-3 w-3" /> Reset
              </button>
            )}
          </div>
          <div className="text-xs text-zinc-500 tabular-nums">
            <strong className="text-zinc-800 dark:text-zinc-200">{filtered.length}</strong> rows ·{" "}
            <strong className="text-zinc-800 dark:text-zinc-200">{filteredProfileIds.length}</strong> creators
          </div>
        </div>

        <div className="flex flex-wrap gap-2 items-center border-t border-zinc-100 dark:border-zinc-800 pt-2">
          <Bookmark className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
          <select
            value={activeViewId ?? ""}
            onChange={(e) => {
              const id = e.target.value;
              if (!id) return;
              const v = savedViews.find((x) => x.id === id);
              if (v) {
                applyFilters(v.filters);
                setActiveViewId(id);
              }
            }}
            className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1.5 px-2 min-w-[160px]"
            disabled={viewsLoading}
          >
            <option value="">{viewsLoading ? "Loading views…" : "Load saved view…"}</option>
            {savedViews.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          {activeViewId && (
            <>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 inline-flex items-center gap-1"
                onClick={() => void deleteView(activeViewId)}
              >
                <Trash2 className="h-3 w-3" /> Delete
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                onClick={() => {
                  const name = window.prompt("Rename view", savedViews.find((v) => v.id === activeViewId)?.name ?? "");
                  if (name) void renameView(activeViewId, name);
                }}
              >
                Rename
              </button>
            </>
          )}
          <div className="flex items-center gap-1 flex-wrap">
            <input
              type="text"
              placeholder="New view name…"
              value={saveNameInput}
              onChange={(e) => setSaveNameInput(e.target.value)}
              className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1.5 px-2 w-36 sm:w-44"
            />
            <button
              type="button"
              disabled={saveBusy}
              onClick={() => void saveCurrentView()}
              className="text-xs px-2 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50 inline-flex items-center gap-1"
            >
              {saveBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
              Save view
            </button>
          </div>
          <button type="button" onClick={() => void exportCsv()} className="text-xs px-2 py-1 rounded-lg border border-zinc-300 inline-flex items-center gap-1 ml-auto">
            <Rows3 className="h-3 w-3" />
            Copy CSV (visible)
          </button>
        </div>

        <div className="flex flex-wrap gap-2 items-center">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Priority</span>
          {(
            [
              ["all", "All", LayoutList],
              ["needs_org", "Needs you", Zap],
              ["awaiting_creator", "Awaiting creator", Eye],
              ["unresolved", "Unresolved", ListChecks],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setPriorityFilter(id);
                setActiveViewId(null);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                priorityFilter === id
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center border-t border-zinc-100 dark:border-zinc-800 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Team</span>
          {(
            [
              ["all", "Everyone", Users],
              ["mine", "Assigned to me", UserCircle],
              ["unassigned", "Unassigned", LayoutList],
              ["follow_up", "Needs follow-up", Zap],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTeamAssignFilter(id);
                setActiveViewId(null);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                teamAssignFilter === id
                  ? "bg-teal-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-center border-t border-zinc-100 dark:border-zinc-800 pt-2">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">Timing</span>
          {(
            [
              ["all", "All dates", LayoutList],
              ["overdue", "Overdue", Ban],
              ["due_today", "Due today", Clock],
              ["due_soon", "Due soon", Zap],
              ["recent_touch", "Recently touched", UserCircle],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setTimingFilter(id);
                setActiveViewId(null);
              }}
              className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-colors ${
                timingFilter === id
                  ? "bg-rose-600 text-white"
                  : "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-200 dark:hover:bg-zinc-700"
              }`}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 items-end">
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-zinc-500">Stage</label>
            <select
              value={stageFilter}
              onChange={(e) => {
                setStageFilter(e.target.value);
                setActiveViewId(null);
              }}
              className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1.5 px-2 min-w-[140px]"
            >
              {stageSelectOptions.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-zinc-500">Job</label>
            <select
              value={jobFilter}
              onChange={(e) => {
                setJobFilter(e.target.value);
                setActiveViewId(null);
              }}
              className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1.5 px-2 min-w-[140px]"
            >
              <option value="">All jobs</option>
              {jobOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-zinc-500">Program</label>
            <select
              value={programFilter}
              onChange={(e) => {
                setProgramFilter(e.target.value);
                setActiveViewId(null);
              }}
              className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1.5 px-2 min-w-[140px]"
            >
              <option value="">All programs</option>
              {programOptions.map(([id, title]) => (
                <option key={id} value={id}>
                  {title}
                </option>
              ))}
            </select>
          </div>
          <div className="flex flex-col gap-0.5">
            <label className="text-[10px] text-zinc-500">Source list</label>
            <select
              value={listFilter}
              onChange={(e) => {
                setListFilter(e.target.value);
                setActiveViewId(null);
              }}
              className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-1.5 px-2 min-w-[140px]"
            >
              <option value="">Any list</option>
              {kolListOptions.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {!hasAny && (
        <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
          <p className="text-sm text-zinc-600 dark:text-zinc-400">No sourcing activity yet.</p>
          <button type="button" onClick={() => openKol()} className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
            Open KOL lists →
          </button>
        </div>
      )}

      {hasAny && filtered.length === 0 && (
        <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50/50 dark:bg-amber-950/20 p-8 text-center">
          <p className="text-sm font-medium text-zinc-800 dark:text-zinc-200">No rows match this view</p>
          <p className="text-xs text-zinc-500 mt-2">Try another saved view or loosen filters.</p>
          <button type="button" className="mt-4 text-sm text-indigo-600 font-medium hover:underline" onClick={resetFilters}>
            Reset all filters
          </button>
        </div>
      )}

      {filtered.length > 0 && (
        <div className="space-y-5">
          {overdueRows.length > 0 && (
            <div className="rounded-2xl border border-rose-200/80 dark:border-rose-900/50 bg-rose-50/40 dark:bg-rose-950/20 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setOverdueQueueOpen(!overdueQueueOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-rose-900 dark:text-rose-100 hover:bg-rose-100/50 dark:hover:bg-rose-950/40"
              >
                <span className="flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  Overdue follow-ups ({overdueRows.length})
                  <span className="text-[11px] font-normal text-rose-800/80 dark:text-rose-300/80">
                    past due date · not snoozed · status not resolved
                  </span>
                </span>
                {overdueQueueOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {overdueQueueOpen && (
                <div className="border-t border-rose-200/60 dark:border-rose-900/40 px-2 pb-2 max-h-[240px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-rose-800/70 dark:text-rose-300/70">
                        <th className="p-2">Creator</th>
                        <th className="p-2">Due</th>
                        <th className="p-2">Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {overdueRows.slice(0, 20).map((r) => {
                        const wf = creatorWorkflowByProfile[r.profile_id];
                        return (
                          <tr
                            key={r.key}
                            className="border-t border-rose-100 dark:border-rose-900/30 hover:bg-white/60 dark:hover:bg-zinc-900/40 cursor-pointer"
                            onClick={() => setDrawerProfileId(r.profile_id)}
                          >
                            <td className="p-2 font-medium text-zinc-900 dark:text-zinc-100">{profLabel(r)}</td>
                            <td className="p-2 text-rose-700 dark:text-rose-300">
                              {wf?.follow_up_due_at ? new Date(wf.follow_up_due_at).toLocaleString() : "—"}
                            </td>
                            <td className="p-2 text-zinc-600 dark:text-zinc-400">{assigneeLabel(wf?.assignee_user_id)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
          {followUpQueueRows.length > 0 && (
            <div className="rounded-2xl border border-teal-200/80 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/20 overflow-hidden shadow-sm">
              <button
                type="button"
                onClick={() => setFollowUpQueueOpen(!followUpQueueOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-teal-900 dark:text-teal-100 hover:bg-teal-100/50 dark:hover:bg-teal-950/40"
              >
                <span className="flex items-center gap-2">
                  <UserCircle className="h-4 w-4" />
                  Team follow-up queue ({followUpQueueRows.length})
                  <span className="text-[11px] font-normal text-teal-700/80 dark:text-teal-300/80">
                    org-side status only — not invite/application state
                  </span>
                </span>
                {followUpQueueOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
              {followUpQueueOpen && (
                <div className="border-t border-teal-200/60 dark:border-teal-900/40 px-2 pb-2 max-h-[280px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="text-teal-800/70 dark:text-teal-300/70">
                        <th className="p-2">Creator</th>
                        <th className="p-2">Stage</th>
                        <th className="p-2">Follow-up</th>
                        <th className="p-2">Assignee</th>
                      </tr>
                    </thead>
                    <tbody>
                      {followUpQueueRows.slice(0, 25).map((r) => {
                        const wf = creatorWorkflowByProfile[r.profile_id];
                        return (
                          <tr
                            key={r.key}
                            className="border-t border-teal-100 dark:border-teal-900/30 hover:bg-white/60 dark:hover:bg-zinc-900/40 cursor-pointer"
                            onClick={() => setDrawerProfileId(r.profile_id)}
                          >
                            <td className="p-2 font-medium text-zinc-900 dark:text-zinc-100">{profLabel(r)}</td>
                            <td className="p-2 text-zinc-600 dark:text-zinc-400">{r.stage}</td>
                            <td className="p-2">
                              <span className="px-1.5 py-0.5 rounded bg-teal-200/60 dark:bg-teal-900/50 text-teal-900 dark:text-teal-100 text-[10px] font-semibold">
                                {FOLLOW_UP_LABELS[wf?.follow_up_status ?? "none"] ?? wf?.follow_up_status}
                              </span>
                            </td>
                            <td className="p-2 text-zinc-600 dark:text-zinc-400">{assigneeLabel(wf?.assignee_user_id)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {followUpQueueRows.length > 25 && (
                    <p className="text-[11px] text-teal-800/70 dark:text-teal-300/70 px-2 py-1">
                      +{followUpQueueRows.length - 25} more — use filters to narrow
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <TableBlock
            title="Needs your attention"
            subtitle="Review applications · Invite shortlisted creators who have no job invite yet"
            rows={needsOrgRows}
            accent="amber"
          />
          <TableBlock
            title="Waiting on creator"
            subtitle="Inbox opens, responses, applications, program accept/decline"
            rows={awaitingRows}
            accent="slate"
          />
          <TableBlock
            title="In motion"
            subtitle="Active deals and programs in progress"
            rows={inMotionRows}
            accent="violet"
          />
          {archiveRows.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              <button
                type="button"
                onClick={() => setArchiveOpen(!archiveOpen)}
                className="w-full px-4 py-3 flex items-center justify-between text-left text-sm font-medium text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
              >
                <span className="flex items-center gap-2">
                  <Ban className="h-4 w-4" />
                  Settled / archive ({archiveRows.length})
                </span>
                <span className="text-xs">{archiveOpen ? "Hide" : "Show"}</span>
              </button>
              {archiveOpen && (
                <div className="border-t border-zinc-200 dark:border-zinc-700 p-2">
                  <div className="overflow-x-auto rounded-lg">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="text-zinc-500">
                          <th className="p-2 w-8">
                            <input
                              type="checkbox"
                              className="rounded"
                              onChange={(e) => {
                                if (e.target.checked) {
                                  archiveRows.forEach((r) => toggleProfile(r.profile_id));
                                } else {
                                  setSelectedProfiles((prev) => {
                                    const n = new Set(prev);
                                    archiveRows.forEach((r) => n.delete(r.profile_id));
                                    return n;
                                  });
                                }
                              }}
                            />
                          </th>
                          <th className="p-2">Creator</th>
                          <th className="p-2">Stage</th>
                          <th className="p-2">Context</th>
                        </tr>
                      </thead>
                      <tbody>
                        {archiveRows.map((r) => (
                          <tr
                            key={r.key}
                            className="border-t border-zinc-100 dark:border-zinc-800 hover:bg-zinc-50/50 cursor-pointer"
                            onClick={() => setDrawerProfileId(r.profile_id)}
                          >
                            <td className="p-2" onClick={(e) => e.stopPropagation()}>
                              <input type="checkbox" checked={selectedProfiles.has(r.profile_id)} onChange={() => toggleProfile(r.profile_id)} className="rounded" />
                            </td>
                            <td className="p-2">{profLabel(r)}</td>
                            <td className="p-2 text-zinc-500">{r.stage}</td>
                            <td className="p-2 text-zinc-500 truncate max-w-[160px]">{r.detail}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {selectedProfiles.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-[120] border-t border-zinc-200 dark:border-zinc-700 bg-white/95 dark:bg-zinc-900/95 backdrop-blur-md shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 safe-area-pb">
          <div className="max-w-5xl mx-auto flex flex-wrap items-center gap-3 justify-between">
            <div className="flex items-center gap-2 text-sm">
              <strong className="text-zinc-900 dark:text-zinc-100">{selectedProfiles.size}</strong>
              <span className="text-zinc-600 dark:text-zinc-400">selected</span>
              <button type="button" className="text-xs text-indigo-600 hover:underline" onClick={selectAllFiltered}>
                All in view ({filteredProfileIds.length})
              </button>
              <button type="button" className="text-xs text-zinc-500 hover:underline" onClick={clearSelection}>
                Clear
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={bulkListId}
                onChange={(e) => setBulkListId(e.target.value)}
                className="text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 py-1.5 px-2 max-w-[200px]"
              >
                <option value="">KOL list for bulk shortlist…</option>
                {kolListOptions.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void bulkShortlist(true)}
                className="text-xs px-2 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
              >
                Shortlist on list
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                onClick={() => void bulkShortlist(false)}
                className="text-xs px-2 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
              >
                Remove shortlist
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1.5 rounded-lg border border-zinc-300 inline-flex items-center gap-1"
                onClick={() => {
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  let n = 0;
                  for (const h of selectedRowsData.handles.slice(0, 8)) {
                    window.open(`${origin}/${encodeURIComponent(h)}`, "_blank", "noopener,noreferrer");
                    n++;
                  }
                  if (selectedRowsData.handles.length > 8) showToast(`Opened 8 profiles (${selectedRowsData.handles.length} have handles)`);
                  else if (n === 0) showToast("No @handles in selection");
                }}
              >
                Open profiles (≤8)
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1.5 rounded-lg border border-violet-300 text-violet-800 dark:text-violet-200"
                onClick={() => {
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const ids = selectedRowsData.dealIds.slice(0, 8);
                  ids.forEach((id) => window.open(`${origin}/deal/${id}`, "_blank", "noopener,noreferrer"));
                  if (ids.length === 0) showToast("No deals in selection");
                }}
              >
                Open deals (≤8)
              </button>
              <button
                type="button"
                className="text-xs px-2 py-1.5 rounded-lg border inline-flex items-center gap-1"
                onClick={() => {
                  const t = selectedRowsData.handles.map((h) => `@${h}`).join("\n") || [...selectedProfiles].join("\n");
                  void navigator.clipboard.writeText(t);
                  showToast("Copied handles or IDs");
                }}
              >
                <Copy className="h-3 w-3" />
                Copy
              </button>
              <button type="button" className="text-xs px-2 py-1.5 rounded-lg bg-indigo-100 dark:bg-indigo-900/40 text-indigo-800 dark:text-indigo-200" onClick={() => openKol()}>
                KOL lists
              </button>
            </div>
          </div>
        </div>
      )}

      {drawerProfileId && (
        <>
          <div className="fixed inset-0 bg-black/30 z-[100] lg:bg-black/20" aria-hidden onClick={() => setDrawerProfileId(null)} />
          <aside
            className="fixed top-0 right-0 z-[110] h-full w-full max-w-md border-l border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-2xl flex flex-col"
            role="dialog"
            aria-labelledby="drawer-creator-title"
          >
            <div className="p-4 border-b border-zinc-200 dark:border-zinc-700 flex items-start justify-between gap-2">
              <div>
                <h2 id="drawer-creator-title" className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">
                  {profLabel({
                    profile_id: drawerProfileId,
                    username: drawerJobs[0]?.username ?? drawerProgs[0]?.username ?? drawerShort?.username ?? null,
                    display_name: drawerJobs[0]?.display_name ?? drawerProgs[0]?.display_name ?? drawerShort?.display_name ?? null,
                  })}
                </h2>
                <p className="text-[11px] text-zinc-500 mt-1">Grounded rows for this org only — not a synthetic timeline.</p>
              </div>
              <button type="button" onClick={() => setDrawerProfileId(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800" aria-label="Close">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-6 text-sm">
              <div className="flex flex-wrap gap-2">
                {(drawerJobs[0]?.username || drawerProgs[0]?.username || drawerShort?.username) && (
                  <Link
                    href={`/${encodeURIComponent(drawerJobs[0]?.username || drawerProgs[0]?.username || drawerShort?.username || "")}`}
                    className="text-xs px-2 py-1 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1"
                  >
                    Profile <ExternalLink className="h-3 w-3" />
                  </Link>
                )}
                <button type="button" onClick={() => openKol()} className="text-xs px-2 py-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700">
                  KOL lists
                </button>
              </div>

              <section className="rounded-xl border border-teal-200 dark:border-teal-900/50 bg-teal-50/40 dark:bg-teal-950/25 p-4 space-y-3">
                <h3 className="text-xs font-bold uppercase tracking-wide text-teal-800 dark:text-teal-200 flex items-center gap-1">
                  <UserCircle className="h-3.5 w-3.5" /> Team workflow
                </h3>
                <p className="text-[10px] text-zinc-500 dark:text-zinc-400 leading-snug">
                  Assignee and follow-up are org-only coordination metadata. They do not change shortlist, invites, applications, or deals.
                </p>
                <div>
                  <label className="text-[10px] font-medium text-zinc-500">Assignee</label>
                  <select
                    value={wfDraftAssignee}
                    onChange={(e) => setWfDraftAssignee(e.target.value)}
                    className="mt-1 w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 px-2"
                  >
                    <option value="">Unassigned</option>
                    {orgAssignableMembers.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.display_name?.trim() || (m.username ? `@${m.username}` : m.user_id.slice(0, 8) + "…")}
                        {currentUserId === m.user_id ? " (you)" : ""}
                      </option>
                    ))}
                  </select>
                </div>
                {currentUserId && (
                  <button
                    type="button"
                    onClick={() => setWfDraftAssignee(currentUserId)}
                    className="text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:underline"
                  >
                    Assign to me
                  </button>
                )}
                <div>
                  <label className="text-[10px] font-medium text-zinc-500">Follow-up status</label>
                  <select
                    value={wfDraftStatus}
                    onChange={(e) => setWfDraftStatus(e.target.value)}
                    className="mt-1 w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 px-2"
                  >
                    {(["none", "needs_review", "follow_up_needed", "waiting_internal", "blocked", "resolved"] as const).map((k) => (
                      <option key={k} value={k}>
                        {FOLLOW_UP_LABELS[k]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-zinc-500">Follow-up due</label>
                  <input
                    type="datetime-local"
                    value={wfDraftDue}
                    onChange={(e) => setWfDraftDue(e.target.value)}
                    className="mt-1 w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 px-2"
                  />
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {[
                      { label: "Tomorrow", days: 1 },
                      { label: "+3d", days: 3 },
                      { label: "+7d", days: 7 },
                    ].map(({ label, days }) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() => {
                          const d = new Date();
                          d.setDate(d.getDate() + days);
                          d.setHours(17, 0, 0, 0);
                          setWfDraftDue(isoToDatetimeLocal(d.toISOString()));
                        }}
                        className="text-[10px] px-2 py-1 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-200 dark:hover:bg-zinc-700"
                      >
                        {label}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setWfDraftDue("")}
                      className="text-[10px] px-2 py-1 rounded-md border border-zinc-300 dark:border-zinc-600 text-zinc-600"
                    >
                      Clear due
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-zinc-500">Snooze overdue until</label>
                  <input
                    type="datetime-local"
                    value={wfDraftSnooze}
                    onChange={(e) => setWfDraftSnooze(e.target.value)}
                    className="mt-1 w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 px-2"
                  />
                  <button
                    type="button"
                    onClick={() => setWfDraftSnooze("")}
                    className="mt-1 text-[10px] text-zinc-500 hover:underline"
                  >
                    Clear snooze
                  </button>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-zinc-500">Internal note (org members only)</label>
                  <textarea
                    value={wfDraftNote}
                    onChange={(e) => setWfDraftNote(e.target.value.slice(0, 500))}
                    rows={3}
                    placeholder="Short context for handoffs…"
                    className="mt-1 w-full text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 py-2 px-2 resize-y min-h-[72px]"
                  />
                  <p className="text-[10px] text-zinc-400 mt-0.5">{wfDraftNote.length}/500</p>
                </div>
                {wDrawer?.last_operator_action_at && (
                  <p className="text-[10px] text-zinc-500 border-t border-teal-100 dark:border-teal-900/40 pt-2">
                    Last team save:{" "}
                    <strong className="text-zinc-700 dark:text-zinc-300">
                      {new Date(wDrawer.last_operator_action_at).toLocaleString()}
                    </strong>
                    {wDrawer.last_operator_action_by && (
                      <>
                        {" "}
                        · {assigneeLabel(wDrawer.last_operator_action_by)}
                      </>
                    )}
                  </p>
                )}
                <button
                  type="button"
                  disabled={wfSaving}
                  onClick={() => void saveDrawerWorkflow()}
                  className="w-full text-xs font-semibold py-2.5 rounded-lg bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-50 inline-flex items-center justify-center gap-2"
                >
                  {wfSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Save team workflow
                </button>
              </section>

              <section className="rounded-xl border border-zinc-200 dark:border-zinc-700 p-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-500 mb-2 flex items-center gap-1">
                  <History className="h-3.5 w-3.5" /> Activity
                </h3>
                <p className="text-[10px] text-zinc-500 mb-3">
                  <span className="font-medium text-teal-700 dark:text-teal-300">Team</span> = workflow edits.{" "}
                  <span className="font-medium text-sky-700 dark:text-sky-300">Pipeline</span> = milestones from live invites,
                  applications, deals (grounded).
                </p>
                {activityLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin text-zinc-400" />
                  </div>
                ) : activityItems.length === 0 ? (
                  <p className="text-xs text-zinc-500">No activity yet. Save workflow or wait for pipeline events.</p>
                ) : (
                  <ul className="space-y-2 max-h-[280px] overflow-y-auto text-xs">
                    {activityItems.map((it) => {
                      const jid = it.detail.job_id as string | undefined;
                      const jt = jid ? drawerJobs.find((x) => x.job_id === jid)?.job_title : null;
                      let desc = it.kind;
                      if (it.source === "workflow") {
                        if (it.kind === "workflow_initialized") desc = "Team workflow initialized";
                        else if (it.kind === "workflow_assignee") desc = "Assignee changed";
                        else if (it.kind === "workflow_follow_up_status")
                          desc = `Follow-up status: ${String(it.detail.from)} → ${String(it.detail.to)}`;
                        else if (it.kind === "workflow_note") desc = "Internal note updated";
                        else if (it.kind === "workflow_due") desc = "Follow-up due date changed";
                        else if (it.kind === "workflow_snooze") desc = "Snooze changed";
                      } else {
                        if (it.kind === "job_invite_sent") desc = jt ? `Job invite sent · ${jt}` : "Job invite sent";
                        else if (it.kind === "job_invite_opened") desc = jt ? `Creator opened invite · ${jt}` : "Creator opened invite";
                        else if (it.kind === "creator_response")
                          desc = jt
                            ? `Creator response (${String(it.detail.response)}) · ${jt}`
                            : `Creator response: ${String(it.detail.response)}`;
                        else if (it.kind === "application_submitted")
                          desc = jt ? `Application submitted · ${jt}` : "Application submitted";
                        else if (it.kind === "deal_active") desc = "Active deal created";
                        else if (it.kind === "program_invite_sent") desc = "Program invite sent";
                      }
                      return (
                        <li
                          key={it.id}
                          className="border-b border-zinc-100 dark:border-zinc-800 pb-2 last:border-0 flex flex-col gap-0.5"
                        >
                          <div className="flex items-center gap-2 flex-wrap">
                            <span
                              className={`text-[9px] font-bold uppercase px-1 py-0.5 rounded ${
                                it.source === "workflow"
                                  ? "bg-teal-100 dark:bg-teal-900/40 text-teal-800 dark:text-teal-200"
                                  : "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200"
                              }`}
                            >
                              {it.source === "workflow" ? "Team" : "Pipeline"}
                            </span>
                            <span className="text-zinc-400 tabular-nums">{new Date(it.at).toLocaleString()}</span>
                            {it.actor_user_id && it.source === "workflow" && (
                              <span className="text-zinc-500">· {assigneeLabel(it.actor_user_id)}</span>
                            )}
                          </div>
                          <span className="text-zinc-800 dark:text-zinc-200">{desc}</span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" /> Shortlist
                </h3>
                {drawerShort ? (
                  <ul className="text-sm text-zinc-700 dark:text-zinc-300 space-y-1 list-disc pl-4">
                    {drawerShort.list_names.map((n) => (
                      <li key={n}>{n}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-zinc-500">Not on org shortlist.</p>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-1">
                  <Briefcase className="h-3.5 w-3.5" /> Job invites
                </h3>
                {drawerJobs.length === 0 ? (
                  <p className="text-xs text-zinc-500">No job invites from this org.</p>
                ) : (
                  <ul className="space-y-3">
                    {drawerJobs.map((j) => (
                      <li key={j.job_id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-xs space-y-1">
                        <p className="font-medium text-zinc-900 dark:text-zinc-100">{j.job_title}</p>
                        <p className="text-zinc-500">Invited {new Date(j.invited_at).toLocaleString()}</p>
                        <p>
                          Response: <strong>{j.creator_response ?? "pending"}</strong>
                          {j.viewed_at == null ? " · inbox not opened" : " · opened inbox"}
                        </p>
                        <p>
                          Applied: <strong>{j.has_application ? "yes" : "no"}</strong>
                          {" · "}
                          Active deal: <strong>{j.has_active_deal ? "yes" : "no"}</strong>
                        </p>
                        {j.kol_list_name && <p className="text-zinc-500">List: {j.kol_list_name}</p>}
                        <div className="flex flex-wrap gap-2 pt-2">
                          <button type="button" className="text-[11px] px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800" onClick={() => { setSelectedJobId(j.job_id); setTab("jobs"); setDrawerProfileId(null); }}>
                            Open job
                          </button>
                          {j.active_deal_id && (
                            <button type="button" className="text-[11px] px-2 py-1 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-900 dark:text-violet-100" onClick={() => setRoute({ name: "dealDetail", data: { dealId: j.active_deal_id } })}>
                              Open deal
                            </button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section>
                <h3 className="text-xs font-bold uppercase tracking-wide text-zinc-400 mb-2 flex items-center gap-1">
                  <Sparkles className="h-3.5 w-3.5" /> Programs
                </h3>
                {drawerProgs.length === 0 ? (
                  <p className="text-xs text-zinc-500">No program invites.</p>
                ) : (
                  <ul className="space-y-2">
                    {drawerProgs.map((pr) => (
                      <li key={pr.id ?? pr.creator_program_id} className="rounded-lg border border-zinc-200 dark:border-zinc-700 p-3 text-xs">
                        <p className="font-medium">{pr.program_title}</p>
                        <p className="text-zinc-500">
                          Status: {pr.status} · {new Date(pr.invited_at).toLocaleDateString()}
                        </p>
                        <button type="button" className="mt-2 text-[11px] px-2 py-1 rounded bg-amber-100 dark:bg-amber-900/40" onClick={() => { setSelectedProgramId(pr.creator_program_id); setTab("jobs"); setDrawerProfileId(null); }}>
                          Program in Jobs tab
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
            <div className="p-3 border-t border-zinc-200 dark:border-zinc-700 flex items-center gap-2 text-[11px] text-zinc-500">
              <PanelRightOpen className="h-4 w-4 shrink-0" />
              Accept/reject applicants and full program management stay on Jobs tab.
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
