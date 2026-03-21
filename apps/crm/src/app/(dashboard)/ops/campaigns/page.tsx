import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignRows, fetchOpsParticipantRows } from "@/lib/opsData";

export default async function OpsCampaignsPage() {
  const { service } = await assertOpsPageAccess();
  const [campaigns, participants] = await Promise.all([
    fetchOpsCampaignRows(service, 80),
    fetchOpsParticipantRows(service, 60),
  ]);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Campaigns & participants</h1>
        <p className="crm-page-subtitle">
          Org plan_key from subscriptions where owner_type = org and owner_id = workspace.linked_org_id. Read-only.
        </p>
      </header>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Campaigns</h2>
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
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Participants (recent)</h2>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
          <table className="w-full text-sm min-w-[960px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">Campaign</th>
                <th className="py-2 pr-2">Participant</th>
                <th className="py-2 pr-2">Status</th>
                <th className="py-2 pr-2">attestation</th>
                <th className="py-2">verification</th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => (
                <tr key={p.id} className="border-b border-[var(--crm-border)]/60 align-top">
                  <td className="py-2 pr-2 max-w-[160px]">{p.campaign_title ?? p.campaign_id}</td>
                  <td className="py-2 pr-2 font-mono text-[10px] break-all max-w-[120px]">{p.participant_profile_id}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{p.status}</td>
                  <td className="py-2 pr-2">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-28 overflow-y-auto bg-[var(--crm-banner-muted)] p-2 rounded">
                      {JSON.stringify(p.x_follow_attestation ?? {}, null, 2)}
                    </pre>
                  </td>
                  <td className="py-2">
                    <pre className="text-[10px] font-mono whitespace-pre-wrap break-all max-h-28 overflow-y-auto bg-[var(--crm-banner-muted)] p-2 rounded">
                      {JSON.stringify(p.x_follow_verification ?? {}, null, 2)}
                    </pre>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
