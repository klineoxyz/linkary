import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsUserRows } from "@/lib/opsData";

function displayHandle(username: string | null): string {
  if (!username?.trim()) return "—";
  const u = username.replace(/^@/, "");
  return `@${u}`;
}

export default async function OpsUsersProfilesPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsUserRows(service, 100);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Profiles</h1>
        <p className="crm-page-subtitle">
          Profile subscription fields only (no org uplift). Read-only. PII: handle ops access carefully — primary column is handle, not raw
          id.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-3">Handle</th>
              <th className="py-2 pr-3">Display</th>
              <th className="py-2 pr-3">Email</th>
              <th className="py-2 pr-3">plan_key</th>
              <th className="py-2 pr-3">tier</th>
              <th className="py-2 pr-3">sub status</th>
              <th className="py-2">Profile id</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.profile_id} className="border-b border-[var(--crm-border)]/60 align-top">
                <td className="py-2 pr-3 font-medium">{displayHandle(r.username)}</td>
                <td className="py-2 pr-3">{r.display_name ?? "—"}</td>
                <td className="py-2 pr-3 text-xs">{r.email ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.plan_key ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.tier ?? "—"}</td>
                <td className="py-2 pr-3 font-mono text-xs">{r.subscription_status ?? "—"}</td>
                <td className="py-2 font-mono text-[10px] text-[var(--crm-muted)] break-all max-w-[120px]">{r.profile_id}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
