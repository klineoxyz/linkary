import { assertOpsPageAccess } from "@/lib/opsAccess";
import {
  fetchOpsCampaignStatusCounts,
  fetchOpsCreatorsProfileCount,
  fetchOpsGrowthMetrics,
  fetchOpsParticipantStatusCounts,
  fetchOpsSubmissionStatusCounts,
} from "@/lib/opsData";

function Card({
  label,
  value,
  kind,
}: {
  label: string;
  value: string | number | null;
  kind: "exact" | "proxy" | "not_computed";
}) {
  const kindLabel =
    kind === "exact" ? "Exact" : kind === "proxy" ? "Proxy / operational" : "Not computed";
  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
      <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold tabular-nums text-[var(--crm-foreground)]">{value ?? "—"}</p>
      <p className="text-[10px] text-[var(--crm-muted)] mt-2">{kindLabel}</p>
    </div>
  );
}

function StatusTable({ title, counts }: { title: string; counts: Record<string, number> }) {
  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
      <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">{title}</h2>
      <p className="text-[10px] text-[var(--crm-muted)] mb-3">Exact — row counts by status field.</p>
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

export default async function OpsReportsGrowthPage() {
  const { service } = await assertOpsPageAccess();
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
          New entities by <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">created_at</code> window. No Stripe or cash
          series — not computed.
        </p>
        <p className="text-xs text-[var(--crm-muted)] mt-1">As of {new Date(growth.generatedAt).toLocaleString()}</p>
      </header>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">New signups &amp; objects</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card label="New profiles (7d)" value={growth.profilesNew7d} kind="exact" />
          <Card label="New profiles (30d)" value={growth.profilesNew30d} kind="exact" />
          <Card label="New orgs (7d)" value={growth.orgsNew7d} kind="exact" />
          <Card label="New orgs (30d)" value={growth.orgsNew30d} kind="exact" />
          <Card label="New campaigns (7d)" value={growth.campaignsNew7d} kind="exact" />
          <Card label="New campaigns (30d)" value={growth.campaignsNew30d} kind="exact" />
          <Card label="New workspaces (30d)" value={growth.workspacesNew30d} kind="exact" />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Stock totals (exact)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card label="Total profiles" value={profilesTotal} kind="exact" />
          <Card
            label="Profiles with profile_type = individual"
            value={creatorsCount}
            kind="exact"
          />
          <Card label="Total submissions (all statuses)" value={submissionsTotal} kind="exact" />
        </div>
        <p className="text-xs text-[var(--crm-muted)] mt-3 max-w-3xl">
          &quot;Creators&quot; here is the count of profiles marked <code className="text-[10px]">individual</code> — not distinct campaign
          participants across campaigns.
        </p>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <StatusTable title="Submissions by status" counts={subCounts} />
        <StatusTable title="Campaigns by status" counts={campCounts} />
        <StatusTable title="Participants by status" counts={partCounts} />
      </div>
    </div>
  );
}
