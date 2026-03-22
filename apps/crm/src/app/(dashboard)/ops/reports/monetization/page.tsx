import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsFinancialReport } from "@/lib/opsData";
import { fetchOpsCampaignBudgetRollup } from "@/lib/opsReporting";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

export default async function OpsReportsMonetizationPage() {
  const { service } = await assertOpsPageAccess();
  const [report, budget] = await Promise.all([fetchOpsFinancialReport(service), fetchOpsCampaignBudgetRollup(service)]);

  const { personalSubscriptions, orgSubscriptions, ratios } = report;

  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Subscription &amp; monetization</h1>
        <p className="crm-page-subtitle">
          Plan mix from active <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">subscriptions</code> rows. MRR / ARPU dollars
          and Stripe settlement — not computed.
        </p>
      </header>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-amber-500/30 bg-amber-500/5">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Campaign budget field</h2>
          <OpsConfidenceBadge kind="proxy" />
        </div>
        <p className="text-xs text-[var(--crm-muted)] mb-3">{budget.currencyNote}</p>
        <div className="grid sm:grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-[var(--crm-muted)] text-xs uppercase tracking-wide">Rows with budget</p>
            <p className="text-xl font-semibold tabular-nums">{budget.rowsWithBudget}</p>
            <OpsConfidenceBadge kind="exact" className="mt-2" />
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs uppercase tracking-wide">Numeric sum (display USD label)</p>
            <p className="text-xl font-semibold tabular-nums">
              {budget.sumBudgetNumeric > 0 ? budget.sumBudgetNumeric.toFixed(2) : "—"}
            </p>
            <OpsConfidenceBadge kind="proxy" className="mt-2" />
          </div>
          <div>
            <p className="text-[var(--crm-muted)] text-xs uppercase tracking-wide">Scan</p>
            <p className="text-sm tabular-nums">
              {budget.scanned} rows read
              {budget.truncated ? " — truncated at safety cap" : ""}
            </p>
            <OpsConfidenceBadge kind={budget.truncated ? "estimated" : "exact"} className="mt-2" />
          </div>
        </div>
      </div>

      <section className="grid gap-4 lg:grid-cols-3">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] lg:col-span-3">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Conversion-style ratios (personal subs)</h2>
            <OpsConfidenceBadge kind="proxy" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
            <div>
              <p className="text-[var(--crm-muted)] text-xs">Profile → paid</p>
              <p className="text-lg font-semibold tabular-nums">
                {ratios.profileToPaidConversion.value != null
                  ? `${(ratios.profileToPaidConversion.value * 100).toFixed(1)}%`
                  : "—"}
              </p>
              <p className="text-[10px] text-[var(--crm-muted)] mt-1">{ratios.profileToPaidConversion.note}</p>
            </div>
            <div>
              <p className="text-[var(--crm-muted)] text-xs">Org → paid</p>
              <p className="text-lg font-semibold tabular-nums">
                {ratios.orgToPaidConversion.value != null ? `${(ratios.orgToPaidConversion.value * 100).toFixed(1)}%` : "—"}
              </p>
              <p className="text-[10px] text-[var(--crm-muted)] mt-1">{ratios.orgToPaidConversion.note}</p>
            </div>
            <div>
              <p className="text-[var(--crm-muted)] text-xs">Free vs paid (personal sub rows)</p>
              <p className="text-lg font-semibold tabular-nums">
                {ratios.freeToPaidProfiles.value != null ? `${(ratios.freeToPaidProfiles.value * 100).toFixed(1)}%` : "—"}
              </p>
              <p className="text-[10px] text-[var(--crm-muted)] mt-1">{ratios.freeToPaidProfiles.note}</p>
            </div>
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Personal subscriptions (active)</h2>
            <OpsConfidenceBadge kind="exact" />
          </div>
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
          <div className="flex items-center gap-2 mb-2">
            <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Org subscriptions (active)</h2>
            <OpsConfidenceBadge kind="exact" />
          </div>
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
