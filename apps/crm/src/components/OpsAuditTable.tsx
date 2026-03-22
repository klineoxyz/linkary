import type { OpsAuditRow } from "@/lib/opsData";

export function OpsAuditTable({ rows }: { rows: OpsAuditRow[] }) {
  return (
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
                No audit rows in this view.
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
  );
}
