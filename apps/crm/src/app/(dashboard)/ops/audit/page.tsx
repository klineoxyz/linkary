import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsAuditRows } from "@/lib/opsData";

export default async function OpsAuditPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsAuditRows(service, 100);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Platform audit log</h1>
        <p className="crm-page-subtitle">Read-only `platform_audit_log`. Newest first.</p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">created_at</th>
              <th className="py-2 pr-2">action</th>
              <th className="py-2 pr-2">target</th>
              <th className="py-2 pr-2">actor</th>
              <th className="py-2">payload</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-[var(--crm-muted)] text-sm">
                  No audit rows yet.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-[var(--crm-border)]/60 align-top">
                  <td className="py-2 pr-2 font-mono text-[10px] whitespace-nowrap">{r.created_at}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{r.action}</td>
                  <td className="py-2 pr-2 text-xs">
                    {r.target_type}
                    <span className="block font-mono text-[10px] text-[var(--crm-muted)]">{r.target_id ?? "—"}</span>
                  </td>
                  <td className="py-2 pr-2 font-mono text-[10px] break-all max-w-[100px]">{r.actor_user_id}</td>
                  <td className="py-2">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-36 overflow-y-auto bg-[var(--crm-banner-muted)] p-2 rounded">
                      {JSON.stringify(r.payload_json ?? {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
