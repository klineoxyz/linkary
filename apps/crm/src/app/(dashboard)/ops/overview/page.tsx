import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOverviewStats } from "@/lib/opsData";

export default async function OpsOverviewPage() {
  const { service } = await assertOpsPageAccess();
  const stats = await fetchOpsOverviewStats(service);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Overview</h1>
        <p className="crm-page-subtitle">Read-only counts (service role). No writes.</p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Profiles</p>
          <p className="text-2xl font-semibold text-[var(--crm-foreground)]">{stats.profilesCount ?? "—"}</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">CRM campaigns</p>
          <p className="text-2xl font-semibold text-[var(--crm-foreground)]">{stats.campaignsCount ?? "—"}</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Active ops members</p>
          <p className="text-2xl font-semibold text-[var(--crm-foreground)]">{stats.activeOpsMembersCount ?? "—"}</p>
        </div>
      </div>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Active profile subscriptions (by plan_key + tier)</h2>
        <p className="text-xs text-[var(--crm-muted)] mb-3">Personal subscriptions only (owner_type = profile).</p>
        {stats.subscriptionRows.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)]">No rows returned.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                  <th className="py-2 pr-4">plan_key</th>
                  <th className="py-2 pr-4">tier</th>
                  <th className="py-2">count</th>
                </tr>
              </thead>
              <tbody>
                {stats.subscriptionRows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--crm-border)]/60">
                    <td className="py-2 pr-4 font-mono text-xs">{r.plan_key ?? "null"}</td>
                    <td className="py-2 pr-4 font-mono text-xs">{r.tier}</td>
                    <td className="py-2">{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
