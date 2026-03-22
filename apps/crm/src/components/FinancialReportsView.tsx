import type { OpsFinancialReport } from "@/lib/opsData";

function pct(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}

function CountCard({
  label,
  value,
  confidence,
}: {
  label: string;
  value: number | null;
  confidence: string;
}) {
  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
      <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide mb-1">{label}</p>
      <p className="text-2xl font-semibold text-[var(--crm-foreground)] tabular-nums">{value ?? "—"}</p>
      <p className="text-[10px] text-[var(--crm-muted)] mt-1 capitalize">{confidence}</p>
    </div>
  );
}

function RatioCard({
  label,
  value,
  note,
}: {
  label: string;
  value: number | null;
  note: string;
}) {
  return (
    <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-amber-500/25 bg-amber-500/5">
      <p className="text-xs font-medium text-[var(--crm-foreground)] mb-1">{label}</p>
      <p className="text-xl font-semibold text-[var(--crm-foreground)] tabular-nums">{pct(value)}</p>
      <p className="text-[10px] text-[var(--crm-muted)] mt-2 leading-snug">{note}</p>
      <p className="text-[10px] text-amber-800/90 mt-1 font-medium">Proxy — not revenue or billing truth</p>
    </div>
  );
}

export function FinancialReportsView({
  report,
  embedded = false,
}: {
  report: OpsFinancialReport;
  /** When true, omit page-level header (parent route supplies section title). */
  embedded?: boolean;
}) {
  const { counts, personalSubscriptions, orgSubscriptions, ratios, disclaimers, generatedAt } = report;

  return (
    <div className="space-y-8">
      {!embedded ? (
        <header className="crm-page-header">
          <h1 className="crm-page-title">Financial &amp; business reports</h1>
          <p className="crm-page-subtitle">
            Snapshot from Supabase only. Dollar MRR / ARPU / Stripe revenue are{" "}
            <strong className="text-[var(--crm-foreground)]">not</strong> available in-schema — use ratios and counts as
            operational signals.
          </p>
          <p className="text-xs text-[var(--crm-muted)] mt-1">Generated {new Date(generatedAt).toLocaleString()}</p>
        </header>
      ) : (
        <p className="text-xs text-[var(--crm-muted)]">Generated {new Date(generatedAt).toLocaleString()}</p>
      )}

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-red-500/20 bg-red-500/5 space-y-2">
        <p className="text-sm font-medium text-[var(--crm-foreground)]">Important limitations</p>
        <ul className="text-xs text-[var(--crm-muted)] list-disc list-inside space-y-1">
          {disclaimers.map((d) => (
            <li key={d}>{d}</li>
          ))}
        </ul>
      </div>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Platform snapshot (exact counts)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CountCard label="Total profiles" value={counts.profilesTotal.value} confidence={counts.profilesTotal.confidence} />
          <CountCard label="Total orgs" value={counts.orgsTotal.value} confidence={counts.orgsTotal.confidence} />
          <CountCard label="CRM workspaces" value={counts.crmWorkspacesTotal.value} confidence={counts.crmWorkspacesTotal.confidence} />
          <CountCard label="CRM campaigns (all)" value={counts.crmCampaignsTotal.value} confidence={counts.crmCampaignsTotal.confidence} />
          <CountCard label="Active campaigns" value={counts.crmCampaignsActive.value} confidence={counts.crmCampaignsActive.confidence} />
          <CountCard
            label="Campaign participant rows"
            value={counts.campaignParticipantRows.value}
            confidence={counts.campaignParticipantRows.confidence}
          />
          <CountCard label="Active ops members" value={counts.activeOpsMembers.value} confidence={counts.activeOpsMembers.confidence} />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Personal subscriptions (active)</h3>
          <p className="text-xs text-[var(--crm-muted)] mb-3">
            Rows: {personalSubscriptions.activeRows} · Unique profiles: {personalSubscriptions.uniqueProfilesWithPersonalSub} ·
            Paying (non-free plan): {personalSubscriptions.payingProfiles} · Free plan: {personalSubscriptions.freePlanProfiles}
          </p>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
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
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Org subscriptions (active)</h3>
          <p className="text-xs text-[var(--crm-muted)] mb-3">
            Rows: {orgSubscriptions.activeRows} · Unique orgs: {orgSubscriptions.uniqueOrgsWithSub} · Paying:{" "}
            {orgSubscriptions.payingOrgs} · Free plan: {orgSubscriptions.freePlanOrgs}
          </p>
          <div className="overflow-x-auto max-h-48 overflow-y-auto">
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
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Ratios &amp; mix (proxy)</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <RatioCard
            label="Profile → paid (personal sub, non-free plan)"
            value={ratios.profileToPaidConversion.value}
            note={ratios.profileToPaidConversion.note}
          />
          <RatioCard label="Org → paid (active org sub, non-free plan)" value={ratios.orgToPaidConversion.value} note={ratios.orgToPaidConversion.note} />
          <RatioCard label="Free vs paid (personal subs only)" value={ratios.freeToPaidProfiles.value} note={ratios.freeToPaidProfiles.note} />
          <RatioCard label="Campaigns per org (rough)" value={ratios.campaignsPerOrg.value} note={ratios.campaignsPerOrg.note} />
          <RatioCard
            label="Participant rows per campaign"
            value={ratios.participantRowsPerCampaign.value}
            note={ratios.participantRowsPerCampaign.note}
          />
        </div>
      </section>

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] border-dashed">
        <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Not computed (requires external billing)</h3>
        <ul className="text-xs text-[var(--crm-muted)] list-disc list-inside space-y-1">
          <li>Settled revenue, recognized MRR, ARPU in dollars</li>
          <li>Historical growth curves (no time-series snapshot table in this pass)</li>
          <li>Distinct creator count across campaigns (only participant row totals)</li>
        </ul>
      </section>
    </div>
  );
}
