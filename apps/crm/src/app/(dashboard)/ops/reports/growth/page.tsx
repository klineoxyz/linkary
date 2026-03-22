import { assertOpsPageAccess } from "@/lib/opsAccess";
import {
  fetchOpsCampaignStatusCounts,
  fetchOpsCreatorsProfileCount,
  fetchOpsGrowthMetrics,
  fetchOpsParticipantStatusCounts,
  fetchOpsSubmissionStatusCounts,
} from "@/lib/opsData";
import { fetchOpsGrowthInWindow } from "@/lib/opsReporting";
import { parseOpsDateRangeExplicit } from "@/lib/opsReportParams";
import { OpsReportFilterForm } from "@/components/OpsReportFilterForm";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function Card({
  label,
  value,
  confidence,
}: {
  label: string;
  value: string | number | null;
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

function StatusTable({ title, counts }: { title: string; counts: Record<string, number> }) {
  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">{title}</h2>
        <OpsConfidenceBadge kind="exact" />
      </div>
      <table className="w-full text-sm">
        <tbody>
          {Object.entries(counts).map(([k, v]) => (
            <tr key={k} className="border-b border-[var(--crm-border)]/50">
              <td className="py-2 font-mono text-xs">{k}</td>
              <td className="py-2 text-right tabular-nums">{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function OpsReportsGrowthPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await assertOpsPageAccess();
  const sp = new URLSearchParams();
  const raw = await searchParams;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") sp.set(k, v);
  }
  const explicitRange = parseOpsDateRangeExplicit(sp);
  const windowCounts =
    explicitRange?.fromIso && explicitRange?.toIso
      ? await fetchOpsGrowthInWindow(service, explicitRange.fromIso, explicitRange.toIso)
      : null;

  const [
    growth,
    subCounts,
    campCounts,
    partCounts,
    creatorsCount,
    { count: submissionsTotal },
    { count: profilesTotal },
  ] = await Promise.all([
    fetchOpsGrowthMetrics(service),
    fetchOpsSubmissionStatusCounts(service),
    fetchOpsCampaignStatusCounts(service),
    fetchOpsParticipantStatusCounts(service),
    fetchOpsCreatorsProfileCount(service),
    service.from("crm_submissions").select("*", { count: "exact", head: true }),
    service.from("profiles").select("*", { count: "exact", head: true }),
  ]);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Platform growth</h1>
        <p className="crm-page-subtitle">
          Fixed 7d/30d windows plus optional custom <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">created_at</code> range
          (profiles, orgs, campaigns, workspaces, submissions). No Stripe cash series — not computed.
        </p>
        <p className="text-xs text-[var(--crm-muted)] mt-1">Rolling snapshot as of {new Date(growth.generatedAt).toLocaleString()}</p>
      </header>

      <OpsReportFilterForm
        fields={[
          { type: "date", name: "from", label: "From (UTC date)" },
          { type: "date", name: "to", label: "To (UTC date)" },
        ]}
      />
      {windowCounts && explicitRange?.fromIso ? (
        <section>
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">New in selected window</h2>
          <p className="text-[10px] text-[var(--crm-muted)] mb-3">
            Exact — filtered by <code className="text-[10px]">created_at</code> between query bounds.
          </p>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <Card label="New profiles" value={windowCounts.profilesNew} confidence="exact" />
            <Card label="New orgs" value={windowCounts.orgsNew} confidence="exact" />
            <Card label="New campaigns" value={windowCounts.campaignsNew} confidence="exact" />
            <Card label="New workspaces" value={windowCounts.workspacesNew} confidence="exact" />
            <Card label="New submissions" value={windowCounts.submissionsNew} confidence="exact" />
          </div>
        </section>
      ) : null}

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Rolling new signups (7d / 30d)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="New profiles (7d)" value={growth.profilesNew7d} confidence="exact" />
          <Card label="New profiles (30d)" value={growth.profilesNew30d} confidence="exact" />
          <Card label="New orgs (7d)" value={growth.orgsNew7d} confidence="exact" />
          <Card label="New orgs (30d)" value={growth.orgsNew30d} confidence="exact" />
          <Card label="New campaigns (7d)" value={growth.campaignsNew7d} confidence="exact" />
          <Card label="New campaigns (30d)" value={growth.campaignsNew30d} confidence="exact" />
          <Card label="New workspaces (30d)" value={growth.workspacesNew30d} confidence="exact" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Stock totals</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Total profiles" value={profilesTotal} confidence="exact" />
          <Card label="Profiles individual" value={creatorsCount} confidence="exact" />
          <Card label="Total submissions" value={submissionsTotal} confidence="exact" />
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusTable title="Submissions by status" counts={subCounts} />
        <StatusTable title="Campaigns by status" counts={campCounts} />
        <StatusTable title="Participants by status" counts={partCounts} />
      </div>
    </div>
  );
}
