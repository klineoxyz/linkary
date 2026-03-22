import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOrgRows } from "@/lib/opsData";

export default async function OpsUsersOrgsPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsOrgRows(service, 120);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Orgs</h1>
        <p className="crm-page-subtitle">
          Recent orgs with active subscription plan resolution (exact for matching subscription rows). Slug/name are human-readable
          anchors; org id is secondary.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-3">Name</th>
              <th className="py-2 pr-3">Slug</th>
              <th className="py-2 pr-3">plan_key</th>
              <th className="py-2 pr-3">sub status</th>
              <th className="py-2 pr-3">created</th>
              <th className="py-2">Org id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.org_id} className="border-b border-[var(--crm-border)]/60 align-top">
                <td className="py-2 pr-3 font-medium">{r.name ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.slug ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.plan_key}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.subscription_status ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-[10px] whitespace-nowrap">{r.created_at ?? "—"}</td>
                <td className="py-2 font-mono text-[10px] text-[var(--crm-muted)] break-all max-w-[120px]">{r.org_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
