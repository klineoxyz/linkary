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
  type Org,
  type OrgMember,
  type OrgAffiliation,
  type OrgAmbassador,
} from "@/lib/orgs";
import { listJobs, createJob } from "@/lib/jobs";
import { listCaseStudiesForOrg, createCaseStudyForOrg, type CaseStudy } from "@/lib/caseStudies";
import { Briefcase } from "lucide-react";

export default function OrgDetailPage({
  setRoute,
  data,
}: {
  setRoute: (r: { name: string; data?: any }) => void;
  data?: { orgId?: string; slug?: string };
}) {
  const orgId = data?.orgId ?? data?.slug;
  const [org, setOrg] = useState<Org | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"members" | "affiliates" | "ambassadors" | "jobs" | "case_studies">("members");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [affiliations, setAffiliations] = useState<OrgAffiliation[]>([]);
  const [ambassadors, setAmbassadors] = useState<OrgAmbassador[]>([]);
  const [metrics, setMetrics] = useState<{ combined_followers: number; avg_engagement_rate: number; potential_reach: number } | null>(null);
  const [orgJobs, setOrgJobs] = useState<any[]>([]);
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
        setOrgJobs((jobsAll ?? []).filter((j) => j.org_id === o.id));
        setCaseStudies(cs ?? []);
        if (userId) {
          const isAdmin = await isOrgAdmin(userId, o.id);
          setAdmin(isAdmin);
        }
      }
      setLoading(false);
    })();
  }, [orgId, data?.orgId, userId]);

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
            <div className="space-y-3">
              {members.length === 0 ? (
                <p className="text-zinc-500 text-sm">No members yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m.id} className="flex items-center justify-between py-2 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <span className="font-mono text-sm text-zinc-600 dark:text-zinc-400">{m.user_id}</span>
                    <span className="text-xs px-2 py-1 rounded-full bg-accent text-primary">{m.role}</span>
                  </div>
                ))
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
            <div className="space-y-3">
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
                orgJobs.map((j) => (
                  <div key={j.id} className="flex items-center justify-between py-3 border-b border-zinc-100 dark:border-zinc-800 last:border-0">
                    <div>
                      <p className="font-medium text-zinc-900 dark:text-zinc-100">{j.title}</p>
                      <p className="text-xs text-zinc-500">{j.type} · {j.status}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRoute({ name: "market", data: { highlightJobId: j.id } })}
                      className="text-sm text-primary hover:opacity-90"
                    >
                      View in Marketplace
                    </button>
                  </div>
                ))
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
                  const { error } = await createJob(org.id, {
                    type: jobType,
                    title: jobTitle.trim(),
                    budget: jobBudget.trim() || undefined,
                    duration: jobDuration.trim() || undefined,
                    tags,
                  });
                  setJobSaving(false);
                  if (!error) {
                    const all = await listJobs();
                    setOrgJobs((all ?? []).filter((j) => j.org_id === org.id));
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
