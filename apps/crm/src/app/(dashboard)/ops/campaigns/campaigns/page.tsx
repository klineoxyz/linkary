import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignRows } from "@/lib/opsData";

export default async function OpsCampaignsListPage() {
  const { service } = await assertOpsPageAccess();
  const campaigns = await fetchOpsCampaignRows(service, 80);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Campaigns</h1>
        <p className="crm-page-subtitle">
          Org plan_key from subscriptions where owner_type = org and owner_id = workspace.linked_org_id. Read-only.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">Title</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Workspace</th>
              <th className="py-2 pr-2">linked_org_id</th>
              <th className="py-2 pr-2">org plan_key</th>
              <th className="py-2">follow_rules (json)</th>
            </tr>
          </thead>
          <tbody>
            {campaigns.map((c) => (
              <tr key={c.id} className="border-b border-[var(--crm-border)]/60 align-top">
                <td className="py-2 pr-2 max-w-[180px]">{c.title}</td>
                <td className="py-2 pr-2 font-mono text-xs">{c.status}</td>
                <td className="py-2 pr-2 text-xs">
                  {c.workspace_name ?? "—"}
                  <span className="block text-[var(--crm-muted)]">{c.workspace_type}</span>
                </td>
                <td className="py-2 pr-2 font-mono text-[10px] break-all max-w-[100px]">{c.linked_org_id ?? "—"}</td>
                <td className="py-2 pr-2 font-mono text-xs">{c.org_plan_key}</td>
                <td className="py-2">
                  <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto bg-[var(--crm-banner-muted)] p-2 rounded">
                    {JSON.stringify(c.follow_rules ?? {}, null, 2)}
                  </pre>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
