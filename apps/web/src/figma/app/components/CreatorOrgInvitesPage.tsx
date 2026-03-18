"use client";

import React, { useEffect, useState, useCallback } from "react";
import { ArrowLeft, Building2, Briefcase, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Creator-facing: real org_job_invites + creator_program_invites only.
 * Personal workspace — not org operator tooling.
 */

type JobInviteRow = {
  id: string;
  invited_at: string;
  org: { id: string; name: string; slug: string | null };
  job: { id: string; title: string; apply_url: string | null; status: string };
  has_application: boolean;
  application_status: string | null;
  has_active_deal: boolean;
  deal_id: string | null;
};

type ProgramInviteRow = {
  id: string;
  invited_at: string;
  status: string;
  program: { id: string; title: string; org_id: string; status: string };
  org: { id: string; name: string; slug: string | null } | null;
};

export default function CreatorOrgInvitesPage({
  setRoute,
}: {
  setRoute: (r: { name: string; data?: Record<string, unknown> }) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [jobInvites, setJobInvites] = useState<JobInviteRow[]>([]);
  const [programInvites, setProgramInvites] = useState<ProgramInviteRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [actionId, setActionId] = useState<string | null>(null);
  const base = typeof window !== "undefined" ? window.location.origin : "";

  const load = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setErr(null);
    const res = await fetch(`${base}/api/me/org-invites`, { headers: { Authorization: `Bearer ${token}` } });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setErr((data as { error?: string }).error ?? "Could not load invites");
      return;
    }
    setJobInvites(Array.isArray(data.job_invites) ? data.job_invites : []);
    setProgramInvites(Array.isArray(data.program_invites) ? data.program_invites : []);
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  const patchProgramStatus = async (programId: string, status: "accepted" | "declined") => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    const { data: { user } } = await supabase.auth.getUser();
    if (!token || !user?.id) return;
    setActionId(`${programId}-${status}`);
    await fetch(`${base}/api/creator-programs/${encodeURIComponent(programId)}/invites`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: user.id, status }),
    });
    setActionId(null);
    void load();
  };

  const goToJob = (j: JobInviteRow) => {
    if (j.job.apply_url) {
      window.open(j.job.apply_url, "_blank", "noopener,noreferrer");
      return;
    }
    setRoute({ name: "market", data: { highlightJobId: j.job.id } });
  };

  const empty = !loading && jobInvites.length === 0 && programInvites.length === 0;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100">
      <div className="border-b border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
        <div className="max-w-3xl mx-auto px-6 py-6">
          <button
            type="button"
            onClick={() => setRoute({ name: "overview" })}
            className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 mb-4"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
          <h1 className="text-2xl font-bold">Invites from organizations</h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
            When an org invites you to a job or creator program through Linkary, it appears here. This list is grounded in
            real invite records—not notifications.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        {empty && !err && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No org invites yet. When a team invites you to apply to their role or join a program, you&apos;ll see it here.
          </p>
        )}

        {jobInvites.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Briefcase className="h-4 w-4" />
              Jobs &amp; sprints
            </h2>
            <ul className="space-y-3">
              {jobInvites.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{row.org.name}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                        Invited you to apply: <strong>{row.job.title}</strong>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Invited {new Date(row.invited_at).toLocaleDateString()}
                        {row.has_active_deal && " · Active deal"}
                        {row.has_application && !row.has_active_deal && ` · Application: ${row.application_status ?? "submitted"}`}
                        {!row.has_application && !row.has_active_deal && " · Not applied yet"}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => goToJob(row)}
                          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
                        >
                          {row.has_application ? "View listing" : "Go to apply"}
                          <ExternalLink className="h-3.5 w-3.5" />
                        </button>
                        {row.deal_id && (
                          <button
                            type="button"
                            onClick={() => setRoute({ name: "dealDetail", data: { dealId: row.deal_id } })}
                            className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                          >
                            Open deal
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {programInvites.length > 0 && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3 flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              Creator programs
            </h2>
            <ul className="space-y-3">
              {programInvites.map((row) => (
                <li
                  key={row.id}
                  className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
                >
                  <div className="flex items-start gap-3">
                    <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{row.org?.name ?? "Organization"}</p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-1">
                        Program: <strong>{row.program.title}</strong>
                      </p>
                      <p className="text-xs text-zinc-500 mt-1">
                        Status: <strong>{row.status}</strong> · Invited {new Date(row.invited_at).toLocaleDateString()}
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => setRoute({ name: "market", data: { view: "creator_programs" } })}
                          className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
                        >
                          Browse programs (marketplace)
                        </button>
                        {row.status === "invited" && (
                          <>
                            <button
                              type="button"
                              disabled={!!actionId}
                              onClick={() => patchProgramStatus(row.program.id, "accepted")}
                              className="text-sm px-3 py-1.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                            >
                              {actionId === `${row.program.id}-accepted` ? "…" : "Accept"}
                            </button>
                            <button
                              type="button"
                              disabled={!!actionId}
                              onClick={() => patchProgramStatus(row.program.id, "declined")}
                              className="text-sm px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                            >
                              {actionId === `${row.program.id}-declined` ? "…" : "Decline"}
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}
