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

export type SavedViewFilters = {
  search: string;
  priorityFilter: string;
  stageFilter: string;
  jobFilter: string;
  programFilter: string;
  listFilter: string;
  compact: boolean;
  archiveOpen: boolean;
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

function filtersPayload(
  search: string,
  priorityFilter: string,
  stageFilter: string,
  jobFilter: string,
  programFilter: string,
  listFilter: string,
  compact: boolean,
  archiveOpen: boolean
): SavedViewFilters {
  return { search, priorityFilter, stageFilter, jobFilter, programFilter, listFilter, compact, archiveOpen };
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
}: OrgSourcingPipelineTabProps) {
  const [search, setSearch] = useState("");
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

  const filtered = useMemo(() => {
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

  const exportCsv = () => {
    const lines = ["creator,stage,track,context,waiting,profile_id"];
    filtered.forEach((r) => {
      const w = r.waiting === "org" ? "you" : r.waiting === "creator" ? "creator" : r.waiting;
      lines.push(
        `"${profLabel(r).replace(/"/g, '""')}","${r.stage}","${r.track}","${r.detail.replace(/"/g, '""')}","${w}","${r.profile_id}"`
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
                <th className={`px-2 ${py} font-medium text-right w-[1%]`}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
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
                  <td className={`px-2 ${py}`} onClick={(e) => e.stopPropagation()}>
                    {renderRowActions(r)}
                  </td>
                </tr>
              ))}
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
      const filters = filtersPayload(search, priorityFilter, stageFilter, jobFilter, programFilter, listFilter, compact, archiveOpen);
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
              Volume tools: saved views, multi-select, bulk shortlist (list members only), export. Grounded rows only.
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
            {(search || stageFilter !== "all" || jobFilter || programFilter || listFilter || priorityFilter !== "all") && (
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
