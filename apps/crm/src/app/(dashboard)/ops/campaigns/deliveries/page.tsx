import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsRecentSubmissionsEnriched } from "@/lib/opsData";

export default async function OpsCampaignsDeliveriesPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsRecentSubmissionsEnriched(service, 80);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Deliveries</h1>
        <p className="crm-page-subtitle">
          Recent <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">crm_submissions</code> rows (exact). Creative payload /
          asset URLs are not expanded in this view.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">Campaign</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Participant</th>
              <th className="py-2 pr-2">created_at</th>
              <th className="py-2">submission id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-[var(--crm-border)]/60 align-top">
                <td className="py-2 pr-2 max-w-[200px]">{r.campaign_title ?? r.campaign_id}</td>
                <td className="py-2 pr-2 font-mono text-xs">{r.status}</td>
                <td className="py-2 pr-2 font-mono text-[10px] break-all max-w-[120px]">{r.participant_profile_id}</td>
                <td className="py-2 pr-2 font-mono text-[10px] whitespace-nowrap">{r.created_at}</td>
                <td className="py-2 font-mono text-[10px] text-[var(--crm-muted)] break-all max-w-[100px]">{r.id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
