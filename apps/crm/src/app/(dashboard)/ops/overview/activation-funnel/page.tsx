import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchActivationFunnelInsights, type ActivationFunnelRow } from "@/lib/opsData";

function parseDays(raw: string | undefined): number {
  const n = Number(raw ?? "30");
  if (!Number.isFinite(n)) return 30;
  return Math.min(90, Math.max(1, Math.floor(n)));
}

export default async function OpsActivationFunnelPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await assertOpsPageAccess();
  const sp = (await searchParams) ?? {};
  const daysRaw = typeof sp.days === "string" ? sp.days : Array.isArray(sp.days) ? sp.days[0] : undefined;
  const days = parseDays(daysRaw);
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();
  const insights = await fetchActivationFunnelInsights(service, since);

  function renderFunnelRows(rows: ActivationFunnelRow[]) {
    return (
      <table className="w-full min-w-[680px] text-sm">
        <thead>
          <tr className="border-b border-[var(--crm-border)] text-left text-[var(--crm-muted)]">
            <th className="py-2 pr-3">Step</th>
            <th className="py-2 pr-3 text-right">Distinct users</th>
            <th className="py-2 pr-3 text-right">Total events</th>
            <th className="py-2 pr-3 text-right">Conversion from previous</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.step} className="border-b border-[var(--crm-border)]/60 last:border-0">
              <td className="py-2 pr-3 font-mono text-xs">{r.step}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.users.toLocaleString()}</td>
              <td className="py-2 pr-3 text-right tabular-nums">{r.events.toLocaleString()}</td>
              <td className="py-2 pr-3 text-right tabular-nums">
                {r.conversion_from_prev_pct == null ? "—" : `${r.conversion_from_prev_pct.toFixed(1)}%`}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Activation funnel</h1>
        <p className="crm-page-subtitle">
          Lightweight launch funnel from <code className="rounded bg-[var(--crm-accent)] px-1 text-[11px]">product_events</code>.
        </p>
      </header>

      <form className="crm-surface-card p-4 flex flex-wrap items-end gap-3">
        <label className="text-xs text-[var(--crm-muted)]">
          Window (days)
          <input
            name="days"
            defaultValue={String(days)}
            className="mt-1 block rounded border border-[var(--crm-border)] bg-[var(--crm-bg)] px-2 py-1.5 text-sm text-[var(--crm-foreground)]"
          />
        </label>
        <button type="submit" className="crm-btn-primary">
          Apply
        </button>
      </form>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Creator funnel</h2>
        {renderFunnelRows(insights.creator.rows)}
        {insights.creator.biggest_dropoff && (
          <p className="mt-3 text-xs text-[var(--crm-muted)]">
            Biggest creator drop-off: <code>{insights.creator.biggest_dropoff.from_step}</code> →{" "}
            <code>{insights.creator.biggest_dropoff.to_step}</code> (
            {insights.creator.biggest_dropoff.users_dropped.toLocaleString()} users,{" "}
            {insights.creator.biggest_dropoff.dropoff_pct.toFixed(1)}%).
          </p>
        )}
      </div>

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Org funnel</h2>
        {renderFunnelRows(insights.org.rows)}
        {insights.org.biggest_dropoff && (
          <p className="mt-3 text-xs text-[var(--crm-muted)]">
            Biggest org drop-off: <code>{insights.org.biggest_dropoff.from_step}</code> →{" "}
            <code>{insights.org.biggest_dropoff.to_step}</code> (
            {insights.org.biggest_dropoff.users_dropped.toLocaleString()} users,{" "}
            {insights.org.biggest_dropoff.dropoff_pct.toFixed(1)}%).
          </p>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="crm-surface-card p-4">
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">X connection split (creators)</h3>
          <ul className="space-y-1 text-sm text-[var(--crm-foreground)]">
            <li>
              Signed in with X connected:{" "}
              <strong>{insights.x_connection_split.creators_signed_in_x_connected.toLocaleString()}</strong>
            </li>
            <li>
              Signed in without X connected:{" "}
              <strong>{insights.x_connection_split.creators_signed_in_x_not_connected.toLocaleString()}</strong>
            </li>
          </ul>
        </section>

        <section className="crm-surface-card p-4">
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Stall points</h3>
          <ul className="space-y-1 text-sm text-[var(--crm-foreground)]">
            <li>Signed in but profile not completed: <strong>{insights.stalls.creators_signed_in_not_profile_completed.toLocaleString()}</strong></li>
            <li>Profile completed but X not connected: <strong>{insights.stalls.creators_profile_completed_not_x_connected.toLocaleString()}</strong></li>
            <li>X connected but analytics not opened: <strong>{insights.stalls.creators_x_connected_not_analytics_opened.toLocaleString()}</strong></li>
            <li>Analytics opened but marketplace not reached: <strong>{insights.stalls.creators_analytics_opened_not_marketplace_opened.toLocaleString()}</strong></li>
            <li>Campaign created but not launched: <strong>{insights.stalls.org_campaign_created_not_launched.toLocaleString()}</strong></li>
          </ul>
        </section>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="crm-surface-card p-4">
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Creator analytics opened by plan</h3>
          <ul className="space-y-1 text-sm text-[var(--crm-foreground)]">
            {insights.plan_breakdowns.creator_analytics_opened.length === 0 ? (
              <li className="text-[var(--crm-muted)]">No rows in selected window.</li>
            ) : (
              insights.plan_breakdowns.creator_analytics_opened.map((r) => (
                <li key={r.effective_plan}>
                  <code>{r.effective_plan}</code>: <strong>{r.users.toLocaleString()}</strong>
                </li>
              ))
            )}
          </ul>
        </section>

        <section className="crm-surface-card p-4">
          <h3 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Org campaign created by plan</h3>
          <ul className="space-y-1 text-sm text-[var(--crm-foreground)]">
            {insights.plan_breakdowns.org_campaign_created.length === 0 ? (
              <li className="text-[var(--crm-muted)]">No rows in selected window.</li>
            ) : (
              insights.plan_breakdowns.org_campaign_created.map((r) => (
                <li key={r.effective_plan}>
                  <code>{r.effective_plan}</code>: <strong>{r.users.toLocaleString()}</strong>
                </li>
              ))
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}

