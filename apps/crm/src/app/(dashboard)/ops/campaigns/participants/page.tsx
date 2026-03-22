import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsParticipantRows } from "@/lib/opsData";

export default async function OpsCampaignsParticipantsPage() {
  const { service } = await assertOpsPageAccess();
  const participants = await fetchOpsParticipantRows(service, 80);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Participants</h1>
        <p className="crm-page-subtitle">Recent participant rows with invitation time. Read-only.</p>
      </header>

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
    </div>
  );
}
