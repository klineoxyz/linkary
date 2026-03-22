import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOverviewStats } from "@/lib/opsData";

export default async function OpsOverviewPage() {
  const { service } = await assertOpsPageAccess();
  const stats = await fetchOpsOverviewStats(service);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Ops overview</h1>
        <p className="crm-page-subtitle">
          Live snapshot from Supabase (read-only). Use{" "}
          <Link href="/ops/reports" className="text-[var(--crm-primary)] font-medium underline-offset-2 hover:underline">
            Financial reports
          </Link>{" "}
          for ratios and business mix; use{" "}
          <Link href="/ops/actions" className="text-[var(--crm-primary)] font-medium underline-offset-2 hover:underline">
            Actions
          </Link>{" "}
          for audited writes.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="crm-surface-raised p-5 rounded-[var(--crm-radius)] border border-[var(--crm-border)] shadow-[var(--crm-shadow-sm)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Profiles</p>
          <p className="text-3xl font-semibold text-[var(--crm-foreground)] tabular-nums">{stats.profilesCount ?? "—"}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">All rows in public.profiles</p>
        </div>
        <div className="crm-surface-raised p-5 rounded-[var(--crm-radius)] border border-[var(--crm-border)] shadow-[var(--crm-shadow-sm)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">CRM campaigns</p>
          <p className="text-3xl font-semibold text-[var(--crm-foreground)] tabular-nums">{stats.campaignsCount ?? "—"}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">crm_campaigns total</p>
        </div>
        <div className="crm-surface-raised p-5 rounded-[var(--crm-radius)] border border-[var(--crm-border)] shadow-[var(--crm-shadow-sm)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Active ops members</p>
          <p className="text-3xl font-semibold text-[var(--crm-foreground)] tabular-nums">{stats.activeOpsMembersCount ?? "—"}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">internal_ops_members (not revoked)</p>
        </div>
      </div>

      <div className="crm-surface-raised p-5 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-1">Active personal subscriptions</h2>
        <p className="text-xs text-[var(--crm-muted)] mb-4">
          Grouped by <code className="text-[10px] bg-[var(--crm-accent)] px-1 rounded">plan_key</code> + legacy{" "}
          <code className="text-[10px] bg-[var(--crm-accent)] px-1 rounded">tier</code> (owner_type = profile, status = active).
        </p>
        {stats.subscriptionRows.length === 0 ? (
          <p className="text-sm text-[var(--crm-muted)]">No active profile subscription rows.</p>
        ) : (
          <div className="overflow-x-auto rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--crm-muted)] bg-[var(--crm-accent)]/40 border-b border-[var(--crm-border)]">
                  <th className="py-2.5 px-3 font-medium">plan_key</th>
                  <th className="py-2.5 px-3 font-medium">tier</th>
                  <th className="py-2.5 px-3 font-medium text-right">Count</th>
                </tr>
              </thead>
              <tbody>
                {stats.subscriptionRows.map((r, i) => (
                  <tr key={i} className="border-b border-[var(--crm-border)]/60 last:border-0 hover:bg-[var(--crm-accent)]/20">
                    <td className="py-2.5 px-3 font-mono text-xs">{r.plan_key ?? "null"}</td>
                    <td className="py-2.5 px-3 font-mono text-xs">{r.tier}</td>
                    <td className="py-2.5 px-3 text-right tabular-nums font-medium">{r.count}</td>
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
