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
  inviteAffiliate,
  inviteAmbassador,
  recomputeOrgMetricsRpc,
  isOrgAdmin,
  type Org,
  type OrgMember,
  type OrgAffiliation,
  type OrgAmbassador,
} from "@/lib/orgs";

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
  const [tab, setTab] = useState<"members" | "affiliates" | "ambassadors" | "case_studies">("members");
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [affiliations, setAffiliations] = useState<OrgAffiliation[]>([]);
  const [ambassadors, setAmbassadors] = useState<OrgAmbassador[]>([]);
  const [userId, setUserId] = useState<string | null>(null);
  const [admin, setAdmin] = useState(false);
  const [affiliateHandle, setAffiliateHandle] = useState("");
  const [ambassadorHandle, setAmbassadorHandle] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [recomputeLoading, setRecomputeLoading] = useState(false);

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
        const [m, a, am] = await Promise.all([
          listOrgMembers(o.id),
          listOrgAffiliations(o.id),
          listOrgAmbassadors(o.id),
        ]);
        setMembers(m);
        setAffiliations(a);
        setAmbassadors(am);
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
    const fn = type === "affiliate" ? inviteAffiliate : inviteAmbassador;
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
    await recomputeOrgMetricsRpc(org.id);
    setRecomputeLoading(false);
  };

  if (loading || !orgId) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
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
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-50"
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
            <div className="w-14 h-14 rounded-xl bg-indigo-500/20 flex items-center justify-center">
              <Building2 className="w-7 h-7 text-indigo-400" />
            </div>
          )}
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">{org.name}</h1>
            {org.tagline && <p className="text-zinc-600 dark:text-zinc-400 text-sm mt-0.5">{org.tagline}</p>}
            <p className="text-xs text-zinc-500 mt-1">@{org.slug} · {org.org_type}</p>
          </div>
        </div>

        <div className="flex border-b border-zinc-200 dark:border-zinc-700 overflow-x-auto">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                tab === t.id
                  ? "border-indigo-500 text-indigo-600 dark:text-indigo-400"
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
                    <span className="text-xs px-2 py-1 rounded-full bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">{m.role}</span>
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
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-50"
                  >
                    Invite Affiliate
                  </button>
                  {inviteError && tab === "affiliates" && <p className="text-red-500 text-sm w-full">{inviteError}</p>}
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
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm disabled:opacity-50"
                  >
                    Invite Ambassador
                  </button>
                  {inviteError && tab === "ambassadors" && <p className="text-red-500 text-sm w-full">{inviteError}</p>}
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

          {tab === "case_studies" && (
            <p className="text-zinc-500 text-sm">Case studies for this org — coming soon.</p>
          )}
        </div>
      </div>
    </div>
  );
}
