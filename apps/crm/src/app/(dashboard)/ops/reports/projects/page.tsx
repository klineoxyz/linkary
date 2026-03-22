import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOrgProjectSummary } from "@/lib/opsData";

export default async function OpsReportsProjectsPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsOrgProjectSummary(service, 50);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Project reports</h1>
        <p className="crm-page-subtitle">
          Orgs ranked by number of linked campaigns (via workspace), using a capped campaign scan (4000 rows). Org plan from active org
          subscription — exact for those rows; orgs with no campaigns in the scan window do not appear.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-3">Org</th>
              <th className="py-2 pr-3">Slug</th>
              <th className="py-2 pr-3 text-right">Campaigns (in scan)</th>
              <th className="py-2">Org plan (active sub)</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-8 text-center text-[var(--crm-muted)] text-sm">
                  No org campaign aggregates (empty CRM or scan miss).
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.org_id} className="border-b border-[var(--crm-border)]/60">
                  <td className="py-2 pr-3">{r.name ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.slug ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.campaign_count}</td>
                  <td className="py-2 font-mono text-xs">{r.plan_key}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
