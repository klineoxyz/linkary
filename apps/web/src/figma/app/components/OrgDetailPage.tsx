"use client";

import React, { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import {
  Building2,
  Users,
  UserPlus,
  TrendingUp,
  X,
  ArrowLeft,
  Loader2,
  Settings,
  Link2,
  BarChart3,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { isPrivateStorageUrl } from "@/lib/isPrivateStorageUrl";
import {
  getOrgById,
  getOrgBySlug,
  listOrgMembers,
  listOrgAffiliations,
  listOrgAmbassadors,
  getOrgMetrics,
  recomputeOrgMetrics,
  isOrgAdmin,
  updateOrg,
  claimOrgSlug,
  ensureOrgOwnerMembership,
  type Org,
  type OrgMember,
  type OrgAffiliation,
  type OrgAmbassador,
} from "@/lib/orgs";
import { listJobs, listApplicationsForJobs, type Application } from "@/lib/jobs";
import { listCaseStudiesForOrg, createCaseStudyForOrg, type CaseStudy } from "@/lib/caseStudies";
import { Briefcase, Sparkles } from "lucide-react";

const CreatorProgramDetailDrawer = dynamic(
  () => import("./CreatorProgramDetailDrawer").then((m) => m.default),
  { ssr: false, loading: () => <div className="p-6 flex items-center justify-center min-h-[200px]"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div> }
);

function formatRelativeTime(iso: string): string {
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const sec = Math.floor((Date.now() - d.getTime()) / 1000);
    if (sec < 60) return "just now";
    if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
    if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
    if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
    return d.toLocaleDateString();
  } catch {
    return "";
  }
}

export default function OrgDetailPage({
  setRoute,
  data,
}: {
  setRoute: (r: { name: string; data?: any }) => void;
  data?: { orgId?: string; slug?: string; showConnectXBanner?: boolean; tab?: string };
}) {
  const orgId = data?.orgId ?? data?.slug;
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const validTabs = ["dashboard", "insights", "members", "affiliates", "ambassadors", "jobs", "case_studies", "settings"] as const;
  const [tab, setTab] = useState<typeof validTabs[number]>("dashboard");

  useEffect(() => {
    const t = data?.tab;
    if (t && validTabs.includes(t as typeof validTabs[number])) setTab(t as typeof validTabs[number]);
  }, [data?.tab]);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [affiliations, setAffiliations] = useState<(OrgAffiliation & { profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null })[]>([]);
  const [ambassadors, setAmbassadors] = useState<(OrgAmbassador & { profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null })[]>([]);
  const [metrics, setMetrics] = useState<{ combined_followers: number; avg_engagement_rate: number; potential_reach: number } | null>(null);
  const [orgJobs, setOrgJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [acceptLoading, setAcceptLoading] = useState<string | null>(null);
  const [closeJobLoading, setCloseJobLoading] = useState<string | null>(null);
  const [removePartnerLoading, setRemovePartnerLoading] = useState<string | null>(null);
  const [acceptPartnerLoading, setAcceptPartnerLoading] = useState<string | null>(null);
  const [caseStudies, setCaseStudies] = useState<CaseStudy[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [affiliateHandle, setAffiliateHandle] = useState("");
  const [ambassadorHandle, setAmbassadorHandle] = useState("");
  const [affiliateSearchResults, setAffiliateSearchResults] = useState<Array<{ id: string; name: string; handleLabel: string }>>([]);
  const [ambassadorSearchResults, setAmbassadorSearchResults] = useState<Array<{ id: string; name: string; handleLabel: string }>>([]);
  const [affiliateSearchLoading, setAffiliateSearchLoading] = useState(false);
  const [ambassadorSearchLoading, setAmbassadorSearchLoading] = useState(false);
  const [selectedAffiliateProfileId, setSelectedAffiliateProfileId] = useState<string | null>(null);
  const [selectedAmbassadorProfileId, setSelectedAmbassadorProfileId] = useState<string | null>(null);
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
  const [jobDescription, setJobDescription] = useState("");
  const [jobApplyUrl, setJobApplyUrl] = useState("");
  const [jobObjective, setJobObjective] = useState("");
  const [jobLinksStr, setJobLinksStr] = useState("");
  const [jobSaving, setJobSaving] = useState(false);
  const [isCryptoProject, setIsCryptoProject] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenSymbol, setTokenSymbol] = useState("");
  const [dexscreenerUrl, setDexscreenerUrl] = useState("");
  const [published, setPublished] = useState(false);
  const [connectXLoading, setConnectXLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);
  const [settingsOrgName, setSettingsOrgName] = useState("");
  const [settingsOrgSlug, setSettingsOrgSlug] = useState("");
  const [dismissConnectXBanner, setDismissConnectXBanner] = useState(false);
  const [membersWithProfiles, setMembersWithProfiles] = useState<Array<OrgMember & { profile?: { username: string | null; display_name: string | null; avatar_url: string | null } | null }>>([]);
  const [membersLoadError, setMembersLoadError] = useState<string | null>(null);
  const [memberUsername, setMemberUsername] = useState("");
  const [memberRole, setMemberRole] = useState<"member" | "admin">("member");
  const [addMemberLoading, setAddMemberLoading] = useState(false);
  const [membersError, setMembersError] = useState<string | null>(null);
  const [removeLoading, setRemoveLoading] = useState<Record<string, boolean>>({});
  const [roleChangeLoading, setRoleChangeLoading] = useState<Record<string, boolean>>({});
  const [transferTargetUserId, setTransferTargetUserId] = useState("");
  const [transferLoading, setTransferLoading] = useState(false);
  const [supportersCount, setSupportersCount] = useState(0);
  const [orgLinkCopied, setOrgLinkCopied] = useState(false);
  const [supportersSample, setSupportersSample] = useState<Array<{ id: string; display_name: string | null; avatar_url: string | null; username: string | null }>>([]);
  const [supporting, setSupporting] = useState(false);
  const [influenceRollup, setInfluenceRollup] = useState<{ total_influence: number; breakdown: Record<string, unknown>; computed_at: string | null } | null>(null);
  const [influenceExpanded, setInfluenceExpanded] = useState(false);
  const [dashboardData, setDashboardData] = useState<{
    supportersPreview: Array<{ id: string; display_name: string | null; avatar_url: string | null; username: string | null; score: number | null }>;
    topSupporters: Array<{ id: string; display_name: string | null; avatar_url: string | null; username: string | null; score: number | null }>;
    jobsPreview: Array<{ id: string; title: string; status: string; created_at: string }>;
  } | null>(null);
  const [watchlistList, setWatchlistList] = useState<{ people: Array<{ entity_id: string }>; orgs: Array<{ entity_id: string }> } | null>(null);
  const [watchlistToggling, setWatchlistToggling] = useState(false);
  const [orgPrograms, setOrgPrograms] = useState<Array<{ id: string; title: string; status: string; invites_count: number }>>([]);
  const [showCreateProgramModal, setShowCreateProgramModal] = useState(false);
  const [programTitle, setProgramTitle] = useState("");
  const [programSaving, setProgramSaving] = useState(false);
  const [selectedProgramId, setSelectedProgramId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const loadSession = useCallback(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserId(session?.user?.id ?? null);
      setAccessToken(session?.access_token ?? null);
    });
  }, []);
  useEffect(() => void loadSession(), [loadSession]);

  useEffect(() => {
    if (!orgId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    (async () => {
      const { getIdentifierKind } = await import("@/lib/entityResolver");
      const o = getIdentifierKind(orgId) === "uuid"
        ? await getOrgById(orgId)
        : await getOrgBySlug(orgId);
      setOrg(o ?? null);
      if (o) {
        if (userId && (o as Org & { owner_profile_id?: string }).owner_profile_id === userId) {
          await ensureOrgOwnerMembership(o.id, userId);
        }
        setIsCryptoProject(!!o.is_crypto_project);
        setHasToken(!!o.has_token);
        setTokenSymbol(o.token_symbol ?? "");
        setDexscreenerUrl(o.dexscreener_url ?? "");
        setPublished(!!o.published);
        setSettingsOrgName(o.name ?? "");
        setSettingsOrgSlug((o.slug ?? "").replace(/^@/, ""));
        const base = typeof window !== "undefined" ? window.location.origin : "";
        const token = accessToken;
        const [m, a, am, met, jobsAll, cs, supportersRes, supportStatusRes, dashboardRes] = await Promise.all([
          listOrgMembers(o.id),
          token && base
            ? fetch(`${base}/api/orgs/${o.id}/affiliates`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => (r.ok ? ((await r.json()).affiliations ?? []) : await listOrgAffiliations(o.id)))
            : listOrgAffiliations(o.id),
          token && base
            ? fetch(`${base}/api/orgs/${o.id}/ambassadors`, { headers: { Authorization: `Bearer ${token}` } }).then(async (r) => (r.ok ? ((await r.json()).ambassadors ?? []) : await listOrgAmbassadors(o.id)))
            : listOrgAmbassadors(o.id),
          getOrgMetrics(o.id),
          listJobs(),
          listCaseStudiesForOrg(o.id),
          fetch(`${base}/api/orgs/${o.id}/supporters?limit=12`).then((r) => r.json()),
          userId && token && base
            ? fetch(`${base}/api/orgs/${o.id}/support-status`, { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json())
            : Promise.resolve({ supporting: false }),
          fetch(`${base}/api/orgs/${o.id}/dashboard`).then((r) => r.json()),
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
        setSupportersCount(supportersRes?.count ?? 0);
        setSupportersSample(supportersRes?.supporters ?? []);
        setSupporting(supportStatusRes?.supporting === true);
        setInfluenceRollup(dashboardRes?.influenceRollup ? { total_influence: dashboardRes.influenceRollup.total_influence ?? 0, breakdown: dashboardRes.influenceRollup.breakdown ?? {}, computed_at: dashboardRes.influenceRollup.computed_at ?? null } : null);
        setDashboardData(dashboardRes ? { supportersPreview: dashboardRes.supportersPreview ?? [], topSupporters: dashboardRes.topSupporters ?? [], jobsPreview: dashboardRes.jobsPreview ?? [] } : null);
        if (token && base) {
          const progRes = await fetch(`${base}/api/creator-programs?org_id=${encodeURIComponent(o.id)}`, { headers: { Authorization: `Bearer ${token}` } });
          const progJson = await progRes.json().catch(() => ({}));
          setOrgPrograms(Array.isArray(progJson.programs) ? progJson.programs : []);
        } else {
          setOrgPrograms([]);
        }
        if (userId) {
          const isAdmin = await isOrgAdmin(userId, o.id);
          setAdmin(isAdmin);
        }
      }
      setLoading(false);
    })();
  }, [orgId, data?.orgId, userId, accessToken]);

  const fetchMembersWithProfiles = async () => {
    if (!org?.id) return;
    setMembersLoadError(null);
    const token = accessToken;
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
      setMembersLoadError((err as { message?: string }).message ?? (err as { error?: string }).error ?? "Failed to load members");
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

  const fetchWatchlistList = async () => {
    const token = accessToken;
    if (!token) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/watchlist/list`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) {
      const data = await res.json();
      setWatchlistList({ people: data?.people ?? [], orgs: data?.orgs ?? [] });
    } else {
      setWatchlistList(null);
    }
  };

  useEffect(() => {
    if (!userId || !org?.id) {
      setWatchlistList(null);
      return;
    }
    fetchWatchlistList();
  }, [userId, org?.id]);

  useEffect(() => {
    const q = affiliateHandle.trim().replace(/^@/, "");
    if (q.length < 2) {
      setAffiliateSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setAffiliateSearchLoading(true);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(`${origin}/api/search?q=${encodeURIComponent(q)}&filter=people`);
        const data = await res.json().catch(() => ({}));
        const list = (data.results ?? []).filter((r: { type: string }) => r.type === "person");
        setAffiliateSearchResults(list.map((r: { id: string; name: string; handleLabel: string }) => ({ id: r.id, name: r.name, handleLabel: r.handleLabel })));
      } finally {
        setAffiliateSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [affiliateHandle]);

  useEffect(() => {
    const q = ambassadorHandle.trim().replace(/^@/, "");
    if (q.length < 2) {
      setAmbassadorSearchResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setAmbassadorSearchLoading(true);
      const origin = typeof window !== "undefined" ? window.location.origin : "";
      try {
        const res = await fetch(`${origin}/api/search?q=${encodeURIComponent(q)}&filter=people`);
        const data = await res.json().catch(() => ({}));
        const list = (data.results ?? []).filter((r: { type: string }) => r.type === "person");
        setAmbassadorSearchResults(list.map((r: { id: string; name: string; handleLabel: string }) => ({ id: r.id, name: r.name, handleLabel: r.handleLabel })));
      } finally {
        setAmbassadorSearchLoading(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [ambassadorHandle]);

  const onWatchlistOrg = watchlistList && org ? watchlistList.orgs.some((o) => o.entity_id === org.id) : false;
  const handleToggleWatchlistOrg = async () => {
    if (!org?.id || watchlistToggling) return;
    const token = accessToken;
    if (!token) return;
    setWatchlistToggling(true);
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    try {
      const res = await fetch(`${origin}/api/watchlist/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ entity_type: "org", entity_id: org.id }),
      });
      if (res.ok) await fetchWatchlistList();
    } finally {
      setWatchlistToggling(false);
    }
  };

  const handleAddMember = async () => {
    if (!org?.id || !memberUsername.trim()) return;
    setMembersError(null);
    setAddMemberLoading(true);
    const token = accessToken;
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
      setMembersError((out as { message?: string }).message ?? (out as { error?: string }).error ?? "Failed to add member");
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
    const token = accessToken;
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
      setMembersError((out as { message?: string }).message ?? (out as { error?: string }).error ?? "Failed to remove");
      return;
    }
    setMembersError(null);
    await fetchMembersWithProfiles();
    await listOrgMembers(org.id).then(setMembers);
  };

  const handleChangeRole = async (targetUserId: string, newRole: "member" | "admin") => {
    if (!org?.id) return;
    setRoleChangeLoading((prev) => ({ ...prev, [targetUserId]: true }));
    setMembersError(null);
    const token = accessToken;
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
      setMembersError((out as { message?: string }).message ?? (out as { error?: string }).error ?? "Failed to update role");
      return;
    }
    setMembersError(null);
    await fetchMembersWithProfiles();
    await listOrgMembers(org.id).then(setMembers);
  };

  const isOwner = !!userId && membersWithProfiles.some((m) => m.user_id === userId && m.role === "owner");
  const otherMembersForTransfer = membersWithProfiles.filter((m) => m.user_id !== userId && (m.role === "admin" || m.role === "member"));

  const handleTransferOwnership = async () => {
    if (!org?.id || !transferTargetUserId || transferLoading) return;
    setTransferLoading(true);
    setMembersError(null);
    const token = accessToken;
    if (!token) {
      setMembersError("Not signed in");
      setTransferLoading(false);
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const res = await fetch(`${origin}/api/orgs/${org.id}/transfer-owner`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ new_owner_user_id: transferTargetUserId }),
    });
    const out = await res.json().catch(() => ({}));
    setTransferLoading(false);
    if (!res.ok) {
      setMembersError((out as { message?: string }).message ?? "Transfer failed");
      return;
    }
    setTransferTargetUserId("");
    setMembersError(null);
    await fetchMembersWithProfiles();
    await listOrgMembers(org.id).then(setMembers);
  };

  const handleInvite = async (type: "affiliate" | "ambassador") => {
    const handle = type === "affiliate" ? affiliateHandle.trim() : ambassadorHandle.trim();
    const profileId = type === "affiliate" ? selectedAffiliateProfileId : selectedAmbassadorProfileId;
    if (!org || (!handle && !profileId)) return;
    setInviteError(null);
    const token = accessToken;
    if (!token) {
      setInviteError("Not signed in");
      return;
    }
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const path = type === "affiliate" ? "affiliates" : "ambassadors";
    const body = profileId ? { profile_id: profileId } : { profile_handle: handle.replace(/^@/, "") };
    const res = await fetch(`${origin}/api/orgs/${org.id}/${path}/invite`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify(body),
    });
    const out = await res.json().catch(() => ({}));
    if (!res.ok) {
      setInviteError((out as { message?: string }).message ?? (out as { error?: string }).error ?? "Invite failed");
      return;
    }
    if (type === "affiliate") {
      setAffiliateHandle("");
      setSelectedAffiliateProfileId(null);
      setAffiliateSearchResults([]);
      const r = await fetch(`${origin}/api/orgs/${org.id}/affiliates`, { headers: { Authorization: `Bearer ${token}` } });
      setAffiliations(r.ok ? ((await r.json()).affiliations ?? []) : await listOrgAffiliations(org.id));
    } else {
      setAmbassadorHandle("");
      setSelectedAmbassadorProfileId(null);
      setAmbassadorSearchResults([]);
      const r = await fetch(`${origin}/api/orgs/${org.id}/ambassadors`, { headers: { Authorization: `Bearer ${token}` } });
      setAmbassadors(r.ok ? ((await r.json()).ambassadors ?? []) : await listOrgAmbassadors(org.id));
    }
    try {
      if (origin) {
        await fetch(`${origin}/api/orgs/${org.id}/refresh-influence`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
      }
    } catch (_) {
      /* non-blocking */
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

  const copyOrgLink = () => {
    if (!org?.id) return;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const segment = org.slug ?? org.id;
    const url = `${origin}/org/${encodeURIComponent(segment)}`;
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(url).then(
        () => {
          setOrgLinkCopied(true);
          setTimeout(() => setOrgLinkCopied(false), 2000);
        },
        () => {}
      );
    }
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
    { id: "dashboard" as const, label: "Dashboard", icon: TrendingUp },
    { id: "insights" as const, label: "Insights", icon: BarChart3 },
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
          {(() => {
            const logoUrl =
              org.logo_url && !isPrivateStorageUrl(org.logo_url)
                ? org.logo_url
                : (org.x_account_username || org.slug)
                  ? `https://unavatar.io/twitter/${encodeURIComponent(org.x_account_username || org.slug)}`
                  : null;
            return logoUrl ? (
              <img src={logoUrl} alt={org.name} className="w-14 h-14 rounded-xl object-cover" />
            ) : (
              <div className="w-14 h-14 rounded-xl bg-accent flex items-center justify-center">
                <Building2 className="w-7 h-7 text-primary" />
              </div>
            );
          })()}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{org.name}</h1>
            {org.tagline && <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-0.5">{org.tagline}</p>}
            <p className="text-xs text-zinc-500 mt-1">
              {admin
                ? `Your ${org.org_type.charAt(0).toUpperCase() + org.org_type.slice(1)}`
                : `@${org.slug} · ${org.org_type}`}
            </p>
            {metrics && (
              <div className="flex gap-4 mt-2 text-xs text-zinc-500">
                <span>Followers: {(metrics.combined_followers ?? 0).toLocaleString()}</span>
                <span>Engagement: {((metrics.avg_engagement_rate ?? 0) * 100).toFixed(1)}%</span>
                <span>Reach: {(metrics.potential_reach ?? 0).toLocaleString()}</span>
              </div>
            )}
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <button
                type="button"
                onClick={copyOrgLink}
                className="inline-flex items-center gap-1.5 text-xs px-3 py-2 min-h-[44px] rounded border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-300 touch-manipulation"
              >
                <Link2 className="w-3.5 h-3.5" />
                {orgLinkCopied ? "Copied" : "Copy link"}
              </button>
              {supportersCount > 0 && (
                <span className="inline-flex items-center gap-1.5 text-xs text-zinc-500">
                  <Users className="w-3.5 h-3.5" />
                  <span className="font-medium">{supportersCount}</span> supporter{supportersCount !== 1 ? "s" : ""}
                  {supportersSample.length > 0 && (
                    <span className="flex -space-x-2">
                      {supportersSample.slice(0, 5).map((s) => (
                        <span key={s.id} className="inline-block h-5 w-5 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-700 overflow-hidden" title={s.display_name ?? s.username ?? undefined}>
                          {s.avatar_url ? <img src={s.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                        </span>
                      ))}
                    </span>
                  )}
                </span>
              )}
              {userId && !admin && (
                <button
                  type="button"
                  onClick={async () => {
                    const token = accessToken;
                    const base = typeof window !== "undefined" ? window.location.origin : "";
                    const method = supporting ? "unsupport" : "support";
                    const res = await fetch(`${base}/api/orgs/${org.id}/${method}`, { method: "POST", headers: token ? { Authorization: `Bearer ${token}` } : {} });
                    const json = await res.json().catch(() => ({}));
                    if (json.ok) {
                      setSupporting(!supporting);
                      setSupportersCount((c) => (supporting ? c - 1 : c + 1));
                      if (!supporting) {
                        const r = await fetch(`${base}/api/orgs/${org.id}/supporters?limit=12`);
                        const b = await r.json();
                        setSupportersSample(b.supporters ?? []);
                      }
                    }
                  }}
                  className={`text-xs px-3 py-2 min-h-[44px] rounded border touch-manipulation ${supporting ? "bg-primary/10 border-primary text-primary" : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
                >
                  {supporting ? "Supporting" : "Support"}
                </button>
              )}
              {userId && (
                <button
                  type="button"
                  onClick={handleToggleWatchlistOrg}
                  disabled={watchlistToggling}
                  className={`text-xs px-3 py-2 min-h-[44px] rounded border touch-manipulation ${onWatchlistOrg ? "bg-primary/10 border-primary text-primary" : "border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"} disabled:opacity-50`}
                >
                  {onWatchlistOrg ? "On watchlist" : "Watchlist"}
                </button>
              )}
              {influenceRollup != null && influenceRollup.total_influence > 0 && (
                <div className="text-xs">
                  <button type="button" onClick={() => setInfluenceExpanded(!influenceExpanded)} className="inline-flex items-center gap-1 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300">
                    <TrendingUp className="w-3.5 h-3.5" />
                    Influence: <span className="font-medium">{influenceRollup.total_influence}</span>
                  </button>
                  {influenceExpanded && (
                    <div className="mt-1 pl-4 border-l border-zinc-200 dark:border-zinc-700 text-zinc-500 space-y-0.5">
                      {Object.entries(influenceRollup.breakdown).map(([k, v]) => (
                        <div key={k}>{k}: {typeof v === "number" ? v.toFixed(1) : String(v)}</div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
            onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 px-4 sm:px-6 py-3 min-h-[44px] min-w-[44px] text-sm font-medium border-b-2 whitespace-nowrap transition-colors touch-manipulation ${
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
          {tab === "insights" && (
            <div className="space-y-6">
              {influenceRollup != null && influenceRollup.total_influence > 0 ? (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Influence rollup</h3>
                  <p className="mt-1 text-2xl font-bold text-primary">{influenceRollup.total_influence}</p>
                  {influenceRollup.computed_at && (
                    <p className="mt-0.5 text-xs text-zinc-500">Updated: {formatRelativeTime(influenceRollup.computed_at)}</p>
                  )}
                  {influenceRollup.breakdown && Object.keys(influenceRollup.breakdown).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {Object.entries(influenceRollup.breakdown).map(([k, v]) => (
                        <span key={k}>{k}: {typeof v === "number" ? v.toFixed(0) : String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Influence rollup</h3>
                  <p className="mt-1 text-sm text-zinc-500">No influence data yet. Supporters and member activity will build this over time.</p>
                </div>
              )}
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Supporters</h3>
                {(dashboardData?.supportersPreview?.length ?? 0) > 0 || supportersCount > 0 ? (
                  <>
                    <p className="mt-1 text-lg font-medium">{supportersCount || dashboardData?.supportersPreview?.length || 0} supporter{(supportersCount || dashboardData?.supportersPreview?.length || 0) !== 1 ? "s" : ""}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {(dashboardData?.supportersPreview?.length ? dashboardData.supportersPreview : supportersSample).slice(0, 8).map((s) => (
                        <div key={s.id} className="flex items-center gap-2 rounded-lg border border-zinc-200 dark:border-zinc-700 px-2 py-1.5">
                          {s.avatar_url ? <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" /> : <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-600" />}
                          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate max-w-[120px]">{s.display_name ?? s.username ?? "—"}</span>
                        </div>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="mt-1 text-sm text-zinc-500">No supporters yet. Invite people to support your org from the Support action in the header.</p>
                )}
              </div>
              <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mentions</h3>
                <p className="mt-1 text-sm text-zinc-500">Org-level mentions and affiliated accounts will appear here when available.</p>
              </div>
            </div>
          )}

          {tab === "dashboard" && (
            <div className="space-y-6">
              {influenceRollup != null && (
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Influence rollup</h3>
                  <p className="mt-1 text-2xl font-bold text-primary">{influenceRollup.total_influence}</p>
                  {influenceRollup.computed_at && (
                    <p className="mt-0.5 text-xs text-zinc-500">Updated: {formatRelativeTime(influenceRollup.computed_at)}</p>
                  )}
                  {influenceRollup.breakdown && Object.keys(influenceRollup.breakdown).length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                      {Object.entries(influenceRollup.breakdown).map(([k, v]) => (
                        <span key={k}>{k}: {typeof v === "number" ? v.toFixed(0) : String(v)}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Supporters</h3>
                  {(dashboardData?.supportersPreview?.length ?? 0) > 0 || supportersCount > 0 ? (
                    <>
                      <p className="mt-1 text-lg font-medium">{supportersCount || dashboardData?.supportersPreview?.length || 0} supporter{(supportersCount || dashboardData?.supportersPreview?.length || 0) !== 1 ? "s" : ""}</p>
                      <div className="mt-2 flex -space-x-2">
                        {(dashboardData?.supportersPreview?.length ? dashboardData.supportersPreview : supportersSample).slice(0, 8).map((s) => (
                          <span key={s.id} className="inline-block h-8 w-8 rounded-full border-2 border-white dark:border-zinc-900 bg-zinc-200 dark:bg-zinc-700 overflow-hidden" title={s.display_name ?? s.username ?? undefined}>
                            {s.avatar_url && !isPrivateStorageUrl(s.avatar_url) ? <img src={s.avatar_url} alt="" className="h-full w-full object-cover" /> : null}
                          </span>
                        ))}
                      </div>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">No supporters yet. Invite people to support your org from the Support tab.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Jobs</h3>
                  {(dashboardData?.jobsPreview?.length ?? orgJobs.length) > 0 ? (
                    <>
                      <p className="mt-1 text-lg font-medium">{orgJobs.length} job{orgJobs.length !== 1 ? "s" : ""}</p>
                      <ul className="mt-2 space-y-1">
                        {(dashboardData?.jobsPreview?.length ? dashboardData.jobsPreview : orgJobs.slice(0, 3).map((j: { id: string; title: string; status?: string; created_at?: string }) => ({ id: j.id, title: j.title, status: j.status ?? "", created_at: j.created_at ?? "" }))).map((j: { id: string; title: string; status: string; created_at: string }) => (
                          <li key={j.id} className="text-sm text-zinc-700 dark:text-zinc-300 truncate">{j.title} · {j.status}</li>
                        ))}
                      </ul>
                      <button type="button" onClick={() => setTab("jobs")} className="mt-2 text-xs font-medium text-primary hover:underline">View all jobs</button>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">No jobs yet. Create a job from the Jobs tab to start hiring.</p>
                  )}
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Top supporters</h3>
                  {(dashboardData?.topSupporters?.length ?? 0) > 0 ? (
                    <ul className="mt-2 space-y-2">
                      {dashboardData!.topSupporters.slice(0, 10).map((s) => (
                        <li key={s.id} className="flex items-center gap-2">
                          {s.avatar_url && !isPrivateStorageUrl(s.avatar_url) ? (
                            <img src={s.avatar_url} alt="" className="h-6 w-6 rounded-full object-cover" />
                          ) : (
                            <div className="h-6 w-6 rounded-full bg-zinc-300 dark:bg-zinc-600" />
                          )}
                          <span className="text-sm truncate flex-1">@{s.username ?? s.id}</span>
                          {s.score != null && <span className="text-xs text-zinc-500">{s.score}</span>}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-sm text-zinc-500">Nothing here yet. Supporters with published profiles and X connected will appear here.</p>
                  )}
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Mentions</h3>
                  <p className="mt-1 text-sm text-zinc-500">Coming soon</p>
                </div>
                <div className="rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 p-4">
                  <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">Affiliated accounts</h3>
                  <p className="mt-1 text-sm text-zinc-500">Nothing here yet</p>
                </div>
              </div>
            </div>
          )}
          {tab === "members" && (
            <div className="space-y-4">
              <div className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50/50 dark:bg-zinc-800/30 p-4">
                <p className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                  Managing: <span className="font-semibold">{org.name}</span> <span className="text-zinc-500 font-normal">@{org.slug}</span>
                </p>
                <p className="text-xs text-zinc-500 mt-1">Only the owner and admins can add or remove members here.</p>
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Add team members and assign up to 3 <strong>Admins</strong>. Admins can post Gigs (Sprints) and jobs on behalf of the org, manage applications, and edit org content. <strong>Members</strong> can view the org and participate as needed.
              </p>
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
                      onChange={(e) => setMemberRole(e.target.value as "member" | "admin")}
                      className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    >
                      <option value="member">Member (view only)</option>
                      <option value="admin">Admin (post Sprints &amp; jobs, manage org)</option>
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
              {isOwner && otherMembersForTransfer.length > 0 && (
                <div className="flex flex-wrap items-end gap-2 p-4 rounded-xl border border-amber-200 dark:border-amber-800/50 bg-amber-50/50 dark:bg-amber-900/20">
                  <p className="text-xs font-medium text-amber-800 dark:text-amber-200 w-full">Transfer ownership</p>
                  <select
                    value={transferTargetUserId}
                    onChange={(e) => setTransferTargetUserId(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm min-w-[180px]"
                  >
                    <option value="">Select member</option>
                    {otherMembersForTransfer.map((m) => (
                      <option key={m.user_id} value={m.user_id}>
                        {m.profile?.display_name || m.profile?.username || m.user_id} ({m.role})
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleTransferOwnership}
                    disabled={transferLoading || !transferTargetUserId}
                    className="px-4 py-2 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-sm disabled:opacity-50"
                  >
                    {transferLoading ? "Transferring…" : "Transfer ownership"}
                  </button>
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
                            onChange={(e) => handleChangeRole(m.user_id, e.target.value as "member" | "admin")}
                            disabled={roleChangeLoading[m.user_id] || m.role === "owner"}
                            className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 disabled:opacity-70"
                          >
                            <option value="member">Member</option>
                            <option value="admin">Admin</option>
                            <option value="owner" disabled>Owner (use Transfer)</option>
                          </select>
                        ) : (
                          <span className="text-xs px-2 py-1 rounded-full bg-accent text-primary">{m.role}</span>
                        )}
                        {((admin && userId !== m.user_id) || (userId === m.user_id && m.role !== "owner")) && (
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
                  <div className="flex-1 min-w-[200px] relative">
                    <input
                      type="text"
                      value={affiliateHandle}
                      onChange={(e) => {
                        setAffiliateHandle(e.target.value);
                        setSelectedAffiliateProfileId(null);
                        setInviteError(null);
                      }}
                      placeholder="Search Linkary users by handle (e.g. alice)"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    />
                    {affiliateSearchLoading && <p className="absolute left-3 top-full mt-1 text-xs text-zinc-500">Searching…</p>}
                    {affiliateSearchResults.length > 0 && (
                      <ul className="absolute z-10 left-0 right-0 top-full mt-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg max-h-48 overflow-y-auto">
                        {affiliateSearchResults.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setAffiliateHandle(r.handleLabel);
                                setSelectedAffiliateProfileId(r.id);
                                setAffiliateSearchResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-2"
                            >
                              <span className="font-medium truncate">{r.name}</span>
                              <span className="text-zinc-500 truncate">{r.handleLabel}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => handleInvite("affiliate")}
                    disabled={!affiliateHandle.trim() && !selectedAffiliateProfileId}
                    className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
                  >
                    Invite Affiliate
                  </button>
                  {inviteError && tab === "affiliates" && <p className="text-destructive text-sm w-full">{inviteError}</p>}
                </div>
              )}
              {affiliations.filter((a) => a.status !== "removed").length === 0 ? (
                <p className="text-zinc-500 text-sm">No affiliates yet.</p>
              ) : (
                affiliations.filter((a) => a.status !== "removed").map((a) => {
                  const profile = (a as { profile?: { display_name?: string | null; username?: string | null } }).profile;
                  const display = profile?.display_name ?? profile?.username ?? "Unknown user";
                  const handle = profile?.username ? `@${profile.username}` : null;
                  return (
                  <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div className="min-w-0">
                      <span className="text-sm truncate font-medium text-zinc-900 dark:text-zinc-100 block">{display}</span>
                      {handle && <span className="text-xs text-zinc-500 truncate block">{handle}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{a.status}</span>
                      {a.status === "invited" && userId === a.profile_id && (
                        <button
                          type="button"
                          disabled={!!acceptPartnerLoading}
                          onClick={async () => {
                            if (!org?.id) return;
                            setAcceptPartnerLoading(a.id);
                            try {
                              const token = accessToken;
                              const origin = typeof window !== "undefined" ? window.location.origin : "";
                              const res = await fetch(`${origin}/api/orgs/${org.id}/affiliates/${a.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ status: "active" }),
                              });
                              if (res.ok) {
                                const r = await fetch(`${origin}/api/orgs/${org.id}/affiliates`, { headers: { Authorization: `Bearer ${token}` } });
                                setAffiliations(r.ok ? ((await r.json()).affiliations ?? []) : await listOrgAffiliations(org.id));
                              }
                            } finally {
                              setAcceptPartnerLoading(null);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {acceptPartnerLoading === a.id ? "…" : "Accept"}
                        </button>
                      )}
                      {(admin || userId === a.profile_id) && (a.status === "invited" || a.status === "active") && (
                        <button
                          type="button"
                          disabled={!!removePartnerLoading}
                          onClick={async () => {
                            if (!org?.id) return;
                            setRemovePartnerLoading(a.id);
                            try {
                              const token = accessToken;
                              const origin = typeof window !== "undefined" ? window.location.origin : "";
                              const res = await fetch(`${origin}/api/orgs/${org.id}/affiliates/${a.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ status: "removed" }),
                              });
                              if (res.ok) {
                                const r = await fetch(`${origin}/api/orgs/${org.id}/affiliates`, { headers: { Authorization: `Bearer ${token}` } });
                                setAffiliations(r.ok ? ((await r.json()).affiliations ?? []) : await listOrgAffiliations(org.id));
                              }
                            } finally {
                              setRemovePartnerLoading(null);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {removePartnerLoading === a.id ? "…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })
              )}
            </div>
          )}

          {tab === "ambassadors" && (
            <div className="space-y-4">
              {admin && (
                <div className="flex flex-wrap items-center gap-2 p-4 rounded-xl bg-zinc-50 dark:bg-zinc-800/50">
                  <div className="flex-1 min-w-[200px] relative">
                    <input
                      type="text"
                      value={ambassadorHandle}
                      onChange={(e) => {
                        setAmbassadorHandle(e.target.value);
                        setSelectedAmbassadorProfileId(null);
                        setInviteError(null);
                      }}
                      placeholder="Search Linkary users by handle (e.g. bob)"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                    />
                    {ambassadorSearchLoading && <p className="absolute left-3 top-full mt-1 text-xs text-zinc-500">Searching…</p>}
                    {ambassadorSearchResults.length > 0 && (
                      <ul className="absolute z-10 left-0 right-0 top-full mt-1 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-lg max-h-48 overflow-y-auto">
                        {ambassadorSearchResults.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              onClick={() => {
                                setAmbassadorHandle(r.handleLabel);
                                setSelectedAmbassadorProfileId(r.id);
                                setAmbassadorSearchResults([]);
                              }}
                              className="w-full text-left px-3 py-2 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-800 flex items-center justify-between gap-2"
                            >
                              <span className="font-medium truncate">{r.name}</span>
                              <span className="text-zinc-500 truncate">{r.handleLabel}</span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    onClick={() => handleInvite("ambassador")}
                    disabled={!ambassadorHandle.trim() && !selectedAmbassadorProfileId}
                    className="px-4 py-2 rounded-lg bg-primary hover:opacity-90 text-white text-sm disabled:opacity-50"
                  >
                    Invite Ambassador
                  </button>
                  {inviteError && tab === "ambassadors" && <p className="text-destructive text-sm w-full">{inviteError}</p>}
                </div>
              )}
              {ambassadors.filter((a) => a.status !== "removed").length === 0 ? (
                <p className="text-zinc-500 text-sm">No ambassadors yet.</p>
              ) : (
                ambassadors.filter((a) => a.status !== "removed").map((a) => {
                  const profile = (a as { profile?: { display_name?: string | null; username?: string | null } }).profile;
                  const display = profile?.display_name ?? profile?.username ?? "Unknown user";
                  const handle = profile?.username ? `@${profile.username}` : null;
                  return (
                  <div key={a.id} className="flex items-center justify-between gap-2 py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div className="min-w-0">
                      <span className="text-sm truncate font-medium text-zinc-900 dark:text-zinc-100 block">{display}</span>
                      {handle && <span className="text-xs text-zinc-500 truncate block">{handle}</span>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="text-xs px-2 py-1 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{a.status}</span>
                      {a.status === "invited" && userId === a.profile_id && (
                        <button
                          type="button"
                          disabled={!!acceptPartnerLoading}
                          onClick={async () => {
                            if (!org?.id) return;
                            setAcceptPartnerLoading(a.id);
                            try {
                              const token = accessToken;
                              const origin = typeof window !== "undefined" ? window.location.origin : "";
                              const res = await fetch(`${origin}/api/orgs/${org.id}/ambassadors/${a.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ status: "active" }),
                              });
                              if (res.ok) {
                                const r = await fetch(`${origin}/api/orgs/${org.id}/ambassadors`, { headers: { Authorization: `Bearer ${token}` } });
                                setAmbassadors(r.ok ? ((await r.json()).ambassadors ?? []) : await listOrgAmbassadors(org.id));
                              }
                            } finally {
                              setAcceptPartnerLoading(null);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded bg-primary text-white hover:opacity-90 disabled:opacity-50"
                        >
                          {acceptPartnerLoading === a.id ? "…" : "Accept"}
                        </button>
                      )}
                      {(admin || userId === a.profile_id) && (a.status === "invited" || a.status === "active") && (
                        <button
                          type="button"
                          disabled={!!removePartnerLoading}
                          onClick={async () => {
                            if (!org?.id) return;
                            setRemovePartnerLoading(a.id);
                            try {
                              const token = accessToken;
                              const origin = typeof window !== "undefined" ? window.location.origin : "";
                              const res = await fetch(`${origin}/api/orgs/${org.id}/ambassadors/${a.id}`, {
                                method: "PATCH",
                                headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                                body: JSON.stringify({ status: "removed" }),
                              });
                              if (res.ok) {
                                const r = await fetch(`${origin}/api/orgs/${org.id}/ambassadors`, { headers: { Authorization: `Bearer ${token}` } });
                                setAmbassadors(r.ok ? ((await r.json()).ambassadors ?? []) : await listOrgAmbassadors(org.id));
                              }
                            } finally {
                              setRemovePartnerLoading(null);
                            }
                          }}
                          className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                        >
                          {removePartnerLoading === a.id ? "…" : "Remove"}
                        </button>
                      )}
                    </div>
                  </div>
                  );
                })
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
                          <button type="button" onClick={() => setSelectedJobId(j.id)} className="text-sm text-primary hover:underline">Manage</button>
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
                                  const token = accessToken;
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
                        <div key={app.id} className="py-2 pl-3 border-l-2 border-zinc-200 dark:border-zinc-700 space-y-1">
                          <div className="flex items-center justify-between">
                            <span className="text-sm text-zinc-700 dark:text-zinc-300">
                              {app.applicant_type === "profile"
                                ? (app.applicant_profile?.username ? `@${app.applicant_profile.username}` : "Profile")
                                : (app.applicant_org?.name ?? app.applicant_org?.slug ? `Org ${app.applicant_org.name ?? app.applicant_org.slug ?? ""}` : "Org")}
                              {app.message ? ` · "${app.message.slice(0, 40)}${app.message.length > 40 ? "…" : ""}"` : ""}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-400">{app.status}</span>
                          </div>
                          {app.shared_analytics && app.analytics_snapshot_json && typeof app.analytics_snapshot_json === "object" && (() => {
                            const snap = app.analytics_snapshot_json as Record<string, unknown>;
                            const posts = snap.posts_30d != null ? String(snap.posts_30d) : "—";
                            const likes = snap.avg_likes_30d != null ? String(snap.avg_likes_30d) : "—";
                            const reach = snap.reach_proxy_30d != null ? String(snap.reach_proxy_30d) : "—";
                            return (
                              <div className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
                                Shared analytics: 30d posts {posts} · avg likes {likes} · potential reach {reach}
                              </div>
                            );
                          })()}
                          {app.shared_cv && admin && (
                            <button
                              type="button"
                              onClick={async () => {
                                const token = accessToken;
                                const origin = typeof window !== "undefined" ? window.location.origin : "";
                                const res = await fetch(`${origin}/api/applications/${app.id}/cv-download`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
                                const json = await res.json().catch(() => ({}));
                                if (res.ok && json?.url) window.open(json.url, "_blank");
                                else if (!res.ok) console.error(json?.error ?? "Failed to get download link");
                              }}
                              className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                            >
                              Download CV
                            </button>
                          )}
                          <div className="flex items-center gap-2 flex-wrap">
                          {admin && app.status === "pending" && isOpen && (
                            <>
                              <button
                                type="button"
                                disabled={!!acceptLoading}
                                onClick={async () => {
                                  if (!userId) return;
                                  setAcceptLoading(app.id);
                                  try {
                                    const token = accessToken;
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
                              <button
                                type="button"
                                disabled={!!acceptLoading}
                                onClick={async () => {
                                  if (!userId) return;
                                  setAcceptLoading(app.id);
                                  try {
                                    const token = accessToken;
                                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                                    const res = await fetch(`${origin}/api/applications/${app.id}/reject`, {
                                      method: "POST",
                                      headers: { Authorization: `Bearer ${token}` },
                                    });
                                    const json = await res.json().catch(() => ({}));
                                    if (res.ok && json?.ok) {
                                      const all = await listJobs();
                                      setOrgJobs((all ?? []).filter((job: { org_id: string }) => job.org_id === org?.id));
                                      const jobsForOrg = (all ?? []).filter((job: { org_id: string }) => job.org_id === org?.id);
                                      const appList = jobsForOrg.length ? await listApplicationsForJobs(jobsForOrg.map((job: { id: string }) => job.id)) : [];
                                      setApplications(appList);
                                    }
                                  } finally {
                                    setAcceptLoading(null);
                                  }
                                }}
                                className="text-xs px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-700 disabled:opacity-50"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
              {/* Creator programs — same work surface as Jobs */}
              <div className="mt-8 pt-6 border-t border-zinc-200 dark:border-zinc-700">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-primary" />
                    Creator programs
                  </h3>
                  {admin && (
                    <button
                      type="button"
                      onClick={() => setShowCreateProgramModal(true)}
                      className="text-sm px-3 py-1.5 rounded-lg bg-primary hover:opacity-90 text-white"
                    >
                      Create program
                    </button>
                  )}
                </div>
                <p className="text-xs text-zinc-500 dark:text-zinc-400 mb-3">Invite creators from circles or KOL lists into programs.</p>
                {orgPrograms.length === 0 ? (
                  <p className="text-zinc-500 text-sm">No creator programs yet.</p>
                ) : (
                  <ul className="space-y-2">
                    {orgPrograms.map((p) => (
                      <li key={p.id} className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-between gap-2">
                        <span className="font-medium text-zinc-900 dark:text-zinc-100">{p.title}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-zinc-500">{p.status} · {p.invites_count} invite(s)</span>
                          <button
                            type="button"
                            onClick={() => setSelectedProgramId(p.id)}
                            className="text-sm text-primary hover:underline"
                          >
                            Manage
                          </button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
              {admin && org && !org.is_x_verified && !isOwner && data?.showConnectXBanner && !dismissConnectXBanner && (
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
                    <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-3">Org name and handle</h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400 mb-2">Display name and handle for this org&apos;s public page.</p>
                    <div className="space-y-2 mb-2">
                      <label className="block text-xs font-medium text-zinc-500">Display name</label>
                      <input
                        type="text"
                        value={settingsOrgName}
                        onChange={(e) => setSettingsOrgName(e.target.value)}
                        placeholder="e.g. DESI Crypto CLUB"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="block text-xs font-medium text-zinc-500">Handle (linkary.xyz/@handle)</label>
                      <input
                        type="text"
                        value={settingsOrgSlug}
                        onChange={(e) => setSettingsOrgSlug(e.target.value.replace(/^@/, "").toLowerCase().replace(/[^a-z0-9-]/g, ""))}
                        placeholder="e.g. desicryptoclub"
                        className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-sm"
                      />
                      <p className="text-xs text-zinc-500">Public page: linkary.xyz/@{settingsOrgSlug || org.slug}</p>
                    </div>
                  </div>
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
                            const safeRes = origin ? await fetch(`${origin}/api/auth/safe-redirect-url?for=callback`).catch(() => null) : null;
                            const safeJson = safeRes?.ok ? await safeRes.json().catch(() => ({})) : null;
                            const callbackUrl = (safeJson?.redirectUrl as string) || `${origin}/auth/callback`;
                            sessionStorage.setItem("linkary_oauth_org_id", org.id);
                            sessionStorage.setItem("linkary_oauth_next", "/dashboard");
                            const { data, error: err } = await supabase.auth.signInWithOAuth({
                              provider: "x",
                              options: { redirectTo: callbackUrl },
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
                      const newName = settingsOrgName.trim() || org.name;
                      const newSlug = (settingsOrgSlug.trim() || org.slug || "").replace(/^@/, "");
                      const slugChanged = newSlug && newSlug !== (org.slug || "").replace(/^@/, "");
                      if (slugChanged) {
                        const claimErr = await claimOrgSlug(org.id, newSlug);
                        if (claimErr.error) {
                          setSettingsSaving(false);
                          setSettingsError(claimErr.error.includes("USERNAME_TAKEN") || claimErr.error.includes("SLUG_TAKEN") ? "That handle is already taken by a user or another org. Try another." : claimErr.error);
                          return;
                        }
                      }
                      const { error } = await updateOrg(org.id, {
                        name: newName,
                        ...(slugChanged ? {} : { slug: newSlug || undefined }),
                        published,
                        is_crypto_project: isCryptoProject,
                        has_token: hasToken ? true : false,
                        token_symbol: hasToken && tokenSymbol.trim() ? tokenSymbol.trim() : null,
                        dexscreener_url: hasToken && dexscreenerUrl.trim() ? dexscreenerUrl.trim() : null,
                      });
                      setSettingsSaving(false);
                      if (error) {
                        setSettingsError(error.includes("published") || error.includes("x_verified") ? "Connect the org X account first to enable public listing." : error.includes("unique") || error.includes("duplicate") ? "That handle is already taken. Try another." : error);
                        if (error.includes("published") || error.includes("x_verified")) setPublished(false);
                      } else {
                        setOrg({ ...org, name: newName, slug: newSlug || org.slug, published, is_crypto_project: isCryptoProject, has_token: hasToken, token_symbol: tokenSymbol.trim() || null, dexscreener_url: dexscreenerUrl.trim() || null });
                      }
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
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 overflow-y-auto">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-full my-4 max-h-[90vh] overflow-y-auto">
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
            {jobType === "job" ? (
              <>
                <textarea
                  placeholder="Requirements and description"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
                <input
                  type="url"
                  placeholder="Apply URL (optional — if job is posted elsewhere, users will open this link to apply)"
                  value={jobApplyUrl}
                  onChange={(e) => setJobApplyUrl(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
                <input
                  type="text"
                  placeholder="Tags (comma-separated, optional)"
                  value={jobTagsStr}
                  onChange={(e) => setJobTagsStr(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
              </>
            ) : (
              <>
                <input
                  type="text"
                  placeholder="Duration (e.g. 2 weeks)"
                  value={jobDuration}
                  onChange={(e) => setJobDuration(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
                <input
                  type="text"
                  placeholder="Total budget (e.g. 500 USDT or 1000 TOKEN)"
                  value={jobBudget}
                  onChange={(e) => setJobBudget(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
                <textarea
                  placeholder="Objective of the campaign"
                  value={jobObjective}
                  onChange={(e) => setJobObjective(e.target.value)}
                  rows={3}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
                <textarea
                  placeholder="Links for creators (one per line: Label URL or just URL)"
                  value={jobLinksStr}
                  onChange={(e) => setJobLinksStr(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-3"
                />
              </>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => {
                  setShowCreateJobModal(false);
                  setJobTitle("");
                  setJobBudget("");
                  setJobDuration("");
                  setJobTagsStr("");
                  setJobDescription("");
                  setJobApplyUrl("");
                  setJobObjective("");
                  setJobLinksStr("");
                  setJobType("job");
                }}
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
                  const links = jobLinksStr
                    .split("\n")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line) => {
                      const parts = line.split(/\s+/);
                      if (parts.length >= 2) return { label: parts[0], url: parts.slice(1).join(" ").trim() };
                      return { url: line };
                    });
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  const token = accessToken;
                  const payload: Record<string, unknown> = {
                    type: jobType,
                    title: jobTitle.trim(),
                    tags,
                  };
                  if (jobType === "job") {
                    if (jobDescription.trim()) payload.description = jobDescription.trim();
                    if (jobApplyUrl.trim()) payload.apply_url = jobApplyUrl.trim();
                  } else {
                    if (jobDuration.trim()) payload.duration = jobDuration.trim();
                    if (jobBudget.trim()) payload.budget = jobBudget.trim();
                    if (jobObjective.trim()) payload.objective = jobObjective.trim();
                    if (links.length) payload.links = links;
                  }
                  const res = token
                    ? await fetch(`${origin}/api/orgs/${org.id}/jobs`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                        body: JSON.stringify(payload),
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
                    setJobDescription("");
                    setJobApplyUrl("");
                    setJobObjective("");
                    setJobLinksStr("");
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

      {showCreateProgramModal && org && admin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 p-6 max-w-md w-full">
            <h3 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Create creator program</h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-4">Invite creators from circles or KOL lists.</p>
            <input
              type="text"
              placeholder="Program title"
              value={programTitle}
              onChange={(e) => setProgramTitle(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 mb-4"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setShowCreateProgramModal(false); setProgramTitle(""); }}
                className="flex-1 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={programSaving || !programTitle.trim()}
                onClick={async () => {
                  if (!org?.id || !programTitle.trim()) return;
                  const token = accessToken;
                  const origin = typeof window !== "undefined" ? window.location.origin : "";
                  if (!token || !origin) return;
                  setProgramSaving(true);
                  const res = await fetch(`${origin}/api/creator-programs`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                    body: JSON.stringify({ org_id: org.id, title: programTitle.trim(), status: "draft" }),
                  });
                  setProgramSaving(false);
                  if (res.ok) {
                    const progRes = await fetch(`${origin}/api/creator-programs?org_id=${encodeURIComponent(org.id)}`, { headers: { Authorization: `Bearer ${token}` } });
                    const progJson = await progRes.json().catch(() => ({}));
                    setOrgPrograms(Array.isArray(progJson.programs) ? progJson.programs : []);
                    setShowCreateProgramModal(false);
                    setProgramTitle("");
                  }
                }}
                className="flex-1 py-2 rounded-lg bg-primary hover:opacity-90 text-white disabled:opacity-50"
              >
                {programSaving ? "Creating…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedProgramId && org && (
        <CreatorProgramDetailDrawer
          programId={selectedProgramId}
          orgId={org.id}
          orgName={org.name ?? ""}
          onClose={() => setSelectedProgramId(null)}
          onUpdated={async () => {
            const token = accessToken;
            const origin = typeof window !== "undefined" ? window.location.origin : "";
            if (token && origin && org?.id) {
              const progRes = await fetch(`${origin}/api/creator-programs?org_id=${encodeURIComponent(org.id)}`, { headers: { Authorization: `Bearer ${token}` } });
              const progJson = await progRes.json().catch(() => ({}));
              setOrgPrograms(Array.isArray(progJson.programs) ? progJson.programs : []);
            }
          }}
          admin={!!admin}
        />
      )}

      {selectedJobId && org && (() => {
        const j = orgJobs.find((job: { id: string }) => job.id === selectedJobId);
        if (!j) return null;
        const jobApps = applications.filter((a) => a.job_id === j.id);
        const isOpen = j.status === "open";
        return (
          <div className="fixed inset-0 z-50 flex justify-end bg-black/50">
            <div className="w-full max-w-lg bg-white dark:bg-zinc-900 shadow-xl overflow-y-auto flex flex-col max-h-full">
              <div className="flex items-center justify-between p-4 border-b border-zinc-200 dark:border-zinc-700">
                <h2 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100">{j.type === "sprint" ? "Sprint" : "Job"}</h2>
                <button type="button" onClick={() => setSelectedJobId(null)} className="p-2 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-800">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="p-4 space-y-4">
                <div>
                  <h3 className="font-medium text-zinc-900 dark:text-zinc-100">{j.title}</h3>
                  <p className="text-xs text-zinc-500 mt-0.5">{org.name} · {j.type} · {j.status}</p>
                  {(j.budget || j.duration) && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">{j.budget ?? ""} {j.duration ?? ""}</p>}
                  {j.description && <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">{j.description}</p>}
                  {j.type === "sprint" && (j as { objective?: string }).objective && <p className="text-xs text-zinc-500 mt-1">Objective: {(j as { objective?: string }).objective}</p>}
                  {Array.isArray(j.tags) && j.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {j.tags.map((t: string) => (
                        <span key={t} className="rounded-full border border-zinc-300 dark:border-zinc-600 px-2 py-0.5 text-xs">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setRoute({ name: "market", data: { highlightJobId: j.id } })} className="text-sm text-primary hover:underline">View in Marketplace</button>
                  {admin && isOpen && (
                    <button
                      type="button"
                      disabled={!!closeJobLoading}
                      onClick={async () => {
                        if (!org?.id || !userId) return;
                        setCloseJobLoading(j.id);
                        try {
                          const token = accessToken;
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
                      className="text-sm px-2 py-1 rounded border border-zinc-300 dark:border-zinc-600"
                    >
                      {closeJobLoading === j.id ? "…" : "Close job"}
                    </button>
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-2">Applicants ({jobApps.length})</h3>
                  {jobApps.length === 0 ? (
                    <p className="text-sm text-zinc-500">No applicants yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {jobApps.map((app) => (
                        <li key={app.id} className="py-2 px-3 rounded-lg border border-zinc-200 dark:border-zinc-700">
                          <div className="flex items-center justify-between">
                            <span className="text-sm">
                              {app.applicant_type === "profile"
                                ? (app.applicant_profile?.username ? `@${app.applicant_profile.username}` : "Profile")
                                : (app.applicant_org?.name ?? app.applicant_org?.slug ? String(app.applicant_org.name ?? app.applicant_org.slug) : "Org")}
                            </span>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-zinc-200 dark:bg-zinc-700">{app.status}</span>
                          </div>
                          {app.message && <p className="text-xs text-zinc-500 mt-1">{app.message}</p>}
                          {admin && app.status === "pending" && isOpen && (
                            <div className="flex gap-2 mt-2">
                              <button
                                type="button"
                                disabled={!!acceptLoading}
                                onClick={async () => {
                                  if (!userId) return;
                                  setAcceptLoading(app.id);
                                  try {
                                    const token = accessToken;
                                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                                    const res = await fetch(`${origin}/api/applications/${app.id}/accept`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
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
                                className="text-xs px-2 py-1 rounded bg-primary text-white"
                              >
                                Accept
                              </button>
                              <button
                                type="button"
                                disabled={!!acceptLoading}
                                onClick={async () => {
                                  if (!userId) return;
                                  setAcceptLoading(app.id);
                                  try {
                                    const token = accessToken;
                                    const origin = typeof window !== "undefined" ? window.location.origin : "";
                                    const res = await fetch(`${origin}/api/applications/${app.id}/reject`, { method: "POST", headers: { Authorization: `Bearer ${token}` } });
                                    const json = await res.json().catch(() => ({}));
                                    if (res.ok && json?.ok) {
                                      const all = await listJobs();
                                      setOrgJobs((all ?? []).filter((job: { org_id: string }) => job.org_id === org?.id));
                                      const jobsForOrg = (all ?? []).filter((job: { org_id: string }) => job.org_id === org?.id);
                                      const appList = jobsForOrg.length ? await listApplicationsForJobs(jobsForOrg.map((job: { id: string }) => job.id)) : [];
                                      setApplications(appList);
                                    }
                                  } finally {
                                    setAcceptLoading(null);
                                  }
                                }}
                                className="text-xs px-2 py-1 rounded border border-zinc-300"
                              >
                                Reject
                              </button>
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
