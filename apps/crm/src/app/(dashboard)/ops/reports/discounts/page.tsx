import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsEntitlementUsageReport } from "@/lib/opsData";
import { fetchOpsAuditActionHistogram, fetchOpsEntitlementsForTable } from "@/lib/opsReporting";
import { parseEntitlementActiveMode, parseEntitlementKind, parseOpsDateRangeExplicit, parsePage, parsePageSize } from "@/lib/opsReportParams";
import { OpsReportFilterForm } from "@/components/OpsReportFilterForm";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function hrefWith(sp: URLSearchParams, updates: Record<string, string>) {
  const n = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v === "") n.delete(k);
    else n.set(k, v);
  }
  const q = n.toString();
  return q ? `?${q}` : "";
}

export default async function OpsReportsDiscountsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { service } = await assertOpsPageAccess();
  const sp = new URLSearchParams();
  const raw = await searchParams;
  for (const [k, v] of Object.entries(raw)) {
    if (typeof v === "string") sp.set(k, v);
  }

  const kind = parseEntitlementKind(sp);
  const state = parseEntitlementActiveMode(sp);
  const page = parsePage(sp);
  const pageSize = parsePageSize(sp, 40, 200);
  const dr = parseOpsDateRangeExplicit(sp);

  const [report, table, hist] = await Promise.all([
    fetchOpsEntitlementUsageReport(service),
    fetchOpsEntitlementsForTable(service, { kind, state, limit: pageSize, offset: (page - 1) * pageSize }),
    fetchOpsAuditActionHistogram(service, { fromIso: dr?.fromIso ?? null, toIso: dr?.toIso ?? null }),
  ]);

  const entitlementActions = Object.entries(hist.counts)
    .filter(([a]) => a.startsWith("ops.entitlement."))
    .sort((a, b) => b[1] - a[1]);
  const total = table.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const exportQs = new URLSearchParams();
  if (kind) exportQs.set("kind", kind);
  exportQs.set("state", state);

  return (
    <div className="space-y-8">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-title">Discount / comp usage</h1>
          <p className="crm-page-subtitle">
            Entitlements table + audit histogram. Actor-level attribution is in{" "}
            <Link href="/ops/audit/entitlements" className="text-[var(--crm-primary)] underline-offset-2 hover:underline">
              Entitlement actions
            </Link>
            .
          </p>
        </div>
        <a
          href={`/api/ops/export/entitlements?${exportQs.toString()}`}
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Export CSV
        </a>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide">Active comp_grant</p>
            <OpsConfidenceBadge kind="exact" />
          </div>
          <p className="text-2xl font-semibold tabular-nums">{report.activeByKind.comp_grant}</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide">Active discount_metadata</p>
            <OpsConfidenceBadge kind="exact" />
          </div>
          <p className="text-2xl font-semibold tabular-nums">{report.activeByKind.discount_metadata}</p>
        </div>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
          <div className="flex justify-between items-center mb-1">
            <p className="text-xs text-[var(--crm-muted)] uppercase tracking-wide">Active plan_override</p>
            <OpsConfidenceBadge kind="exact" />
          </div>
          <p className="text-2xl font-semibold tabular-nums">{report.activeByKind.plan_override}</p>
        </div>
      </div>

      <OpsReportFilterForm
        fields={[
          {
            type: "select",
            name: "kind",
            label: "Entitlement kind",
            options: [
              { value: "", label: "All kinds" },
              { value: "comp_grant", label: "comp_grant" },
              { value: "discount_metadata", label: "discount_metadata" },
              { value: "plan_override", label: "plan_override" },
            ],
          },
          {
            type: "select",
            name: "state",
            label: "Active / revoked",
            options: [
              { value: "all", label: "All rows" },
              { value: "active", label: "Active only" },
              { value: "revoked", label: "Revoked only" },
            ],
          },
          { type: "date", name: "from", label: "Audit hist from" },
          { type: "date", name: "to", label: "Audit hist to" },
        ]}
      />

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Entitlement actions in audit log (histogram)</h2>
          <OpsConfidenceBadge kind={hist.truncated ? "estimated" : "exact"} />
        </div>
        <p className="text-[10px] text-[var(--crm-muted)] mb-3">
          Scanned {hist.scanned} audit rows
          {hist.truncated ? " — truncated at safety cap." : "."}
          {dr ? " Filtered by date range when both from/to set." : " No date filter (full scan order)."}
        </p>
        <table className="w-full text-sm max-w-2xl">
          <tbody>
            {entitlementActions.length === 0 ? (
              <tr>
                <td className="py-4 text-[var(--crm-muted)]">No ops.entitlement.* actions in scanned window.</td>
              </tr>
            ) : (
              entitlementActions.map(([action, count]) => (
                <tr key={action} className="border-b border-[var(--crm-border)]/50">
                  <td className="py-2 font-mono text-xs">{action}</td>
                  <td className="py-2 text-right tabular-nums">{count}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </section>

      <section className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)]">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-2">Recently revoked (sample)</h2>
        <p className="text-[10px] text-[var(--crm-muted)] mb-3">Top 40 by revoked_at — exact sample.</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">kind</th>
                <th className="py-2 pr-2">subject</th>
                <th className="py-2 pr-2">revoked_at</th>
                <th className="py-2">expires_at</th>
              </tr>
            </thead>
            <tbody>
              {report.recentlyRevoked.map((row) => (
                <tr key={row.id} className="border-b border-[var(--crm-border)]/60">
                  <td className="py-2 pr-2 font-mono text-xs">{row.kind}</td>
                  <td className="py-2 pr-2 text-xs">
                    {row.subject_type}
                    <span className="block font-mono text-[10px] text-[var(--crm-muted)]">{row.subject_id}</span>
                  </td>
                  <td className="py-2 pr-2 font-mono text-[10px] whitespace-nowrap">{row.revoked_at ?? "—"}</td>
                  <td className="py-2 font-mono text-[10px] whitespace-nowrap">{row.expires_at}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Entitlements table</h2>
        <p className="text-xs text-[var(--crm-muted)] mb-3">
          Total matching: {total} · Page {page}/{totalPages} <OpsConfidenceBadge kind="exact" />
        </p>
        <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
          <table className="w-full text-sm min-w-[800px]">
            <thead>
              <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
                <th className="py-2 pr-2">kind</th>
                <th className="py-2 pr-2">subject</th>
                <th className="py-2 pr-2">expires</th>
                <th className="py-2 pr-2">revoked</th>
                <th className="py-2">reason</th>
              </tr>
            </thead>
            <tbody>
              {table.rows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-[var(--crm-muted)]">
                    No rows.
                  </td>
                </tr>
              ) : (
                table.rows.map((row) => (
                  <tr key={row.id} className="border-b border-[var(--crm-border)]/60 align-top">
                    <td className="py-2 pr-2 font-mono text-xs">{row.kind}</td>
                    <td className="py-2 pr-2 text-xs">
                      {row.subject_type}
                      <span className="block font-mono text-[10px]">{row.subject_id}</span>
                    </td>
                    <td className="py-2 pr-2 font-mono text-[10px]">{row.expires_at}</td>
                    <td className="py-2 pr-2 font-mono text-[10px]">{row.revoked_at ?? "—"}</td>
                    <td className="py-2 text-xs max-w-[280px]">{row.reason}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex gap-2 mt-4 text-sm">
          {page > 1 ? (
            <Link
              href={`/ops/reports/discounts${hrefWith(sp, { page: String(page - 1) })}`}
              className="px-3 py-1.5 rounded border border-[var(--crm-border)] no-underline text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)]"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={`/ops/reports/discounts${hrefWith(sp, { page: String(page + 1) })}`}
              className="px-3 py-1.5 rounded border border-[var(--crm-border)] no-underline text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)]"
            >
              Next
            </Link>
          ) : null}
        </div>
      </section>
    </div>
  );
}
