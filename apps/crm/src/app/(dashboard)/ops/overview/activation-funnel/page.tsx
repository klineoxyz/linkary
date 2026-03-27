import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchActivationFunnelCounts } from "@/lib/opsData";

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
  const rows = await fetchActivationFunnelCounts(service, since);

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
        <table className="w-full min-w-[620px] text-sm">
          <thead>
            <tr className="border-b border-[var(--crm-border)] text-left text-[var(--crm-muted)]">
              <th className="py-2 pr-3">Step</th>
              <th className="py-2 pr-3 text-right">Distinct users</th>
              <th className="py-2 pr-3 text-right">Total events</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.event_name} className="border-b border-[var(--crm-border)]/60 last:border-0">
                <td className="py-2 pr-3 font-mono text-xs">{r.event_name}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.users.toLocaleString()}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{r.events.toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

