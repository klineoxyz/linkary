import React, { useState, useEffect, useCallback, useMemo } from "react";
import { ArrowLeft, Search, Users, Loader2, Plus, Trash2, Star, Mail, X } from "lucide-react";
import { CreatorRowCard, KOLSelectionSummaryCard } from "./KOLComponents";
import { supabase } from "@/lib/supabase";
import { listMyOrgs } from "@/lib/orgs";

/**
 * KOL Lists Page — /api/kol-lists.
 * Org mode (active org context): shortlist, invite to job/program, filters, real sourcing state.
 * Personal mode: unchanged list CRUD; no shortlist/invite UI.
 */

type KolList = {
  id: string;
  name: string;
  description?: string | null;
  status: string;
  members_count: number;
  owner_type?: "profile" | "org";
  owner_id?: string;
};
type ListMember = {
  id: string;
  profile_id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  notes?: string | null;
  shortlisted?: boolean;
};

type SourcingJobInvite = {
  id: string;
  job_id: string;
  profile_id: string;
  invited_at: string;
  job_title: string;
  has_application: boolean;
  has_active_deal: boolean;
};
type SourcingProgramInvite = {
  id: string;
  creator_program_id: string;
  profile_id: string;
  status: string;
  invited_at: string;
  program_title: string;
};

export default function KOLListsPage({
  setRoute,
  me,
  activeOrgContextId,
  activeOrgName,
  inviteHint,
  onConsumeInviteHint,
}: {
  setRoute?: (r: any) => void;
  me?: { id: string } | null;
  activeOrgContextId?: string | null;
  activeOrgName?: string | null;
  inviteHint?: { suggestJobId?: string; suggestProgramId?: string } | null;
  onConsumeInviteHint?: () => void;
}) {
  const orgOps = !!activeOrgContextId;
  const [lists, setLists] = useState<KolList[]>([]);
  const [listsLoading, setListsLoading] = useState(true);
  const [selectedListId, setSelectedListId] = useState<string | null>(null);
  const [listMembers, setListMembers] = useState<ListMember[]>([]);
  const [listMembersLoading, setListMembersLoading] = useState(false);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [createListName, setCreateListName] = useState("");
  const [createListOpen, setCreateListOpen] = useState(false);
  const [createListLoading, setCreateListLoading] = useState(false);
  const [createAsOrg, setCreateAsOrg] = useState(false);
  const [createOrgId, setCreateOrgId] = useState("");
  const [myOrgs, setMyOrgs] = useState<{ id: string; name: string }[]>([]);

  const [addToListLoading, setAddToListLoading] = useState<string | null>(null);
  const [shortlistLoading, setShortlistLoading] = useState<string | null>(null);

  const [filterShortlistOnly, setFilterShortlistOnly] = useState(false);
  const [filterInvitedOnly, setFilterInvitedOnly] = useState(false);

  const [sourcingLoading, setSourcingLoading] = useState(false);
  const [jobInvitesByProfile, setJobInvitesByProfile] = useState<Record<string, SourcingJobInvite[]>>({});
  const [programInvitesByProfile, setProgramInvitesByProfile] = useState<Record<string, SourcingProgramInvite[]>>({});

  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteMember, setInviteMember] = useState<ListMember | null>(null);
  const [inviteTargetType, setInviteTargetType] = useState<"job" | "program">("job");
  const [inviteJobId, setInviteJobId] = useState("");
  const [inviteProgramId, setInviteProgramId] = useState("");
  const [orgJobs, setOrgJobs] = useState<Array<{ id: string; title: string; status?: string }>>([]);
  const [orgPrograms, setOrgPrograms] = useState<Array<{ id: string; title: string }>>([]);
  const [inviteSubmitting, setInviteSubmitting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);

  const base = typeof window !== "undefined" ? window.location.origin : "";

  const loadLists = useCallback(async () => {
    if (!me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setListsLoading(true);
    const orgsList = await listMyOrgs(me.id);
    setMyOrgs(orgsList.map((o) => ({ id: o.id, name: o.name ?? "" })));
    if (activeOrgContextId) {
      const orgRes = await fetch(`${base}/api/kol-lists?owner=org&org_id=${encodeURIComponent(activeOrgContextId)}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const orgData = await orgRes.json().catch(() => ({}));
      setLists(Array.isArray(orgData.lists) ? orgData.lists : []);
    } else {
      const profileRes = await fetch(`${base}/api/kol-lists`, { headers: { Authorization: `Bearer ${token}` } });
      const profileData = await profileRes.json().catch(() => ({}));
      let allLists = Array.isArray(profileData.lists) ? profileData.lists : [];
      for (const org of orgsList) {
        const orgRes = await fetch(`${base}/api/kol-lists?owner=org&org_id=${encodeURIComponent(org.id)}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const orgData = await orgRes.json().catch(() => ({}));
        const orgLists = Array.isArray(orgData.lists) ? orgData.lists : [];
        allLists = [...allLists, ...orgLists];
      }
      setLists(allLists);
    }
    setListsLoading(false);
  }, [me?.id, base, activeOrgContextId]);

  useEffect(() => {
    loadLists();
  }, [loadLists]);

  useEffect(() => {
    if (activeOrgContextId) {
      setCreateAsOrg(true);
      setCreateOrgId(activeOrgContextId);
    } else {
      setCreateAsOrg(false);
      setCreateOrgId("");
    }
  }, [activeOrgContextId]);

  const loadSourcing = useCallback(async () => {
    if (!activeOrgContextId || !me?.id) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setSourcingLoading(true);
    const res = await fetch(`${base}/api/orgs/${encodeURIComponent(activeOrgContextId)}/sourcing`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await res.json().catch(() => ({}));
    setSourcingLoading(false);
    if (!res.ok) return;
    const ji: SourcingJobInvite[] = Array.isArray(data.job_invites) ? data.job_invites : [];
    const pi: SourcingProgramInvite[] = Array.isArray(data.program_invites) ? data.program_invites : [];
    const jm: Record<string, SourcingJobInvite[]> = {};
    const pm: Record<string, SourcingProgramInvite[]> = {};
    for (const row of ji) {
      if (!jm[row.profile_id]) jm[row.profile_id] = [];
      jm[row.profile_id].push(row);
    }
    for (const row of pi) {
      if (!pm[row.profile_id]) pm[row.profile_id] = [];
      pm[row.profile_id].push(row);
    }
    setJobInvitesByProfile(jm);
    setProgramInvitesByProfile(pm);
  }, [activeOrgContextId, me?.id, base]);

  useEffect(() => {
    if (orgOps) void loadSourcing();
  }, [orgOps, loadSourcing]);

  const loadOrgTargets = useCallback(async () => {
    if (!activeOrgContextId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const [jobsRes, progRes] = await Promise.all([
      fetch(`${base}/api/orgs/${encodeURIComponent(activeOrgContextId)}/jobs`),
      token
        ? fetch(`${base}/api/creator-programs?org_id=${encodeURIComponent(activeOrgContextId)}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
        : Promise.resolve({ json: async () => ({ programs: [] }) } as Response),
    ]);
    const jobsJson = await jobsRes.json().catch(() => ({}));
    const progJson = await progRes.json().catch(() => ({}));
    setOrgJobs(
      (Array.isArray(jobsJson.jobs) ? jobsJson.jobs : [])
        .filter((j: { status?: string }) => j.status === "open" || j.status === "draft")
        .map((j: { id: string; title: string; status?: string }) => ({ id: j.id, title: j.title, status: j.status }))
    );
    setOrgPrograms(Array.isArray(progJson.programs) ? progJson.programs.map((p: { id: string; title: string }) => ({ id: p.id, title: p.title })) : []);
  }, [activeOrgContextId, base]);

  useEffect(() => {
    if (inviteOpen && orgOps) void loadOrgTargets();
  }, [inviteOpen, orgOps, loadOrgTargets]);

  useEffect(() => {
    if (!inviteHint || !onConsumeInviteHint) return;
    if (inviteHint.suggestJobId) {
      setInviteTargetType("job");
      setInviteJobId(inviteHint.suggestJobId);
    }
    if (inviteHint.suggestProgramId) {
      setInviteTargetType("program");
      setInviteProgramId(inviteHint.suggestProgramId);
    }
    onConsumeInviteHint();
  }, [inviteHint, onConsumeInviteHint]);

  const loadListMembers = useCallback(async () => {
    if (!selectedListId) {
      setListMembers([]);
      return;
    }
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setListMembersLoading(true);
    const res = await fetch(`${base}/api/kol-lists/${selectedListId}`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setListMembersLoading(false);
    if (data.members) setListMembers(data.members);
    else setListMembers([]);
  }, [selectedListId, base]);

  useEffect(() => {
    loadListMembers();
  }, [loadListMembers]);

  const selectedList = lists.find((l) => l.id === selectedListId);
  const selectedListIsOrgOwned =
    selectedList?.owner_type === "org" && (!!activeOrgContextId ? selectedList.owner_id === activeOrgContextId : true);

  const profileHasAnyInvite = useCallback(
    (pid: string) =>
      (jobInvitesByProfile[pid]?.length ?? 0) > 0 ||
      (programInvitesByProfile[pid]?.some((p) => p.status === "invited" || p.status === "applied" || p.status === "active") ??
        false),
    [jobInvitesByProfile, programInvitesByProfile]
  );

  const filteredMembers = useMemo(() => {
    let m = listMembers;
    if (orgOps && filterShortlistOnly) m = m.filter((x) => x.shortlisted);
    if (orgOps && filterInvitedOnly) m = m.filter((x) => profileHasAnyInvite(x.profile_id));
    return m;
  }, [listMembers, orgOps, filterShortlistOnly, filterInvitedOnly, profileHasAnyInvite]);

  const doSearch = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setSearchResults([]);
        return;
      }
      setSearchLoading(true);
      const res = await fetch(`${base}/api/search?q=${encodeURIComponent(q.trim())}&filter=people`);
      const data = await res.json().catch(() => ({}));
      const list = (data.results ?? []).filter((r: any) => r.type === "person");
      setSearchResults(
        list.map((r: any) => ({
          id: r.id,
          name: r.name,
          handle: (r.handleLabel || "").replace(/^@/, ""),
          reach: 0,
          topGeo: null,
          verified: !!r.verified,
          roleTags: [],
          avatar: r.avatar,
        }))
      );
      setSearchLoading(false);
    },
    [base]
  );

  useEffect(() => {
    const t = setTimeout(() => doSearch(searchQuery), 300);
    return () => clearTimeout(t);
  }, [searchQuery, doSearch]);

  const handleCreateList = async () => {
    if (!me?.id || !createListName.trim()) return;
    if (createAsOrg && !createOrgId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setCreateListLoading(true);
    const ownerType = createAsOrg ? "org" : "profile";
    const ownerId = createAsOrg ? createOrgId : me.id;
    const res = await fetch(`${base}/api/kol-lists`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ name: createListName.trim(), owner_type: ownerType, owner_id: ownerId }),
    });
    const data = await res.json().catch(() => ({}));
    setCreateListLoading(false);
    if (data.list) {
      setCreateListName("");
      setCreateListOpen(false);
      setCreateAsOrg(false);
      setCreateOrgId("");
      loadLists();
      setSelectedListId(data.list.id);
    }
  };

  const addMemberToList = async (profileId: string) => {
    if (!selectedListId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setAddToListLoading(profileId);
    await fetch(`${base}/api/kol-lists/${selectedListId}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile_id: profileId }),
    });
    setAddToListLoading(null);
    loadListMembers();
    if (orgOps) void loadSourcing();
  };

  const removeMemberFromList = async (profileId: string) => {
    if (!selectedListId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    await fetch(`${base}/api/kol-lists/${selectedListId}/members?profile_id=${encodeURIComponent(profileId)}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    loadListMembers();
  };

  const toggleShortlist = async (profileId: string, next: boolean) => {
    if (!selectedListId || !orgOps || !selectedListIsOrgOwned) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setShortlistLoading(profileId);
    const res = await fetch(`${base}/api/kol-lists/${selectedListId}/members/shortlist`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ profile_id: profileId, shortlisted: next }),
    });
    setShortlistLoading(null);
    if (res.ok) loadListMembers();
  };

  const openInvite = (m: ListMember) => {
    if (!orgOps || !selectedListIsOrgOwned) return;
    setInviteMember(m);
    setInviteError(null);
    setInviteSuccess(null);
    setInviteOpen(true);
  };

  const submitInvite = async () => {
    if (!inviteMember || !activeOrgContextId) return;
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setInviteSubmitting(true);
    setInviteError(null);
    setInviteSuccess(null);
    try {
      if (inviteTargetType === "job") {
        if (!inviteJobId) {
          setInviteError("Select a job or sprint");
          setInviteSubmitting(false);
          return;
        }
        const res = await fetch(`${base}/api/orgs/${encodeURIComponent(activeOrgContextId)}/job-invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            job_id: inviteJobId,
            profile_id: inviteMember.profile_id,
            kol_list_id: selectedListId,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInviteError(j.error || "Could not create invite");
          setInviteSubmitting(false);
          return;
        }
        setInviteSuccess(`Invited to job: ${j.job_title ?? "job"}`);
      } else {
        if (!inviteProgramId) {
          setInviteError("Select a creator program");
          setInviteSubmitting(false);
          return;
        }
        const res = await fetch(`${base}/api/creator-programs/${encodeURIComponent(inviteProgramId)}/invites`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({
            profile_id: inviteMember.profile_id,
            source_type: "kol_list",
            source_id: selectedListId,
          }),
        });
        const j = await res.json().catch(() => ({}));
        if (!res.ok) {
          setInviteError(j.error || "Could not create invite");
          setInviteSubmitting(false);
          return;
        }
        setInviteSuccess("Program invite sent");
      }
      await loadSourcing();
      setInviteSubmitting(false);
    } catch (e) {
      setInviteError(String(e));
      setInviteSubmitting(false);
    }
  };

  const renderMemberBadges = (pid: string) => {
    const jobs = jobInvitesByProfile[pid] ?? [];
    const progs = programInvitesByProfile[pid] ?? [];
    const bits: React.ReactNode[] = [];
    if (jobs.length) {
      bits.push(
        <span key="ji" className="text-[10px] px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 dark:bg-indigo-900/50 dark:text-indigo-200">
          Job invite{jobs.length > 1 ? `s (${jobs.length})` : ""}
        </span>
      );
      if (jobs.some((j) => j.has_application)) {
        bits.push(
          <span key="ap" className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Applied
          </span>
        );
      }
      if (jobs.some((j) => j.has_active_deal)) {
        bits.push(
          <span key="dl" className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
            Active deal
          </span>
        );
      }
    }
    for (const p of progs) {
      const st = p.status;
      bits.push(
        <span
          key={p.id}
          className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100"
          title={p.program_title}
        >
          Program: {st}
        </span>
      );
    }
    return <div className="flex flex-wrap gap-1 mt-1">{bits}</div>;
  };

  const isSearchActive = searchQuery.trim().length >= 2;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-[1600px] mx-auto px-8 py-6">
          <button
            onClick={() => setRoute?.({ name: "overview" })}
            className="flex items-center gap-2 text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-100 transition-colors mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-medium">Back to overview</span>
          </button>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-zinc-900 dark:text-zinc-100 mb-2">
                {activeOrgContextId ? `KOL lists · ${activeOrgName ?? "Org"}` : "KOL lists"}
              </h1>
              <p className="text-zinc-600 dark:text-zinc-400">
                {activeOrgContextId
                  ? `${activeOrgName ?? "This org"} is sourcing: shortlist creators, invite them to a real job/sprint or creator program. States reflect saved invites and, for jobs, applications and active deals.`
                  : "Create lists of creators for campaigns and gigs. Switch to org workspace for org shortlist + invites."}
              </p>
              {activeOrgContextId && (
                <button
                  type="button"
                  onClick={() =>
                    setRoute?.({ name: "orgDetail", data: { orgId: activeOrgContextId, tab: "dashboard" } })
                  }
                  className="mt-3 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Workspace — full invite pipeline (shortlist → invited → applied → deal)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1600px] mx-auto px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400" />
                  <input
                    type="text"
                    placeholder="Search creators by name or handle (min 2 chars)..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full h-11 pl-10 pr-4 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-indigo-500"
                  />
                  {searchLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-zinc-400 animate-spin" />}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-sm text-zinc-600 dark:text-zinc-400">
                {isSearchActive
                  ? `${searchResults.length} creator${searchResults.length !== 1 ? "s" : ""} found`
                  : "Type 2+ characters to search real profiles"}
              </span>
            </div>

            <div className="space-y-3">
              {searchResults.map((creator) => (
                <div key={creator.id} className="flex items-center justify-between gap-4 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4">
                  <CreatorRowCard creator={creator} isSelected={listMembers.some((m) => m.profile_id === creator.id)} onToggle={() => {}} />
                  {selectedListId ? (
                    listMembers.some((m) => m.profile_id === creator.id) ? (
                      <span className="text-xs text-zinc-500 shrink-0">In list</span>
                    ) : (
                      <button
                        type="button"
                        disabled={addToListLoading === creator.id}
                        onClick={() => addMemberToList(creator.id)}
                        className="shrink-0 text-sm font-medium text-primary hover:underline disabled:opacity-50"
                      >
                        {addToListLoading === creator.id ? "Adding…" : "Add to list"}
                      </button>
                    )
                  ) : (
                    <span className="text-xs text-zinc-500 shrink-0">Select a list first</span>
                  )}
                </div>
              ))}
              {isSearchActive && searchResults.length === 0 && !searchLoading && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-12 text-center">
                  <Users className="h-12 w-12 text-zinc-300 mx-auto mb-3" />
                  <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">No creators found</h3>
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">Try a different search term</p>
                </div>
              )}
            </div>
          </div>

          <div className="lg:col-span-1">
            <div className="sticky top-8 space-y-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-3">{activeOrgContextId ? "Org lists" : "Your lists"}</h3>
                {listsLoading && <p className="text-sm text-zinc-500">Loading…</p>}
                {!listsLoading && lists.length === 0 && <p className="text-sm text-zinc-500">No lists yet. Create one below.</p>}
                {!listsLoading && lists.length > 0 && (
                  <select
                    value={selectedListId ?? ""}
                    onChange={(e) => setSelectedListId(e.target.value || null)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="">Select a list</option>
                    {lists.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name} ({l.members_count ?? 0})
                        {l.owner_type === "org" ? " · org" : ""}
                      </option>
                    ))}
                  </select>
                )}
                <button
                  type="button"
                  onClick={() => setCreateListOpen(true)}
                  className="mt-3 flex items-center gap-2 text-sm font-medium text-primary hover:underline"
                >
                  <Plus className="h-4 w-4" />
                  Create new list
                </button>
              </div>

              {orgOps && selectedListId && selectedListIsOrgOwned && (
                <div className="rounded-xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/50 dark:bg-indigo-950/30 p-4 text-sm space-y-2">
                  <p className="font-medium text-indigo-950 dark:text-indigo-100">List filters</p>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" checked={filterShortlistOnly} onChange={(e) => setFilterShortlistOnly(e.target.checked)} />
                    Shortlisted only
                  </label>
                  <label className="flex items-center gap-2 text-zinc-700 dark:text-zinc-300">
                    <input type="checkbox" checked={filterInvitedOnly} onChange={(e) => setFilterInvitedOnly(e.target.checked)} />
                    Invited only (job or pending program)
                  </label>
                  {sourcingLoading && <p className="text-xs text-zinc-500">Refreshing invite state…</p>}
                </div>
              )}

              {createListOpen && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm">
                  <input
                    type="text"
                    placeholder="List name"
                    value={createListName}
                    onChange={(e) => setCreateListName(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-600 mb-2 text-zinc-900 dark:bg-zinc-800"
                  />
                  {!activeOrgContextId && (
                    <label className="flex items-center gap-2 mb-2 text-sm text-zinc-700 dark:text-zinc-300">
                      <input
                        type="checkbox"
                        checked={createAsOrg}
                        onChange={(e) => {
                          setCreateAsOrg(e.target.checked);
                          if (!e.target.checked) setCreateOrgId("");
                        }}
                      />
                      Create as organization list
                    </label>
                  )}
                  {createAsOrg && myOrgs.length > 0 && !activeOrgContextId && (
                    <select
                      value={createOrgId}
                      onChange={(e) => setCreateOrgId(e.target.value)}
                      className="w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-600 mb-2 text-zinc-900 dark:bg-zinc-800"
                    >
                      <option value="">Select org...</option>
                      {myOrgs.map((o) => (
                        <option key={o.id} value={o.id}>
                          {o.name}
                        </option>
                      ))}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={handleCreateList}
                      disabled={createListLoading || !createListName.trim() || (createAsOrg && !createOrgId)}
                      className="rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                    >
                      {createListLoading ? "Creating…" : "Create"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateListOpen(false);
                        setCreateAsOrg(false);
                        setCreateOrgId("");
                      }}
                      className="rounded-lg border border-zinc-200 dark:border-zinc-600 px-3 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {selectedListId && (
                <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-6 shadow-sm">
                  <h3 className="font-semibold text-zinc-900 dark:text-zinc-100 mb-2">{selectedList?.name ?? "List"} members</h3>
                  {listMembersLoading && <p className="text-sm text-zinc-500">Loading…</p>}
                  {!listMembersLoading && filteredMembers.length === 0 && (
                    <p className="text-sm text-zinc-500">
                      {listMembers.length === 0 ? "No members. Search and add creators." : "No members match filters."}
                    </p>
                  )}
                  {!listMembersLoading && filteredMembers.length > 0 && (
                    <ul className="space-y-2 max-h-[480px] overflow-y-auto">
                      {filteredMembers.map((m) => (
                        <li
                          key={m.id}
                          className="rounded-lg border border-zinc-100 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 px-3 py-2"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-medium text-zinc-900 dark:text-zinc-100 truncate">
                                  {m.display_name ?? m.username ?? "—"}
                                </span>
                                {orgOps && selectedListIsOrgOwned && m.shortlisted && (
                                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500 shrink-0" aria-label="Shortlisted" />
                                )}
                              </div>
                              <span className="text-xs text-zinc-500">@{m.username ?? ""}</span>
                              {orgOps && selectedListIsOrgOwned && renderMemberBadges(m.profile_id)}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              {orgOps && selectedListIsOrgOwned && (
                                <>
                                  <button
                                    type="button"
                                    disabled={shortlistLoading === m.profile_id}
                                    onClick={() => toggleShortlist(m.profile_id, !m.shortlisted)}
                                    className="text-[11px] px-2 py-1 rounded border border-zinc-200 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                                    title="Shortlist"
                                  >
                                    {shortlistLoading === m.profile_id ? "…" : m.shortlisted ? "Unshortlist" : "Shortlist"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => openInvite(m)}
                                    className="text-[11px] px-2 py-1 rounded bg-indigo-600 text-white hover:bg-indigo-700"
                                  >
                                    <span className="inline-flex items-center gap-1">
                                      <Mail className="h-3 w-3" /> Invite
                                    </span>
                                  </button>
                                </>
                              )}
                              <button
                                type="button"
                                onClick={() => removeMemberFromList(m.profile_id)}
                                className="shrink-0 p-1 text-zinc-400 hover:text-destructive"
                                aria-label="Remove"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <KOLSelectionSummaryCard
                selectedCreators={listMembers.map((m) => ({
                  id: m.profile_id,
                  name: m.display_name ?? m.username ?? "—",
                  handle: m.username ?? "",
                  reach: 0,
                  topGeo: null,
                  verified: false,
                  roleTags: [],
                }))}
                onSave={() => {}}
                onInviteToGig={() => {}}
                onExport={() => {}}
                onClear={() => {}}
              />
            </div>
          </div>
        </div>
      </div>

      {inviteOpen && inviteMember && orgOps && activeOrgContextId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-700 shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">Invite creator</h2>
                <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                  Org: <strong>{activeOrgName ?? activeOrgContextId.slice(0, 8)}</strong>
                </p>
                <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-2">
                  {inviteMember.display_name ?? inviteMember.username} (@{inviteMember.username})
                </p>
              </div>
              <button type="button" onClick={() => setInviteOpen(false)} className="p-1 text-zinc-500 hover:text-zinc-800">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-medium text-zinc-500">Target type</label>
                <div className="flex gap-2 mt-1">
                  <button
                    type="button"
                    onClick={() => setInviteTargetType("job")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      inviteTargetType === "job"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
                        : "border-zinc-200 dark:border-zinc-600"
                    }`}
                  >
                    Job / sprint
                  </button>
                  <button
                    type="button"
                    onClick={() => setInviteTargetType("program")}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border ${
                      inviteTargetType === "program"
                        ? "border-indigo-600 bg-indigo-50 text-indigo-900 dark:bg-indigo-950 dark:text-indigo-100"
                        : "border-zinc-200 dark:border-zinc-600"
                    }`}
                  >
                    Creator program
                  </button>
                </div>
              </div>

              {inviteTargetType === "job" ? (
                <div>
                  <label className="text-xs font-medium text-zinc-500">Job or sprint</label>
                  <select
                    value={inviteJobId}
                    onChange={(e) => setInviteJobId(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="">Select…</option>
                    {orgJobs.map((j) => (
                      <option key={j.id} value={j.id}>
                        {j.title} {j.status ? `(${j.status})` : ""}
                      </option>
                    ))}
                  </select>
                  {orgJobs.length === 0 && <p className="text-xs text-amber-600 mt-1">No open jobs. Create one on Workspace → Jobs.</p>}
                </div>
              ) : (
                <div>
                  <label className="text-xs font-medium text-zinc-500">Program</label>
                  <select
                    value={inviteProgramId}
                    onChange={(e) => setInviteProgramId(e.target.value)}
                    className="mt-1 w-full h-10 px-3 rounded-lg border border-zinc-200 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  >
                    <option value="">Select…</option>
                    {orgPrograms.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                  {orgPrograms.length === 0 && (
                    <p className="text-xs text-amber-600 mt-1">No programs. Create one on Workspace → Jobs → Creator programs.</p>
                  )}
                </div>
              )}

              {inviteError && <p className="text-sm text-red-600">{inviteError}</p>}
              {inviteSuccess && <p className="text-sm text-emerald-600">{inviteSuccess}</p>}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  disabled={inviteSubmitting}
                  onClick={submitInvite}
                  className="flex-1 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
                >
                  {inviteSubmitting ? "Sending…" : "Send invite"}
                </button>
                <button
                  type="button"
                  onClick={() => setInviteOpen(false)}
                  className="px-4 py-2.5 rounded-lg border border-zinc-200 dark:border-zinc-600 text-sm"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
