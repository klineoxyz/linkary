"use client";

import React from "react";
import Link from "next/link";
import {
  Users,
  EyeOff,
  Eye,
  Heart,
  Ban,
  FileCheck,
  Handshake,
  Sparkles,
  Briefcase,
  ExternalLink,
  ListChecks,
  ChevronRight,
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
};

type ProgPipeRow = Prof & {
  id?: string;
  creator_program_id: string;
  program_title: string;
  status: string;
  invited_at: string;
  invitee_inbox_seen_at?: string | null;
};

type ShortlistRow = Prof & { list_names: string[]; has_any_job_invite: boolean };

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
};

function CreatorCell({ row }: { row: Prof }) {
  const label = row.display_name?.trim() || (row.username ? `@${row.username}` : null) || row.profile_id.slice(0, 8) + "…";
  if (row.username) {
    return (
      <Link href={`/${encodeURIComponent(row.username)}`} className="font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
        {label}
      </Link>
    );
  }
  return <span className="font-medium text-zinc-800 dark:text-zinc-200">{label}</span>;
}

function StageBlock({
  id,
  icon: Icon,
  title,
  hint,
  count,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  count: number;
  children: React.ReactNode;
}) {
  if (count === 0) return null;
  return (
    <section id={id} className="scroll-mt-24 rounded-2xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900/80 overflow-hidden">
      <div className="px-4 py-3 sm:px-5 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50/80 dark:bg-zinc-800/50 flex flex-wrap items-center gap-2">
        <Icon className="h-4 w-4 text-indigo-600 dark:text-indigo-400 shrink-0" />
        <h2 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{title}</h2>
        <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-100 dark:bg-indigo-900/50 text-indigo-800 dark:text-indigo-200">{count}</span>
      </div>
      <p className="px-4 sm:px-5 py-2 text-[11px] text-zinc-500 dark:text-zinc-400 border-b border-zinc-100 dark:border-zinc-800">{hint}</p>
      <div className="p-2 sm:p-3">{children}</div>
    </section>
  );
}

export default function OrgSourcingPipelineTab({
  orgId,
  pipeline,
  summary,
  setTab,
  setSelectedJobId,
  setSelectedProgramId,
  onOpenOrgKolLists,
  setRoute,
}: OrgSourcingPipelineTabProps) {
  if (!pipeline) {
    return (
      <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center text-sm text-zinc-500">
        Loading pipeline…
      </div>
    );
  }

  const p = pipeline;
  const shortlist = p.shortlisted_profiles ?? [];
  const unseenJob = p.job_invite_unseen_pending ?? [];
  const seenPending = p.job_invite_seen_pending ?? [];
  const interested = p.job_interested_not_applied ?? [];
  const passed = p.job_creator_passed ?? [];
  const applied = p.job_applied_after_invite ?? [];
  const deals = p.job_active_deal ?? [];
  const progUnseen = p.program_invite_unseen ?? [];
  const progSeen = p.program_invite_seen_pending ?? [];
  const progOk = p.program_progressed ?? [];
  const progOut = p.program_declined_or_removed ?? [];

  const stages = [
    { id: "stage-shortlist", n: shortlist.length, label: "Shortlisted" },
    { id: "stage-job-unseen", n: unseenJob.length, label: "Job invite unseen" },
    { id: "stage-job-seen", n: seenPending.length, label: "No response yet" },
    { id: "stage-interested", n: interested.length, label: "Interested" },
    { id: "stage-passed", n: passed.length, label: "Passed / hidden" },
    { id: "stage-applied", n: applied.length, label: "Applied" },
    { id: "stage-deal", n: deals.length, label: "Active deal" },
    { id: "stage-prog-unseen", n: progUnseen.length, label: "Program unseen" },
    { id: "stage-prog-pending", n: progSeen.length, label: "Program pending" },
    { id: "stage-prog-ok", n: progOk.length, label: "Program active" },
    { id: "stage-prog-out", n: progOut.length, label: "Program out" },
  ].filter((s) => s.n > 0);

  const openKol = (hint?: { suggestJobId?: string; suggestProgramId?: string }) => {
    if (onOpenOrgKolLists) onOpenOrgKolLists(orgId, hint);
    else if (typeof window !== "undefined") window.location.href = "/app/kol-lists";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-indigo-200 dark:border-indigo-900/50 bg-indigo-50/40 dark:bg-indigo-950/20 p-4 sm:p-5">
        <h1 className="text-lg font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <ListChecks className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
          Sourcing pipeline
        </h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400 max-w-3xl">
          One workflow view: shortlist → invites → creator intent → applications → deals → programs. All stages use stored or
          derived data only (no estimated engagement).
        </p>
        {summary && (
          <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-600 dark:text-zinc-400">
            <span>
              Shortlisted slots: <strong className="text-zinc-800 dark:text-zinc-200">{summary.shortlisted_org_members_count ?? 0}</strong>
            </span>
            <span>
              Job invites: <strong className="text-zinc-800 dark:text-zinc-200">{summary.job_invites_count ?? 0}</strong>
            </span>
            <span>
              Program invites (pending): <strong className="text-zinc-800 dark:text-zinc-200">{summary.program_invites_pending ?? 0}</strong>
            </span>
          </div>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => openKol()}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700"
          >
            <Users className="h-3.5 w-3.5" />
            Org KOL lists — shortlist &amp; invite
          </button>
          <button
            type="button"
            onClick={() => setTab("jobs")}
            className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-zinc-800"
          >
            <Briefcase className="h-3.5 w-3.5" />
            Jobs &amp; applications
          </button>
        </div>
      </div>

      {stages.length > 0 && (
        <nav className="flex flex-wrap gap-1.5 text-[11px] sm:text-xs" aria-label="Pipeline stages">
          {stages.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full border border-zinc-200 dark:border-zinc-600 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {s.label}
              <span className="font-semibold text-zinc-800 dark:text-zinc-200">{s.n}</span>
            </a>
          ))}
        </nav>
      )}

      <StageBlock
        id="stage-shortlist"
        icon={Users}
        title="Shortlisted creators"
        hint="From org KOL lists (shortlist flag). Invite them to a job or program from KOL lists."
        count={shortlist.length}
      >
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
          <table className="w-full text-left text-xs sm:text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400">
              <tr>
                <th className="px-3 py-2 font-medium">Creator</th>
                <th className="px-3 py-2 font-medium">Lists</th>
                <th className="px-3 py-2 font-medium">Job invited?</th>
                <th className="px-3 py-2 font-medium w-[1%]">Actions</th>
              </tr>
            </thead>
            <tbody>
              {shortlist.map((row) => (
                <tr key={row.profile_id} className="border-t border-zinc-100 dark:border-zinc-800">
                  <td className="px-3 py-2">
                    <CreatorCell row={row} />
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400 max-w-[200px] truncate" title={row.list_names.join(", ")}>
                    {row.list_names.join(", ") || "—"}
                  </td>
                  <td className="px-3 py-2 text-zinc-600 dark:text-zinc-400">{row.has_any_job_invite ? "Yes" : "Not yet"}</td>
                  <td className="px-3 py-2 whitespace-nowrap">
                    <button
                      type="button"
                      onClick={() => openKol()}
                      className="text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-0.5"
                    >
                      Invite <ChevronRight className="h-3 w-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </StageBlock>

      <StageBlock
        id="stage-job-unseen"
        icon={EyeOff}
        title="Job invite — creator has not opened inbox"
        hint="Grounded on viewed_at empty. Creator may still see the invite after opening Org invites."
        count={unseenJob.length}
      >
        <PipeJobTable
          rows={unseenJob}
          extraCols={["Invited"]}
          renderExtra={(row) => <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>}
          actions={(row) => (
            <>
              <button type="button" onClick={() => { setSelectedJobId(row.job_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                Open job
              </button>
              <button type="button" onClick={() => openKol({ suggestJobId: row.job_id })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
                KOL list
              </button>
            </>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-job-seen"
        icon={Eye}
        title="Job invite — opened inbox, no response yet"
        hint="Creator opened Org invites; still pending on this role."
        count={seenPending.length}
      >
        <PipeJobTable
          rows={seenPending}
          extraCols={["Invited"]}
          renderExtra={(row) => <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>}
          actions={(row) => (
            <>
              <button type="button" onClick={() => { setSelectedJobId(row.job_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                Open job
              </button>
              <button type="button" onClick={() => openKol({ suggestJobId: row.job_id })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
                KOL list
              </button>
            </>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-interested"
        icon={Heart}
        title="Interested — not applied yet"
        hint="creator_response = interested; no application row yet. Follow up or wait for apply."
        count={interested.length}
      >
        <PipeJobTable
          rows={interested}
          extraCols={["Invited"]}
          renderExtra={(row) => <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>}
          actions={(row) => (
            <>
              <button type="button" onClick={() => { setSelectedJobId(row.job_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                Open job / listing
              </button>
              <button type="button" onClick={() => openKol({ suggestJobId: row.job_id })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
                KOL list
              </button>
            </>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-passed"
        icon={Ban}
        title="Passed or hidden (job)"
        hint="Creator declined or hid invite; still no application. Respect their choice for outreach."
        count={passed.length}
      >
        <PipeJobTable
          rows={passed}
          extraCols={["Response", "Invited"]}
          renderExtra={(row) => (
            <>
              <td className="px-3 py-2 text-zinc-600">{row.creator_response === "declined" ? "Passed" : "Hidden"}</td>
              <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>
            </>
          )}
          actions={(row) => (
            <button type="button" onClick={() => { setSelectedJobId(row.job_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
              View job
            </button>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-applied"
        icon={FileCheck}
        title="Applied after job invite"
        hint="Derived from applications. Review and move forward in Jobs tab."
        count={applied.length}
      >
        <PipeJobTable
          rows={applied}
          extraCols={["Invited"]}
          renderExtra={(row) => <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>}
          actions={(row) => (
            <button
              type="button"
              onClick={() => {
                setSelectedJobId(row.job_id);
                setTab("jobs");
              }}
              className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs inline-flex items-center gap-1"
            >
              Review applicants <ExternalLink className="h-3 w-3" />
            </button>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-deal"
        icon={Handshake}
        title="Active deal (job)"
        hint="Derived from deals (active). Delivery and milestones live on the deal page."
        count={deals.length}
      >
        <PipeJobTable
          rows={deals}
          extraCols={["Invited"]}
          renderExtra={(row) => <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>}
          actions={(row) => (
            <>
              {row.active_deal_id ? (
                <button
                  type="button"
                  onClick={() => setRoute({ name: "dealDetail", data: { dealId: row.active_deal_id } })}
                  className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs inline-flex items-center gap-1"
                >
                  Open deal <ExternalLink className="h-3 w-3" />
                </button>
              ) : (
                <span className="text-zinc-400 text-xs">Deal id missing</span>
              )}
              <button type="button" onClick={() => { setSelectedJobId(row.job_id); setTab("jobs"); }} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
                Job
              </button>
            </>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-prog-unseen"
        icon={EyeOff}
        title="Program invite — inbox not opened"
        hint="invitee_inbox_seen_at empty. Same grounded rule as job unseen."
        count={progUnseen.length}
      >
        <PipeProgTable
          rows={progUnseen}
          actions={(row) => (
            <>
              <button type="button" onClick={() => { setSelectedProgramId(row.creator_program_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                Program (Jobs tab)
              </button>
              <button type="button" onClick={() => openKol({ suggestProgramId: row.creator_program_id })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
                KOL lists
              </button>
            </>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-prog-pending"
        icon={Sparkles}
        title="Program — awaiting creator response"
        hint="Status invited; creator opened org inbox. Accept/decline is on their side."
        count={progSeen.length}
      >
        <PipeProgTable
          rows={progSeen}
          actions={(row) => (
            <>
              <button type="button" onClick={() => { setSelectedProgramId(row.creator_program_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
                Manage program
              </button>
              <button type="button" onClick={() => openKol({ suggestProgramId: row.creator_program_id })} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
                KOL lists
              </button>
            </>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-prog-ok"
        icon={Sparkles}
        title="Program — in progress"
        hint="Accepted or later statuses from creator_program_invites (excl. declined/removed)."
        count={progOk.length}
      >
        <PipeProgTable
          rows={progOk}
          showStatus
          actions={(row) => (
            <button type="button" onClick={() => { setSelectedProgramId(row.creator_program_id); setTab("jobs"); }} className="text-indigo-600 dark:text-indigo-400 hover:underline text-xs">
              Program detail
            </button>
          )}
        />
      </StageBlock>

      <StageBlock
        id="stage-prog-out"
        icon={Ban}
        title="Program — declined or removed"
        hint="Stored program invite status."
        count={progOut.length}
      >
        <PipeProgTable
          rows={progOut}
          showStatus
          actions={(row) => (
            <button type="button" onClick={() => { setSelectedProgramId(row.creator_program_id); setTab("jobs"); }} className="text-zinc-600 dark:text-zinc-400 hover:underline text-xs">
              View program
            </button>
          )}
        />
      </StageBlock>

      {shortlist.length === 0 &&
        unseenJob.length === 0 &&
        seenPending.length === 0 &&
        interested.length === 0 &&
        passed.length === 0 &&
        applied.length === 0 &&
        deals.length === 0 &&
        progUnseen.length === 0 &&
        progSeen.length === 0 &&
        progOk.length === 0 &&
        progOut.length === 0 && (
          <div className="rounded-xl border border-dashed border-zinc-300 dark:border-zinc-600 p-8 text-center">
            <p className="text-sm text-zinc-600 dark:text-zinc-400">No sourcing activity yet.</p>
            <p className="text-xs text-zinc-500 mt-2 max-w-md mx-auto">
              Shortlist creators in <strong>Org KOL lists</strong>, then invite them to jobs or creator programs. This pipeline
              will populate automatically.
            </p>
            <button
              type="button"
              onClick={() => openKol()}
              className="mt-4 text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Open KOL lists →
            </button>
          </div>
        )}
    </div>
  );
}

function PipeJobTable({
  rows,
  extraCols,
  renderExtra,
  actions,
}: {
  rows: JobPipeRow[];
  extraCols: string[];
  renderExtra: (row: JobPipeRow) => React.ReactNode;
  actions: (row: JobPipeRow) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">Creator</th>
            <th className="px-3 py-2 font-medium">Role</th>
            {extraCols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
            <th className="px-3 py-2 font-medium w-[1%]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={`${row.profile_id}-${row.job_id}`} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="px-3 py-2">
                <CreatorCell row={row} />
              </td>
              <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 max-w-[180px] truncate" title={row.job_title}>
                {row.job_title}
              </td>
              {renderExtra(row)}
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-x-2 gap-y-1">{actions(row)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function PipeProgTable({
  rows,
  showStatus,
  actions,
}: {
  rows: ProgPipeRow[];
  showStatus?: boolean;
  actions: (row: ProgPipeRow) => React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-700">
      <table className="w-full text-left text-xs sm:text-sm">
        <thead className="bg-zinc-50 dark:bg-zinc-800/80 text-zinc-500 dark:text-zinc-400">
          <tr>
            <th className="px-3 py-2 font-medium">Creator</th>
            <th className="px-3 py-2 font-medium">Program</th>
            {showStatus && <th className="px-3 py-2 font-medium">Status</th>}
            <th className="px-3 py-2 font-medium">Invited</th>
            <th className="px-3 py-2 font-medium w-[1%]">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id ?? `${row.profile_id}-${row.creator_program_id}`} className="border-t border-zinc-100 dark:border-zinc-800">
              <td className="px-3 py-2">
                <CreatorCell row={row} />
              </td>
              <td className="px-3 py-2 text-zinc-700 dark:text-zinc-300 max-w-[200px] truncate" title={row.program_title}>
                {row.program_title}
              </td>
              {showStatus && <td className="px-3 py-2 text-zinc-600 capitalize">{row.status}</td>}
              <td className="px-3 py-2 text-zinc-500">{new Date(row.invited_at).toLocaleDateString()}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-x-2 gap-y-1">{actions(row)}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
