"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { ArrowLeft, Building2, Briefcase, Sparkles, ExternalLink, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";

/**
 * Creator-facing: org_job_invites + creator_program_invites.
 * Unread = viewed_at / invitee_inbox_seen_at null until creator opens this page (mark-inbox-opened).
 */

type JobInviteRow = {
  id: string;
  invited_at: string;
  creator_response: string;
  creator_responded_at: string | null;
  viewed_at: string | null;
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
  invitee_inbox_seen_at: string | null;
  program: { id: string; title: string; org_id: string; status: string };
  org: { id: string; name: string; slug: string | null } | null;
};

function jobNeedsAction(row: JobInviteRow) {
  if (row.has_active_deal || row.has_application) return false;
  if (row.creator_response === "dismissed" || row.creator_response === "declined") return false;
  const open = row.job.status === "open" || row.job.status === "draft";
  return open;
}

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
  const [markInboxAttempted, setMarkInboxAttempted] = useState(false);
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
    setProgramInvites(
      (Array.isArray(data.program_invites) ? data.program_invites : []).map((p: ProgramInviteRow) => ({
        ...p,
        invitee_inbox_seen_at: p.invitee_inbox_seen_at ?? null,
      }))
    );
  }, [base]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Opening this page marks inbox as seen (stored); sidebar/topbar refresh via event. */
  useEffect(() => {
    if (loading || err || markInboxAttempted) return;
    setMarkInboxAttempted(true);
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const t = session?.access_token;
      if (!t) return;
      const res = await fetch(`${base}/api/me/org-invites/mark-inbox-opened`, {
        method: "POST",
        headers: { Authorization: `Bearer ${t}` },
      });
      const now = new Date().toISOString();
      if (res.ok) {
        setJobInvites((prev) => prev.map((j) => (j.viewed_at ? j : { ...j, viewed_at: now })));
        setProgramInvites((prev) =>
          prev.map((p) => (p.invitee_inbox_seen_at ? p : { ...p, invitee_inbox_seen_at: now }))
        );
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("org-invites-inbox-opened"));
      }
    })();
  }, [loading, err, markInboxAttempted, base]);

  const patchJobInvite = async (inviteId: string, body: Record<string, unknown>) => {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;
    setActionId(inviteId);
    await fetch(`${base}/api/me/org-job-invites/${encodeURIComponent(inviteId)}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setActionId(null);
    void load();
  };

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

  const goApply = (row: JobInviteRow) => {
    if (row.job.apply_url) {
      window.open(row.job.apply_url, "_blank", "noopener,noreferrer");
      return;
    }
    setRoute({ name: "market", data: { highlightJobId: row.job.id } });
  };

  const jobStatusLine = (row: JobInviteRow) => {
    if (row.has_active_deal) return "You have an active deal for this role.";
    if (row.has_application)
      return `You already applied — application is ${row.application_status ?? "in progress"}.`;
    if (row.creator_response === "dismissed") return "You hid this invite from your main list.";
    if (row.creator_response === "declined") return "You marked that you’re not interested.";
    if (row.creator_response === "interested") return "You’re interested. Apply when you’re ready.";
    return "You’ve been invited to apply — no application yet.";
  };

  const jobBadge = (row: JobInviteRow) => {
    if (row.has_active_deal) return { text: "Active deal", className: "bg-violet-100 text-violet-900 dark:bg-violet-900/40 dark:text-violet-100" };
    if (row.has_application) return { text: "Applied", className: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-100" };
    if (row.creator_response === "dismissed") return { text: "Hidden", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" };
    if (row.creator_response === "declined") return { text: "Passed", className: "bg-zinc-200 text-zinc-700 dark:bg-zinc-700 dark:text-zinc-200" };
    if (row.creator_response === "interested") return { text: "Interested", className: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100" };
    return { text: "Invited", className: "bg-indigo-100 text-indigo-900 dark:bg-indigo-900/40 dark:text-indigo-100" };
  };

  const canRespond = (row: JobInviteRow) => !row.has_application && !row.has_active_deal;
  const jobOpen = (row: JobInviteRow) => row.job.status === "open" || row.job.status === "draft";

  const { newJobs, newPrograms, awaitingJobs, awaitingPrograms, historyJobs, historyPrograms } = useMemo(() => {
    const nj = jobInvites.filter((j) => !j.viewed_at);
    const np = programInvites.filter((p) => !p.invitee_inbox_seen_at);
    const aj = jobInvites.filter((j) => j.viewed_at && jobNeedsAction(j) && (j.creator_response === "pending" || j.creator_response === "interested"));
    const ap = programInvites.filter((p) => p.invitee_inbox_seen_at && p.status === "invited");
    const seenIds = new Set([...nj.map((j) => j.id), ...aj.map((j) => j.id)]);
    const seenProg = new Set([...np.map((p) => p.id), ...ap.map((p) => p.id)]);
    const hj = jobInvites.filter((j) => !seenIds.has(j.id));
    const hp = programInvites.filter((p) => !seenProg.has(p.id));
    return { newJobs: nj, newPrograms: np, awaitingJobs: aj, awaitingPrograms: ap, historyJobs: hj, historyPrograms: hp };
  }, [jobInvites, programInvites]);

  const empty = !loading && jobInvites.length === 0 && programInvites.length === 0;

  const renderJobCard = (row: JobInviteRow, opts?: { isNew?: boolean }) => {
    const b = jobBadge(row);
    const busy = actionId === row.id;
    const isNew = opts?.isNew;
    return (
      <li
        key={row.id}
        className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3 min-w-0">
            <Building2 className="h-5 w-5 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded-full ${b.className}`}>{b.text}</span>
                {isNew && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                    New
                  </span>
                )}
              </div>
              <p className="font-semibold text-zinc-900 dark:text-zinc-100">{row.org.name}</p>
              <p className="text-sm text-zinc-700 dark:text-zinc-300 mt-1">
                Invited you to apply for: <strong>{row.job.title}</strong>
              </p>
              <p className="text-xs text-zinc-500 mt-2">{jobStatusLine(row)}</p>
              <p className="text-[11px] text-zinc-400 mt-1">Invited {new Date(row.invited_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {(row.has_active_deal && row.deal_id) && (
            <button
              type="button"
              onClick={() => setRoute({ name: "dealDetail", data: { dealId: row.deal_id } })}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700"
            >
              Open your deal
            </button>
          )}
          {row.has_application && !row.has_active_deal && jobOpen(row) && (
            <button
              type="button"
              onClick={() => goApply(row)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              View listing
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
          {canRespond(row) && jobOpen(row) && (
            <button
              type="button"
              disabled={busy}
              onClick={() => goApply(row)}
              className="inline-flex items-center gap-1.5 text-sm font-medium px-4 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Apply now
              <ExternalLink className="h-3.5 w-3.5" />
            </button>
          )}
          {canRespond(row) && (
            <>
              {row.creator_response !== "interested" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patchJobInvite(row.id, { creator_response: "interested" })}
                  className="text-sm px-3 py-2 rounded-lg border border-sky-300 dark:border-sky-700 text-sky-800 dark:text-sky-200 hover:bg-sky-50 dark:hover:bg-sky-950/40 disabled:opacity-50"
                >
                  I&apos;m interested
                </button>
              )}
              {row.creator_response !== "declined" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patchJobInvite(row.id, { creator_response: "declined" })}
                  className="text-sm px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 disabled:opacity-50"
                >
                  Not interested
                </button>
              )}
              {row.creator_response !== "dismissed" && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patchJobInvite(row.id, { creator_response: "dismissed" })}
                  className="text-sm px-3 py-2 text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 disabled:opacity-50"
                >
                  Hide from list
                </button>
              )}
              {(row.creator_response === "declined" ||
                row.creator_response === "dismissed" ||
                row.creator_response === "interested") && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => patchJobInvite(row.id, { creator_response: "pending" })}
                  className="text-sm px-3 py-2 text-zinc-500 hover:underline disabled:opacity-50"
                >
                  Undo response
                </button>
              )}
            </>
          )}
          {!jobOpen(row) && canRespond(row) && (
            <span className="text-xs text-zinc-500 self-center">This listing is no longer open.</span>
          )}
        </div>
      </li>
    );
  };

  const renderProgramCard = (row: ProgramInviteRow, opts?: { isNew?: boolean }) => (
    <li
      key={row.id}
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-4 shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-medium">{row.org?.name ?? "Organization"}</p>
            {opts?.isNew && (
              <span className="text-[10px] font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/40 px-2 py-0.5 rounded-full">
                New
              </span>
            )}
          </div>
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
  );

  const hasNew = newJobs.length > 0 || newPrograms.length > 0;
  const hasAwaiting = awaitingJobs.length > 0 || awaitingPrograms.length > 0;
  const hasHistory = historyJobs.length > 0 || historyPrograms.length > 0;

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
            Real invites only. When you apply or get a deal, that status comes from your real application and deal — not
            from a button here. Unread items clear when you open this page.
          </p>
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-6 py-8 space-y-10">
        {loading && (
          <div className="flex items-center gap-2 text-zinc-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading…
          </div>
        )}
        {err && <p className="text-sm text-red-600 dark:text-red-400">{err}</p>}
        {empty && !err && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            No org invites yet. When a team invites you to a role or program, you&apos;ll see it here.
          </p>
        )}

        {hasNew && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">New in your inbox</h2>
            <p className="text-xs text-zinc-500 mb-4">You haven&apos;t opened these since they arrived.</p>
            {newJobs.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  Jobs &amp; sprints
                </h3>
                <ul className="space-y-4 mb-6">{newJobs.map((row) => renderJobCard(row, { isNew: true }))}</ul>
              </>
            )}
            {newPrograms.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Creator programs
                </h3>
                <ul className="space-y-3">{newPrograms.map((row) => renderProgramCard(row, { isNew: true }))}</ul>
              </>
            )}
          </section>
        )}

        {hasAwaiting && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">Awaiting your action</h2>
            <p className="text-xs text-zinc-500 mb-4">Open listings you care about, respond, or accept/decline programs.</p>
            {awaitingJobs.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  Jobs &amp; sprints
                </h3>
                <ul className="space-y-4 mb-6">{awaitingJobs.map((row) => renderJobCard(row))}</ul>
              </>
            )}
            {awaitingPrograms.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Creator programs
                </h3>
                <ul className="space-y-3">{awaitingPrograms.map((row) => renderProgramCard(row))}</ul>
              </>
            )}
          </section>
        )}

        {hasHistory && (
          <section>
            <h2 className="text-sm font-semibold text-zinc-500 uppercase tracking-wide mb-3">History</h2>
            <p className="text-xs text-zinc-500 mb-4">Applied, deals, passed invites, and settled program invites.</p>
            {historyJobs.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5" />
                  Jobs &amp; sprints
                </h3>
                <ul className="space-y-4 mb-6">{historyJobs.map((row) => renderJobCard(row))}</ul>
              </>
            )}
            {historyPrograms.length > 0 && (
              <>
                <h3 className="text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-2 flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5" />
                  Creator programs
                </h3>
                <ul className="space-y-3">{historyPrograms.map((row) => renderProgramCard(row))}</ul>
              </>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
