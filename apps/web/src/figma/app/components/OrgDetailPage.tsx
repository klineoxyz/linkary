"use client";

import React, { useState, useEffect } from "react";
import {
  Building2,
  Users,
  UserPlus,
  TrendingUp,
  X,
  ArrowLeft,
  Loader2,
  Settings,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  getOrgById,
  getOrgBySlug,
  listOrgMembers,
  listOrgAffiliations,
  listOrgAmbassadors,
  getOrgMetrics,
  inviteAffiliateByHandle,
  inviteAmbassadorByHandle,
  recomputeOrgMetrics,
  isOrgAdmin,
  updateOrg,
  type Org,
  type OrgMember,
  type OrgAffiliation,
  type OrgAmbassador,
} from "@/lib/orgs";
import { listJobs, listApplicationsForJobs, type Application } from "@/lib/jobs";
import { listCaseStudiesForOrg, createCaseStudyForOrg, type CaseStudy } from "@/lib/caseStudies";
import { Briefcase } from "lucide-react";

export default function OrgDetailPage({
  setRoute,
  data,
}: {
  setRoute: (r: { name: string; data?: any }) => void;
  data?: { orgId?: string; slug?: string; showConnectXBanner?: boolean };
}) {
  const orgId = data?.orgId ?? data?.slug;
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"members" | "affiliates" | "ambassadors" | "jobs" | "case_studies" | "settings">("members");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [affiliations, setAffiliations] = useState<OrgAffiliation[]>([]);
  const [ambassadors, setAmbassadors] = useState<OrgAmbassador[]>([]);
  const [metrics, setMetrics] = useState<{ combined_followers: number; avg_engagement_rate: number; potential_reach: number } | null>(null);
  const [orgJobs, setOrgJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [acceptLoading, setAcceptLoading] = useState<string | null>(null);
  const [closeJobLoading, setCloseJobLoading] = useState<string | null>(null);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [affiliateHandle, setAffiliateHandle] = useState("");
  const [ambassadorHandle, setAmbassadorHandle] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [recomputeLoading, setRecomputeLoading] = useState(false);
  const [showCaseStudyModal, setShowCaseStudyModal] = useState(false);
  const [caseStudyTitle, setCaseStudyTitle] = useState("");
  const [caseStudyDescription, setCaseStudyDescription] = useState("");
  const [caseStudyProofUrl, setCaseStudyProofUrl] = useState("");
  const [caseStudySaving, setCaseStudySaving] = useState(false);
  const [showCreateJobModal, setShowCreateJobModal] = useState(false);
  const [jobType, setJobType] = useState<"job" | "sprint">("job");
  const [jobTitle, setJobTitle] = useState("");
  const [jobBudget, setJobBudget] = useState("");
  const [jobDuration, setJobDuration] = useState("");
  const [jobTagsStr, setJobTagsStr] = useState("");
  const [jobSaving, setJobSaving] = useState(false);
  const [isCryptoProject, setIsCryptoProject] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [dexscreenerUrl, setDexscreenerUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [connectXLoading, setConnectXLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [dismissConnectXBanner, setDismissConnectXBanner] = useState(false);
  const [membersWithProfiles, setMembersWithProfiles] = useState<Array<OrgMember & { profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null }>>([]);
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [memberUsername, setMemberUsername] = useState("");
  const [memberRole, setMemberRole] = useState<"member" | "admin" | "owner">("member");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState<Record<string, boolean>>({});
  const [roleChangeLoading, setRoleChangeLoading] = useState<Record<string, boolean>>({});

  useEffect(() => void loadSession(), []);
  function loadSession() {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
    });
  }

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const o = data?.orgId
        ? await getOrgById(data.orgId)
        : await getOrgBySlug(orgId as string);
      setOrg(o ?? null);
      if (o) {
        setIsCryptoProject(!!o.is_crypto_project);
        setHasToken(!!o.has_token);
        setTokenSymbol(o.token_symbol ?? "");
        setDexscreenerUrl(o.dexscreener_url ?? "");
        setPublished(!!o.published);
        const [m, a, am, met, jobsAll, cs] = await Promise.all([
          listOrgMembers(o.id),
          listOrgAffiliations(o.id),
          listOrgAmbassadors(o.id),
          getOrgMetrics(o.id),
          listJobs(),
          listCaseStudiesForOrg(o.id),
        ]);
        setMembers(m);
        setAffiliations(a);
        setAmbassadors(am);
        setMetrics(met ? { combined_followers: met.combined_followers, avg_engagement_rate: met.avg_engagement_rate, potential_reach: met.potential_reach } : null);
        const jobsForOrg = (jobsAll ?? []).filter((j: { org_id: string }) => j.org_id === o.id);
        setOrgJobs(jobsForOrg);
        const appList = jobsForOrg.length ? await listApplicationsForJobs(jobsForOrg.map((j: { id: string }) => j.id)) : [];
        setApplications(appList);
        setCaseStudies(cs ?? []);
        if (userId) {
          const isAdmin = await isOrgAdmin(userId, o.id);
          setAdmin(isAdmin);
        }
      }
      setLoading(false);
    })();
  }, [orgId, data?.orgId, userId]);

  const fetchMembersWithProfiles = async () => {
    if (!org?.id) return;
    setMembersLoadError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMembersWithProfiles(members);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/orgs/${org.id}/members`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      setMembersLoadError((err as { error?: string }).error ?? "Failed to load members");
      setMembersWithProfiles(members);
      return;
    }
    const data = await res.json();
    setMembersWithProfiles(data.members ?? members);
  };

  useEffect(() => {
    if (!org?.id || tab !== "members") return;
    setMembersWithProfiles(members.map((m) => ({ ...m, profile: null })));
    fetchMembersWithProfiles();
  }, [org?.id, tab, members.length]);

  const handleAddMember = async () => {
    if (!org?.id || !memberUsername.trim()) return;
    setMembersError(null);
    setAddMemberLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMembersError("Not signed in");
      setAddMemberLoading(false);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/orgs/${org.id}/members`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ username: memberUsername.trim(), role: memberRole }),
    });
    const out = await res.json().catch(() => ({}));
    setAddMemberLoading(false);
    if (!res.ok) {
      setMembersError((out as { error?: string }).error ?? "Failed to add member");
      return;
    }
    setMemberUsername("");
    setMembersError(null);
    await fetchMembersWithProfiles();
    await listOrgMembers(org.id).then(setMembers);
  };

  const handleRemoveMember = async (targetUserId: string) => {
    if (!org?.id) return;
    setRemoveLoading((prev) => ({ ...prev, [targetUserId]: true }));
    setMembersError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMembersError("Not signed in");
      setRemoveLoading((prev) => ({ ...prev, [targetUserId]: false }));
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/orgs/${org.id}/members/${targetUserId}`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
    });
    const out = await res.json().catch(() => ({}));
    setRemoveLoading((prev) => ({ ...prev, [targetUserId]: false }));
    if (!res.ok) {
      setMembersError((out as { error?: string }).error ?? "Failed to remove");
      return;
    }
    setMembersError(null);
    await fetchMembersWithProfiles();
    await listOrgMembers(org.id).then(setMembers);
  };

  const handleChangeRole = async (targetUserId: string, newRole: "member" | "admin" | "owner") => {
    if (!org?.id) return;
    setRoleChangeLoading((prev) => ({ ...prev, [targetUserId]: true }));
    setMembersError(null);
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setMembersError("Not signed in");
      setRoleChangeLoading((prev) => ({ ...prev, [targetUserId]: false }));
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/orgs/${org.id}/members/${targetUserId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ role: newRole }),
    });
    const out = await res.json().catch(() => ({}));
    setRoleChangeLoading((prev) => ({ ...prev, [targetUserId]: false }));
    if (!res.ok) {
      setMembersError((out as { error?: string }).error ?? "Failed to update role");
      return;
    }
    setMembersError(null);
    await fetchMembersWithProfiles();
    await listOrgMembers(org.id).then(setMembers);
  };

  const handleInvite = async (type: "affiliate" | "ambassador") => {
    const handle = type === "affiliate" ? affiliateHandle.trim() : ambassadorHandle.trim();
    if (!org || !userId || !handle) return;
    setInviteError(null);
    const fn = type === "affiliate" ? inviteAffiliateByHandle : inviteAmbassadorByHandle;
    const { error } = await fn(org.id, userId, handle);
    if (error) {
      setInviteError(error);
      return;
    }
    if (type === "affiliate") {
      setAffiliateHandle("");
      setAffiliations(await listOrgAffiliations(org.id));
    } else {
      setAmbassadorHandle("");
      setAmbassadors(await listOrgAmbassadors(org.id));
    }
  };

  const handleRecompute = async () => {
    if (!org || !admin) return;
    setRecomputeLoading(true);
    await recomputeOrgMetrics(org.id);
    const met = await getOrgMetrics(org.id);
    setMetrics(met ? { combined_followers: met.combined_followers, avg_engagement_rate: met.avg_engagement_rate, potential_reach: met.potential_reach } : null);
    setRecomputeLoading(false);
  };

  if (loading || !orgId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }
  if (!org) {
    return (
      <div className="p-6">
        <button
          onClick={() => setRoute({ name: "dashboard" })}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        <p className="text-gray-600">Org not found.</p>
      </div>
    );
  }

  const tabs = [
    { id: "members" as const, label: "Members", icon: Users },
    { id: "affiliates" as const, label: "Affiliates", icon: UserPlus },
    { id: "ambassadors" as const, label: "Ambassadors", icon: UserPlus },
    { id: "jobs" as const, label: "Jobs", icon: Briefcase },
    { id: "case_studies" as const, label: "Case Studies", icon: Building2 },
    { id: "settings" as const, label: "Settings", icon: Settings },
  ];

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <button
          onClick={() => setRoute({ name: "dashboard" })}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Dashboard
        </button>
        {admin && (
          <button
            onClick={handleRecompute}
            disabled={recomputeLoading}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
          >
            {recomputeLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <TrendingUp className="w-4 h-4" />}
            Recompute Influence
          </button>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 overflow-hidden">
        <div className="p-6 border-b border-zinc-200 dark:border-zinc-700 flex items-center gap-4">
          {org.logo_url ? (
            <img src={org.logo_url} alt={org.name} className="w-14 h-14 rounded-xl object-cover" />
          ) : (
            <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center">
              <Building2 className="w-7 h-7 text-primary" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{org.name}</h1>
            {org.tagline && <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-0.5">{org.tagline}</p>}
            <p className="text-xs text-zinc-500 mt-1">@{org.slug} · {org.org_type}</p>
            {metrics && (
              <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                <span>Followers: {(metrics.combined_followers ?? 0).toLocaleString()}</span>
                <span>Engagement: {((metrics.avg_engagement_rate ?? 0) * 100).toFixed(1)}%</span>
                <span>Reach: {(metrics.potential_reach ?? 0).toLocaleString()}</span>
              </div>
            )}
          </div>
        </div>

        <div className="flex border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "border-primary text-primary"
                  : "border-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-200"
              }`}
            >
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {tab === "members" && (
            <div className="space-y-4">
              {membersLoadError && (
                <p className="text-sm text-destructive">{membersLoadError}</p>
              )}
              {admin && (
                <div className="flex flex-wrap items-end gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="min-w-[140px]">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Username or @handle</label>
                    <input
                      type="text"
                      value={memberUsername}
                      onChange={(e) => { setMemberUsername(e.target.value); setMembersError(null); }}
                      placeholder="alice"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Role</label>
                    <select
                      value={memberRole}
                      onChange={(e) => setMemberRole(e.target.value as "member" | "admin" | "owner")}
                      className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={addMemberLoading || !memberUsername.trim()}
                    className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
                  >
                    {addMemberLoading ? "Adding…" : "Add member"}
                  </button>
                  {membersError && <p className="text-sm text-destructive w-full">{membersError}</p>}
                </div>
              )}
              {membersWithProfiles.length === 0 && !membersLoadError ? (
                <p className="text-zinc-500 text-sm">No members yet.</p>
              ) : (
                <ul className="space-y-0">
                  {membersWithProfiles.map((m) => (
                    <li key={m.id} className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0 gap-2">
                      <div className="flex items-center gap-3 min-w-0">
                        {m.profile?.avatar_url ? (
                          <img src={m.profile.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-zinc-200 dark:bg-zinc-700 shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
                            {m.profile?.display_name || m.profile?.username || m.user_id}
                          </p>
                          <p className="text-xs text-zinc-500 truncate">
                            {m.profile?.username ? `@${m.profile.username}` : m.user_id}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {admin ? (
                          <select
                            value={m.role}
                            onChange={(e) => handleChangeRole(m.user_id, e.target.value as "member" | "admin" | "owner")}
                            disabled={roleChangeLoading[m.user_id]}
                            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="owner">Owner</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-accent text-primary">{m.role}</span>
                        )}
                        {(admin || userId === m.user_id) && (
                          <button
                            type="button"
                            onClick={() => handleRemoveMember(m.user_id)}
                            disabled={removeLoading[m.user_id]}
                            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                          >
                            {removeLoading[m.user_id] ? "…" : userId === m.user_id ? "Leave" : "Remove"}
                          </button>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          {tab === "affiliates" && (
            <div className="space-y-4">
              {admin && (
                <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <input
                    type="text"
                    value={affiliateHandle}
                    onChange={(e) => {
                      setAffiliateHandle(e.target.value);
                      setInviteError(null);
                    }}
                    placeholder="Profile handle (e.g. alice)"
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  />
                  <button
                    onClick={() => handleInvite("affiliate")}
                    disabled={!affiliateHandle.trim()}
                    className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
                  >
                    Invite Affiliate
                  </button>
                  {inviteError && tab === "affiliates" && <p className="text-destructive text-sm w-full">{inviteError}</p>}
                </div>
              )}
              {affiliations.length === 0 ? (
                <p className="text-zinc-500 text-sm">No affiliates yet.</p>
              ) : (
                affiliations.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <span className="font-mono text-sm">{a.profile_id}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{a.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "ambassadors" && (
            <div className="space-y-4">
              {admin && (
                <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <input
                    type="text"
                    value={ambassadorHandle}
                    onChange={(e) => {
                      setAmbassadorHandle(e.target.value);
                      setInviteError(null);
                    }}
                    placeholder="Profile handle (e.g. bob)"
                    className="flex-1 min-w-[160px] px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                  />
                  <button
                    onClick={() => handleInvite("ambassador")}
                    disabled={!ambassadorHandle.trim()}
                    className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
                  >
                    Invite Ambassador
                  </button>
                  {inviteError && tab === "ambassadors" && <p className="text-destructive text-sm w-full">{inviteError}</p>}
                </div>
              )}
              {ambassadors.length === 0 ? (
                <p className="text-zinc-500 text-sm">No ambassadors yet.</p>
              ) : (
                ambassadors.map((a) => (
                  <div key={a.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <span className="font-mono text-sm">{a.profile_id}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{a.status}</span>
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "jobs" && (
            <div className="space-y-6">
              {admin && (
                <button
                  type="button"
                  onClick={() => setShowCreateJobModal(true)}
                  className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm"
                >
                  Create job
                </button>
              )}
              {orgJobs.length === 0 ? (
                <p className="text-zinc-500 text-sm">No jobs yet.</p>
              ) : (
                orgJobs.map((j) => {
                  const jobApps = applications.filter((a) => a.job_id === j.id);
                  const pending = jobApps.filter((a) => a.status === "pending");
                  const accepted = jobApps.filter((a) => a.status === "accepted");
                  const isOpen = j.status === "open";
                  return (
                    <div key={j.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700 space-y-3">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div>
                          <p className="font-medium text-zinc-900 dark:text-zinc-100">{j.title}</p>
                          <p className="text-xs text-zinc-500">{j.type} · {j.status}{j.budget ? ` · ${j.budget}` : ""}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => setRoute({ name: "market", data: { highlightJobId: j.id } })}
                            className="text-sm text-primary hover:opacity-90"
                          >
                            View in Marketplace
                          </button>
                          {admin && isOpen && (
                            <button
                              type="button"
                              disabled={!!closeJobLoading}
                              onClick={async () => {
                                if (!org?.id || !userId) return;
                                setCloseJobLoading(j.id);
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const token = session?.access_token;
                                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                                  const res = await fetch(`${origin}/api/orgs/${org.id}/jobs/${j.id}`, {
                                    method: "PATCH",
                                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                    body: JSON.stringify({ status: "completed" }),
                                  });
                                  if (res.ok) {
                                    const all = await listJobs();
                                    setOrgJobs((all ?? []).filter((job: { org_id: string }) => job.org_id === org.id));
                                    const jobsForOrg = (all ?? []).filter((job: { org_id: string }) => job.org_id === org.id);
                                    const appList = jobsForOrg.length ? await listApplicationsForJobs(jobsForOrg.map((job: { id: string }) => job.id)) : [];
                                    setApplications(appList);
                                  }
                                } finally {
                                  setCloseJobLoading(null);
                                }
                              }}
                              className="text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                            >
                              {closeJobLoading === j.id ? "…" : "Close job"}
                            </button>
                          )}
                        </div>
                      </div>
                      {jobApps.length > 0 && (
                        <div className="text-xs font-medium text-zinc-500 mt-2">Applicants ({pending.length} pending, {accepted.length} accepted)</div>
                      )}
                      {jobApps.map((app) => (
                        <div key={app.id} className="flex items-center justify-between py-2 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700">
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">
                            {app.applicant_type === "profile" ? `Profile ${app.applicant_profile_id ?? ""}` : `Org ${app.applicant_org_id ?? ""}`}
                            {app.message ? ` · "${app.message.slice(0, 40)}${app.message.length > 40 ? "…" : ""}"` : ""}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{app.status}</span>
                          {admin && app.status === "pending" && isOpen && (
                            <button
                              type="button"
                              disabled={!!acceptLoading}
                              onClick={async () => {
                                if (!userId) return;
                                setAcceptLoading(app.id);
                                try {
                                  const { data: { session } } = await supabase.auth.getSession();
                                  const token = session?.access_token;
                                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                                  const res = await fetch(`${origin}/api/applications/${app.id}/accept`, {
                                    method: "POST",
                                    headers: { Authorization: `Bearer ${token}` },
                                  });
                                  const json = await res.json().catch(() => ({}));
                                  if (res.ok && json?.deal) {
                                    const all = await listJobs();
                                    setOrgJobs((all ?? []).filter((job: { org_id: string }) => job.org_id === org?.id));
                                    const jobsForOrg = (all ?? []).filter((job: { org_id: string }) => job.org_id === org?.id);
                                    const appList = jobsForOrg.length ? await listApplicationsForJobs(jobsForOrg.map((job: { id: string }) => job.id)) : [];
                                    setApplications(appList);
                                    if (json.deal?.id && setRoute) setRoute({ name: "dealDetail", data: { dealId: json.deal.id } });
                                  }
                                } finally {
                                  setAcceptLoading(null);
                                }
                              }}
                              className="text-xs px-2 py-1 rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
                            >
                              {acceptLoading === app.id ? "…" : "Accept"}
                            </button>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "case_studies" && (
            <div className="space-y-4">
              {admin && (
                <button
                  type="button"
                  onClick={() => setShowCaseStudyModal(true)}
                  className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm"
                >
                  Add New
                </button>
              )}
              {caseStudies.length === 0 ? (
                <p className="text-zinc-500 text-sm">No case studies yet.</p>
              ) : (
                caseStudies.map((cs) => (
                  <div key={cs.id} className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <p className="font-medium text-zinc-900 dark:text-zinc-100">{cs.title ?? "Untitled"}</p>
                    {cs.description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{cs.description}</p>}
                    {cs.proof_url && (
                      <a href={cs.proof_url} target="_blank" rel="noopener noreferrer" className="text-xs text-primary mt-2 inline-block">Proof link</a>
                    )}
                  </div>
                ))
              )}
            </div>
          )}

          {tab === "settings" && (
            <div className="space-y-6 max-w-lg">
              {admin && org && !org.is_x_verified && data?.showConnectXBanner && !dismissConnectXBanner && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 flex items-start justify-between gap-2">
                  <p className="text-sm text-zinc-700 dark:text-zinc-300">Org created. Connect X to verify before publishing.</p>
                  <button type="button" onClick={() => setDismissConnectXBanner(true)} className="text-zinc-500 hover:text-zinc-700 shrink-0" aria-label="Dismiss">×</button>
                </div>
              )}
              {!admin ? (
                <p className="text-zinc-500 text-sm">Only org admins can edit settings.</p>
              ) : (
                <>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">X verification</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">
                      {org.is_x_verified ? (
                        <>Verified · @{org.x_account_username ?? "X"}</>
                      ) : (
                        <>Unverified · Connect the org&apos;s X account to enable public listing</>
                      )}
                    </p>
                    {!org.is_x_verified && (
                      <button
                        type="button"
                        disabled={connectXLoading}
                        onClick={async () => {
                          if (!org?.id || !userId) return;
                          setConnectXLoading(true);
                          try {
                            const origin = typeof window !== "undefined" ? window.location.origin : "";
                            const callback = `${origin}/auth/callback`;
                            sessionStorage.setItem("linkary_oauth_org_id", org.id);
                            sessionStorage.setItem("linkary_oauth_next", "/dashboard");
                            const { data, error: err } = await supabase.auth.signInWithOAuth({
                              provider: "x",
                              options: { redirectTo: callback },
                            });
                            if (err) {
                              setSettingsError(err.message);
                              return;
                            }
                            if (data?.url) window.location.href = data.url;
                            else setSettingsError("Could not start X sign-in.");
                          } finally {
                            setConnectXLoading(false);
                          }
                        }}
                        className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm font-medium hover:opacity-90 disabled:opacity-50"
                      >
                        {connectXLoading ? "Redirecting…" : "Connect org X account"}
                      </button>
                    )}
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Public listing</h3>
                    <label className={`flex items-center gap-2 mb-4 ${!org.is_x_verified ? "opacity-70" : ""}`}>
                      <input
                        type="checkbox"
                        checked={published}
                        onChange={(e) => setPublished(e.target.checked)}
                        disabled={!org.is_x_verified}
                        className="rounded border-zinc-300"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">
                        Show this org on Linkary search and landing (public listing)
                        {!org.is_x_verified && " · Connect X first"}
                      </span>
                    </label>
                  </div>
                  <div>
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Crypto &amp; token</h3>
                    <label className="flex items-center gap-2 mb-2">
                      <input
                        type="checkbox"
                        checked={isCryptoProject}
                        onChange={(e) => { setIsCryptoProject(e.target.checked); if (!e.target.checked) { setHasToken(false); setTokenSymbol(""); setDexscreenerUrl(""); } }}
                        className="rounded border-zinc-300"
                      />
                      <span className="text-sm text-zinc-700 dark:text-zinc-300">This is a crypto project</span>
                    </label>
                    {isCryptoProject && (
                      <>
                        <label className="flex items-center gap-2 mb-2 mt-3">
                          <input
                            type="checkbox"
                            checked={hasToken}
                            onChange={(e) => { setHasToken(e.target.checked); if (!e.target.checked) { setTokenSymbol(""); setDexscreenerUrl(""); } }}
                            className="rounded border-zinc-300"
                          />
                          <span className="text-sm text-zinc-700 dark:text-zinc-300">We have a token</span>
                        </label>
                        {hasToken && (
                          <div className="mt-3 space-y-2">
                            <div>
                              <label className="block text-xs font-medium text-zinc-500 mb-1">Token symbol (optional)</label>
                              <input
                                type="text"
                                value={tokenSymbol}
                                onChange={(e) => setTokenSymbol(e.target.value)}
                                placeholder="e.g. LINK"
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                              />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-zinc-500 mb-1">DexScreener link (paste chart URL)</label>
                              <input
                                type="url"
                                value={dexscreenerUrl}
                                onChange={(e) => setDexscreenerUrl(e.target.value)}
                                placeholder="https://dexscreener.com/..."
                                className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                              />
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  {settingsError && <p className="text-sm text-destructive">{settingsError}</p>}
                  <button
                    type="button"
                    disabled={settingsSaving || !org}
                    onClick={async () => {
                      if (!org) return;
                      setSettingsError(null);
                      setSettingsSaving(true);
                      const { error } = await updateOrg(org.id, {
                        published,
                        is_crypto_project: isCryptoProject,
                        has_token: hasToken ? true : false,
                        token_symbol: hasToken && tokenSymbol.trim() ? tokenSymbol.trim() : null,
                        dexscreener_url: hasToken && dexscreenerUrl.trim() ? dexscreenerUrl.trim() : null,
                      });
                      setSettingsSaving(false);
                      if (error) {
                        setSettingsError(error.includes("published") || error.includes("x_verified") ? "Connect the org X account first to enable public listing." : error);
                        if (error.includes("published") || error.includes("x_verified")) setPublished(false);
                      } else setOrg({ ...org, published, is_crypto_project: isCryptoProject, has_token: hasToken, token_symbol: tokenSymbol.trim() || null, dexscreener_url: dexscreenerUrl.trim() || null });
                    }}
                    className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
                  >
                    {settingsSaving ? "Saving…" : "Save settings"}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      {showCaseStudyModal && org && admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">New case study</h3>
            <input
              type="text"
              placeholder="Title"
              value={caseStudyTitle}
              onChange={(e) => setCaseStudyTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            />
            <textarea
              placeholder="Description"
              value={caseStudyDescription}
              onChange={(e) => setCaseStudyDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            />
            <input
              type="url"
              placeholder="Proof URL"
              value={caseStudyProofUrl}
              onChange={(e) => setCaseStudyProofUrl(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCaseStudyModal(false); setCaseStudyTitle(""); setCaseStudyDescription(""); setCaseStudyProofUrl(""); }}
                className="flex-1 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={caseStudySaving}
                onClick={async () => {
                  setCaseStudySaving(true);
                  const { error } = await createCaseStudyForOrg(org.id, {
                    title: caseStudyTitle.trim() || undefined,
                    description: caseStudyDescription.trim() || undefined,
                    proof_url: caseStudyProofUrl.trim() || undefined,
                  });
                  setCaseStudySaving(false);
                  if (!error) {
                    const cs = await listCaseStudiesForOrg(org.id);
                    setCaseStudies(cs ?? []);
                    setShowCaseStudyModal(false);
                    setCaseStudyTitle("");
                    setCaseStudyDescription("");
                    setCaseStudyProofUrl("");
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-primary hover:opacity-90 text-white disabled:opacity-50"
              >
                {caseStudySaving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCreateJobModal && org && admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-4">Create job</h3>
            <select
              value={jobType}
              onChange={(e) => setJobType(e.target.value as "job" | "sprint")}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            >
              <option value="job">Job</option>
              <option value="sprint">Sprint</option>
            </select>
            <input
              type="text"
              placeholder="Title"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            />
            <input
              type="text"
              placeholder="Budget (e.g. $500)"
              value={jobBudget}
              onChange={(e) => setJobBudget(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            />
            <input
              type="text"
              placeholder="Duration (e.g. 2 weeks)"
              value={jobDuration}
              onChange={(e) => setJobDuration(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
            />
            <input
              type="text"
              placeholder="Tags (comma-separated)"
              value={jobTagsStr}
              onChange={(e) => setJobTagsStr(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCreateJobModal(false); setJobTitle(""); setJobBudget(""); setJobDuration(""); setJobTagsStr(""); setJobType("job"); }}
                className="flex-1 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={jobSaving || !jobTitle.trim()}
                onClick={async () => {
                  setJobSaving(true);
                  const tags = jobTagsStr.split(",").map((t) => t.trim()).filter(Boolean);
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const { data: { session } } = await supabase.auth.getSession();
                  const token = session?.access_token;
                  const res = token
                    ? await fetch(`${origin}/api/orgs/${org.id}/jobs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify({
                          type: jobType,
                          title: jobTitle.trim(),
                          budget: jobBudget.trim() || undefined,
                          duration: jobDuration.trim() || undefined,
                          tags,
                        }),
                      })
                    : { ok: false };
                  setJobSaving(false);
                  if (res?.ok) {
                    const all = await listJobs();
                    const jobsForOrg = (all ?? []).filter((j) => j.org_id === org.id);
                    setOrgJobs(jobsForOrg);
                    const appList = jobsForOrg.length ? await listApplicationsForJobs(jobsForOrg.map((j) => j.id)) : [];
                    setApplications(appList);
                    setShowCreateJobModal(false);
                    setJobTitle("");
                    setJobBudget("");
                    setJobDuration("");
                    setJobTagsStr("");
                    setJobType("job");
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-primary hover:opacity-90 text-white disabled:opacity-50"
              >
                {jobSaving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
