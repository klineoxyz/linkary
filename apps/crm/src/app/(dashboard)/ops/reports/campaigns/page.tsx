import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignKpiRows } from "@/lib/opsData";

function rate(num: number, den: number): string {
  if (den <= 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

export default async function OpsReportsCampaignsPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsCampaignKpiRows(service, 60);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Campaign reports</h1>
        <p className="crm-page-subtitle">
          Recent campaigns with invited / accepted / submission counts from relational tables. Rates are simple ratios on those counts —
          proxy for funnel health, not billing.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[960px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">Campaign</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2 text-right">Invited</th>
              <th className="py-2 pr-2 text-right">Accepted</th>
              <th className="py-2 pr-2 text-right">Submissions</th>
              <th className="py-2 pr-2 text-right">Approved</th>
              <th className="py-2 pr-2 text-right">Accept ÷ invite</th>
              <th className="py-2 text-right">Approve ÷ submit</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.campaign_id} className="border-b border-[var(--crm-border)]/60 align-top">
                <td className="py-2 pr-2 max-w-[200px]">{r.title}</td>
                <td className="py-2 pr-2 font-mono text-xs">{r.status}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.invited}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.accepted}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.submissions}</td>
                <td className="py-2 pr-2 text-right tabular-nums">{r.approved_submissions}</td>
                <td className="py-2 pr-2 text-right text-xs text-[var(--crm-muted)]">
                  {rate(r.accepted, r.invited)}
                  <span className="block text-[10px]">Proxy</span>
                </td>
                <td className="py-2 text-right text-xs text-[var(--crm-muted)]">
                  {rate(r.approved_submissions, r.submissions)}
                  <span className="block text-[10px]">Proxy</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
