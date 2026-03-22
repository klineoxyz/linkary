import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsPlanDistribution } from "@/lib/opsData";

export default async function OpsUsersPlanDistributionPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsPlanDistribution(service);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Plan distribution</h1>
        <p className="crm-page-subtitle">
          Exact — active subscription rows grouped by resolved <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">plan_key</code>{" "}
          (profile vs org owners). Multiple rows per owner are counted separately.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[480px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-3">Owner type</th>
              <th className="py-2 pr-3">plan_key</th>
              <th className="py-2 text-right">Active rows</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.owner_type}-${r.plan_key}-${i}`} className="border-b border-[var(--crm-border)]/60">
                <td className="py-2 pr-3 font-mono text-xs">{r.owner_type}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.plan_key}</td>
                <td className="py-2 text-right tabular-nums">{r.subscription_rows}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
