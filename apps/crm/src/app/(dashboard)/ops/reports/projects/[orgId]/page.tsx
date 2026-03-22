import Link from "next/link";
import { notFound } from "next/navigation";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOrgDetailReport } from "@/lib/opsReporting";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function rate(n: number, d: number): string {
  if (d <= 0) return "—";
  return `${((n / d) * 100).toFixed(1)}%`;
}

export default async function OpsOrgReportDetailPage({ params }: { params: Promise<{ orgId: string }> }) {
  const { service } = await assertOpsPageAccess();
  const { orgId } = await params;
  const rep = await fetchOpsOrgDetailReport(service, orgId);
  if (!rep) notFound();

  const avgCreators =
    rep.totals.campaigns > 0 ? (rep.totals.accepted / rep.totals.campaigns).toFixed(2) : "—";
  const completionRate = rate(rep.totals.completed, rep.totals.campaigns);
  const approvalRate = rate(rep.totals.approved_submissions, rep.totals.submissions);

  return (
    <div className="space-y-8">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs text-[var(--crm-muted)] mb-1">
            <Link href="/ops/reports/projects" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
              ← Project reports
            </Link>
          </p>
          <h1 className="crm-page-title">{rep.org.name ?? "Org"}</h1>
          <p className="crm-page-subtitle font-mono text-xs">{rep.org.slug ?? rep.org.id}</p>
          <div className="flex flex-wrap gap-2 mt-2">
            <OpsConfidenceBadge kind="exact" />
            {rep.scanNote ? <OpsConfidenceBadge kind="estimated" /> : null}
          </div>
          {rep.scanNote ? <p className="text-xs text-amber-800 mt-2">{rep.scanNote}</p> : null}
        </div>
        <a
          href={`/api/ops/export/org/${orgId}`}
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Export campaigns CSV
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Org plan (active sub)</p>
          <p className="text-xl font-semibold font-mono">{rep.plan_key}</p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Campaigns</p>
          <p className="text-xl font-semibold tabular-nums">{rep.totals.campaigns}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-1">active {rep.totals.active} · completed {rep.totals.completed}</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Participants</p>
          <p className="text-xl font-semibold tabular-nums">{rep.totals.invited} invited / {rep.totals.accepted} accepted</p>
          <OpsConfidenceBadge kind="exact" className="mt-2" />
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Submissions</p>
          <p className="text-xl font-semibold tabular-nums">{rep.totals.submissions}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-1">approved {rep.totals.approved_submissions}</p>
        </div>
      </div>

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Derived rates</h2>
        <div className="grid sm:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[var(--crm-muted)] text-xs">Avg accepted per campaign</p>
            <p className="text-lg font-semibold tabular-nums">{avgCreators}</p>
            <OpsConfidenceBadge kind="proxy" className="mt-1" />
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs">Completed ÷ campaigns</p>
            <p className="text-lg font-semibold tabular-nums">{completionRate}</p>
            <OpsConfidenceBadge kind="proxy" className="mt-1" />
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs">Approved ÷ submissions</p>
            <p className="text-lg font-semibold tabular-nums">{approvalRate}</p>
            <OpsConfidenceBadge kind="proxy" className="mt-1" />
          </div>
        </div>
      </section>

      {rep.workspaces.length > 0 ? (
        <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Workspaces</h2>
          <ul className="text-sm text-[var(--crm-muted)] list-disc list-inside space-y-1">
            {rep.workspaces.map((w) => (
              <li key={w.id}>
                {w.name} <span className="font-mono text-xs">({w.slug ?? w.id.slice(0, 8)})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {rep.entitlements.length > 0 ? (
        <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Active org entitlements</h2>
          <OpsConfidenceBadge kind="exact" className="mb-2" />
          <ul className="text-xs space-y-2">
            {rep.entitlements.map((e) => (
              <li key={e.id} className="border-b border-[var(--crm-border)]/50 pb-2">
                <span className="font-mono">{e.kind}</span> · expires {e.expires_at}
                <span className="block text-[var(--crm-muted)]">{e.reason}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Campaigns</h2>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
          <table className="w-full text-sm min-w-[1000px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">Title</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2 text-right">Inv→Acc</th>
                <th className="py-2 pr-2 text-right">Submissions</th>
                <th className="py-2 pr-2">Budget / value</th>
                <th className="py-2">Drill-down</th>
              </tr>
            </thead>
            <tbody>
              {rep.campaigns.map((c) => (
                <tr key={c.id} className="border-b border-[var(--crm-border)]/60 align-top">
                  <td className="py-2 pr-2 max-w-[200px]">{c.title}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{c.status}</td>
                  <td className="py-2 pr-2 text-right text-xs tabular-nums">
                    {c.invited}/{c.accepted}
                  </td>
                  <td className="py-2 pr-2 text-right text-xs tabular-nums">
                    {c.submissions} (✓{c.approved_submissions})
                  </td>
                  <td className="py-2 pr-2 text-xs">
                    {c.budget != null ? (
                      <span className="block">
                        budget {c.budget} {c.currency ?? ""}{" "}
                        <span className="text-[10px] text-amber-800">(proxy)</span>
                      </span>
                    ) : (
                      <span className="block">—</span>
                    )}
                    {c.campaign_value_usd != null ? (
                      <span className="block text-[var(--crm-muted)] mt-1">
                        value_usd {c.campaign_value_usd}{" "}
                        <span className="text-[10px] text-amber-800">(proxy)</span>
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/ops/reports/campaigns/${c.id}`}
                      className="text-[var(--crm-primary)] text-xs font-medium underline-offset-2 hover:underline"
                    >
                      Campaign report
                    </Link>
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
