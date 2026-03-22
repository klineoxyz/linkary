import Link from "next/link";
import { notFound } from "next/navigation";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignDetailReport } from "@/lib/opsReporting";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function rate(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export default async function OpsCampaignReportDetailPage({ params }: { params: Promise<{ campaignId: string }> }) {
  const { service } = await assertOpsPageAccess();
  const { campaignId } = await params;
  const rep = await fetchOpsCampaignDetailReport(service, campaignId);
  if (!rep) notFound();

  const s = rep.stats;
  const completionRate = rate(s.accepted, s.invited);
  const approvalRate = rate(s.approved, s.submissions);

  return (
    <div className="space-y-8">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--crm-muted)] mb-1">
            <Link href="/ops/reports/campaigns" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
              ← Campaign reports
            </Link>
          </p>
          <h1 className="crm-page-title">{rep.campaign.title}</h1>
          <p className="crm-page-subtitle">
            Status <span className="font-mono">{rep.campaign.status}</span>
            {rep.workspace ? (
              <>
                {" "}
                · Workspace {rep.workspace.name}
                {rep.org ? (
                  <>
                    {" "}
                    · Org{" "}
                    <Link
                      href={`/ops/reports/projects/${rep.org.id}`}
                      className="text-[var(--crm-primary)] underline-offset-2 hover:underline"
                    >
                      {rep.org.name ?? rep.org.slug}
                    </Link>
                  </>
                ) : null}
              </>
            ) : null}
          </p>
          {rep.submissionsTruncated ? (
            <p className="text-xs text-amber-800 mt-2">
              Participants or submissions list hit internal scan cap — export CSV for full pull if needed.
            </p>
          ) : null}
        </div>
        <a
          href={`/api/ops/export/campaign/${campaignId}`}
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Export submissions CSV
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Schedule</p>
          <p className="text-sm">Starts {rep.campaign.starts_at ?? "—"}</p>
          <p className="text-sm">Ends {rep.campaign.ends_at ?? "—"}</p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Budget / value</p>
          <p className="text-sm tabular-nums">
            budget: {rep.campaign.budget ?? "—"} {rep.campaign.currency ?? ""}
          </p>
          <p className="text-sm tabular-nums">campaign_value_usd: {rep.campaign.campaign_value_usd ?? "—"}</p>
          <OpsConfidenceBadge kind="proxy" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Org plan</p>
          <p className="text-xl font-mono font-semibold">{rep.org_plan_key}</p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Reach / impressions</p>
          <p className="text-sm text-[var(--crm-muted)]">Not computed — no campaign-level truth in-schema for this view.</p>
          <OpsConfidenceBadge kind="not_computed" className="mt-2" />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] mb-1">Participants</p>
          <p className="text-lg font-semibold tabular-nums">
            {s.invited} inv / {s.accepted} acc / {s.declined} dec / {s.removed} rem
          </p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] mb-1">Submissions</p>
          <p className="text-lg font-semibold tabular-nums">
            {s.submissions} total · {s.approved} appr · {s.rejected} rej · {s.needs_revision} rev · {s.pending} pend
          </p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] mb-1">Completion (acc ÷ inv)</p>
          <p className="text-xl font-semibold tabular-nums">{completionRate}</p>
          <OpsConfidenceBadge kind="proxy" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] mb-1">Approval (appr ÷ sub)</p>
          <p className="text-xl font-semibold tabular-nums">{approvalRate}</p>
          <OpsConfidenceBadge kind="proxy" className="mt-2" />
        </div>
      </div>

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Timing</h2>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[var(--crm-muted)] text-xs">First submission</p>
            <p className="font-mono text-xs">{s.firstSubmissionAt ?? "—"}</p>
            <OpsConfidenceBadge kind="exact" className="mt-1" />
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs">Last submission</p>
            <p className="font-mono text-xs">{s.lastSubmissionAt ?? "—"}</p>
            <OpsConfidenceBadge kind="exact" className="mt-1" />
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs">Median hours accept → first submit</p>
            <p className="tabular-nums">{s.medianHoursInviteToSubmit != null ? s.medianHoursInviteToSubmit.toFixed(1) : "—"}</p>
            <OpsConfidenceBadge kind="estimated" className="mt-1" />
            <p className="text-[10px] text-[var(--crm-muted)] mt-1">Per accepted participant with ≥1 submission.</p>
          </div>
        </div>
      </section>

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Outputs by platform (submissions)</h2>
        <OpsConfidenceBadge kind="exact" className="mb-2" />
        <table className="w-full text-sm max-w-md">
          <tbody>
            {Object.entries(s.byPlatform)
              .sort((a, b) => b[1] - a[1])
              .map(([k, v]) => (
                <tr key={k} className="border-b border-[var(--crm-border)]/50">
                  <td className="py-2 font-mono text-xs">{k}</td>
                  <td className="py-2 text-right tabular-nums">{v}</td>
                </tr>
              ))}
            {Object.keys(s.byPlatform).length === 0 ? (
              <tr>
                <td className="py-4 text-[var(--crm-muted)]">No submissions.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Follow compliance (sample participants)</h2>
        <p className="text-xs text-[var(--crm-muted)] mb-3">
          Exact JSON from <code className="text-[10px]">x_follow_attestation</code> /{" "}
          <code className="text-[10px]">x_follow_verification</code> — first 40 rows.
        </p>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-xs min-w-[800px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">Profile</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2">Attestation / verification</th>
              </tr>
            </thead>
            <tbody>
              {rep.participants.slice(0, 40).map((p) => (
                <tr key={p.id} className="border-b border-[var(--crm-border)]/60 align-top">
                  <td className="py-2 pr-2 font-mono text-[10px] break-all max-w-[120px]">
                    <Link href={`/ops/reports/creators/${p.participant_profile_id}`} className="text-[var(--crm-primary)] hover:underline">
                      {p.participant_profile_id.slice(0, 8)}…
                    </Link>
                  </td>
                  <td className="py-2 pr-2 font-mono">{p.status}</td>
                  <td className="py-2">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all bg-[var(--crm-banner-muted)] p-2 rounded max-h-32 overflow-y-auto">
                      {JSON.stringify({ attestation: p.x_follow_attestation, verification: p.x_follow_verification }, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
