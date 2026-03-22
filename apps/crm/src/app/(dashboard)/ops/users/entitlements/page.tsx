import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsActiveEntitlementsSample } from "@/lib/opsData";

export default async function OpsUsersEntitlementsPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsActiveEntitlementsSample(service, 100);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Active entitlements</h1>
        <p className="crm-page-subtitle">
          Sample of non-revoked, unexpired <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">platform_ops_entitlements</code>{" "}
          rows (ordered by soonest expiry). Exact for listed rows; not a full export.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">kind</th>
              <th className="py-2 pr-2">subject</th>
              <th className="py-2 pr-2">expires_at</th>
              <th className="py-2 pr-2">reason</th>
              <th className="py-2">created_at</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--crm-muted)]">
                  No active entitlement rows in sample.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--crm-border)]/60 align-top">
                  <td className="py-2 pr-2 font-mono text-xs">{r.kind}</td>
                  <td className="py-2 pr-2 text-xs">
                    {r.subject_type}
                    <span className="block font-mono text-[10px] text-[var(--crm-muted)]">{r.subject_id}</span>
                  </td>
                  <td className="py-2 pr-2 font-mono text-[10px] whitespace-nowrap">{r.expires_at}</td>
                  <td className="py-2 pr-2 text-xs max-w-[240px]">{r.reason}</td>
                  <td className="py-2 font-mono text-[10px] whitespace-nowrap">{r.created_at}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
