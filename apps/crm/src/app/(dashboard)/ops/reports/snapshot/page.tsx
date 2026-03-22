import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsFinancialReport } from "@/lib/opsData";
import { FinancialReportsView } from "@/components/FinancialReportsView";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";
import { fetchOpsCreatorsProfileCount } from "@/lib/opsData";
import { fetchOpsPlatformExtraCounts } from "@/lib/opsReporting";

function SnapCard({
  label,
  value,
  confidence,
}: {
  label: string;
  value: number | null;
  confidence: "exact" | "proxy" | "estimated" | "not_computed";
}) {
  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
      <div className="flex items-center justify-between gap-2 mb-1">
        <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide">{label}</p>
        <OpsConfidenceBadge kind={confidence} />
      </div>
      <p className="text-2xl font-semibold tabular-nums text-[var(--crm-foreground)]">{value ?? "—"}</p>
    </div>
  );
}

export default async function OpsReportsSnapshotPage() {
  const { service } = await assertOpsPageAccess();
  const [report, extra, creatorsCount] = await Promise.all([
    fetchOpsFinancialReport(service),
    fetchOpsPlatformExtraCounts(service),
    fetchOpsCreatorsProfileCount(service),
  ]);

  return (
    <div className="space-y-6">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-title">Platform snapshot</h1>
          <p className="crm-page-subtitle">
            Full in-DB counts from subscriptions and CRM. Ratios in the detailed block below are proxy; Stripe / dollar MRR are not
            computed.
          </p>
        </div>
        <a
          href="/api/ops/export/platform"
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Download CSV
        </a>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Extended platform counts</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SnapCard label="Workspaces" value={extra.workspacesTotal} confidence="exact" />
          <SnapCard label="Campaigns completed" value={extra.campaignsCompleted} confidence="exact" />
          <SnapCard label="Submissions (all)" value={extra.submissionsTotal} confidence="exact" />
          <SnapCard label="Submissions approved" value={extra.submissionsApproved} confidence="exact" />
          <SnapCard label="Submissions rejected" value={extra.submissionsRejected} confidence="exact" />
          <SnapCard label="Submissions needs_revision" value={extra.submissionsNeedsRevision} confidence="exact" />
          <SnapCard label="Submissions pending" value={extra.submissionsPending} confidence="exact" />
          <SnapCard label="Profiles (individual)" value={creatorsCount} confidence="exact" />
        </div>
        <p className="text-xs text-[var(--crm-muted)] mt-3">
          “Creators” = <code className="text-[10px]">profiles.profile_type = individual</code> — not deduped participants.{" "}
          <Link href="/ops/reports/creators" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
            Creator report
          </Link>
        </p>
      </section>

      <FinancialReportsView report={report} embedded />
    </div>
  );
}
