import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignBudgetProxy, fetchOpsFinancialReport } from "@/lib/opsData";

export default async function OpsReportsMonetizationPage() {
  const { service } = await assertOpsPageAccess();
  const [report, budget] = await Promise.all([fetchOpsFinancialReport(service), fetchOpsCampaignBudgetProxy(service)]);

  const { personalSubscriptions, orgSubscriptions } = report;

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Subscription &amp; monetization</h1>
        <p className="crm-page-subtitle">
          Plan mix from active <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">subscriptions</code> rows only. No MRR dollars,
          no Stripe cash, no tax — not available in-schema.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-amber-500/30 bg-amber-500/5">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Campaign budget field (proxy)</h2>
        <p className="text-xs text-[var(--crm-muted)] mb-3">{budget.note}</p>
        <div className="grid sm:grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-[var(--crm-muted)] text-xs uppercase tracking-wide">Rows scanned (cap 5000)</p>
            <p className="text-xl font-semibold tabular-nums">{budget.campaignsWithBudgetCount ?? "—"}</p>
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs uppercase tracking-wide">Sum of budget values (display-only USD label)</p>
            <p className="text-xl font-semibold tabular-nums">
              {budget.budgetSumUsdProxy != null ? budget.budgetSumUsdProxy.toFixed(2) : "—"}
            </p>
          </div>
        </div>
        <p className="text-[10px] text-amber-900/90 mt-3 font-medium">Proxy — not payout, not accounts payable, not revenue.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Personal subscriptions (active)</h2>
          <p className="text-[10px] text-[var(--crm-muted)] mb-3">Exact — same semantics as platform snapshot.</p>
          <p className="text-xs text-[var(--crm-muted)] mb-3">
            Paying profiles: {personalSubscriptions.payingProfiles} · Free plan: {personalSubscriptions.freePlanProfiles}
          </p>
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                  <th className="py-1.5 pr-2">plan_key</th>
                  <th className="py-1.5">count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(personalSubscriptions.byPlanKey).map(([k, v]) => (
                  <tr key={k} className="border-b border-[var(--crm-border)]/50">
                    <td className="py-1.5 pr-2 font-mono">{k}</td>
                    <td className="py-1.5 tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Org subscriptions (active)</h2>
          <p className="text-[10px] text-[var(--crm-muted)] mb-3">Exact — same semantics as platform snapshot.</p>
          <p className="text-xs text-[var(--crm-muted)] mb-3">
            Paying orgs: {orgSubscriptions.payingOrgs} · Free plan: {orgSubscriptions.freePlanOrgs}
          </p>
          <div className="overflow-x-auto max-h-56 overflow-y-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                  <th className="py-1.5 pr-2">plan_key</th>
                  <th className="py-1.5">count</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(orgSubscriptions.byPlanKey).map(([k, v]) => (
                  <tr key={k} className="border-b border-[var(--crm-border)]/50">
                    <td className="py-1.5 pr-2 font-mono">{k}</td>
                    <td className="py-1.5 tabular-nums">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
