import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOverviewStats } from "@/lib/opsData";

export default async function OpsOverviewHealthPage() {
  const { service } = await assertOpsPageAccess();
  const stats = await fetchOpsOverviewStats(service);

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Ops health</h1>
        <p className="crm-page-subtitle">
          Lightweight read-only signals. This is not application uptime monitoring — only Supabase row counts available to the CRM
          service role.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Data plane</p>
          <p className="text-sm text-[var(--crm-foreground)]">
            If this page loads, session + ops membership + service role reads succeeded for this request.
          </p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Profiles (exact)</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.profilesCount ?? "—"}</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">Ops members (exact)</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.activeOpsMembersCount ?? "—"}</p>
          <p className="text-[10px] text-[var(--crm-muted)] mt-2">
            Review membership in{" "}
            <Link href="/ops/audit/platform" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
              Audit log
            </Link>{" "}
            after entitlement changes.
          </p>
        </div>
      </div>
    </div>
  );
}
