import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsEntitlementUsageReport } from "@/lib/opsData";

export default async function OpsReportsDiscountsPage() {
  const { service } = await assertOpsPageAccess();
  const report = await fetchOpsEntitlementUsageReport(service);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Discount / comp usage</h1>
        <p className="crm-page-subtitle">
          Active rows in <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">platform_ops_entitlements</code> (not revoked,
          not expired) and recent revocations. Exact for row counts; audit trail for actor attribution lives in{" "}
          <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">platform_audit_log</code>.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Active comp_grant</p>
          <p className="text-2xl font-semibold tabular-nums">{report.activeByKind.comp_grant}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">Exact</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Active discount_metadata</p>
          <p className="text-2xl font-semibold tabular-nums">{report.activeByKind.discount_metadata}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">Exact</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Active plan_override</p>
          <p className="text-2xl font-semibold tabular-nums">{report.activeByKind.plan_override}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">Exact</p>
        </div>
      </div>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Recently revoked (sample)</h2>
        <p className="text-[10px] text-[var(--crm-muted)] mb-3">Exact rows — limited to 40 newest by revoked_at.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">kind</th>
                <th className="py-2 pr-2">subject</th>
                <th className="py-2 pr-2">revoked_at</th>
                <th className="py-2">expires_at</th>
              </tr>
            </thead>
            <tbody>
              {report.recentlyRevoked.length === 0 ? (
                <tr>
                  <td colSpan={4} className="py-6 text-center text-[var(--crm-muted)]">
                    No revoked rows sampled.
                  </td>
                </tr>
              ) : (
                report.recentlyRevoked.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--crm-border)]/60">
                    <td className="py-2 pr-2 font-mono text-xs">{row.kind}</td>
                    <td className="py-2 pr-2 text-xs">
                      {row.subject_type}
                      <span className="block font-mono text-[10px] text-[var(--crm-muted)]">{row.subject_id}</span>
                    </td>
                    <td className="py-2 pr-2 font-mono text-[10px] whitespace-nowrap">{row.revoked_at ?? "—"}</td>
                    <td className="py-2 font-mono text-[10px] whitespace-nowrap">{row.expires_at}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
