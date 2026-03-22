import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsOrgReportList } from "@/lib/opsReporting";
import { parsePage, parsePageSize, parsePlanKeyFilter, parseSearchQ } from "@/lib/opsReportParams";
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

export default async function OpsReportsProjectsPage({
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

  const page = parsePage(sp);
  const pageSize = parsePageSize(sp, 25, 80);
  const q = parseSearchQ(sp);
  const plan = parsePlanKeyFilter(sp);

  const { rows, totalMatching, rollupTruncated } = await fetchOpsOrgReportList(service, {
    q,
    planKey: plan,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const totalPages = Math.max(1, Math.ceil(totalMatching / pageSize));
  const planOptions = [
    { value: "", label: "All plans" },
    { value: "free", label: "free" },
    { value: "nano", label: "nano" },
    { value: "kol", label: "kol" },
    { value: "startup", label: "startup" },
    { value: "unicorn", label: "unicorn" },
    { value: "custom", label: "custom" },
  ];

  return (
    <div className="space-y-8">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-title">Project / org reports</h1>
          <p className="crm-page-subtitle">
            Orgs with CRM campaigns linked via <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">crm_workspaces.linked_org_id</code>.
            Campaign counts use a full paginated scan (safety cap 500k rows) — see rollup flag.
          </p>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <OpsConfidenceBadge kind="exact" />
            {rollupTruncated ? <OpsConfidenceBadge kind="estimated" /> : null}
            {rollupTruncated ? (
              <span className="text-xs text-amber-800">Campaign rollup hit scan safety cap — counts may be incomplete.</span>
            ) : null}
          </div>
        </div>
        <a
          href={`/api/ops/export/orgs?${new URLSearchParams({ q, ...(plan ? { plan } : {}) }).toString()}`}
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Export CSV
        </a>
      </header>

      <OpsReportFilterForm
        fields={[
          { type: "text", name: "q", label: "Search name/slug", placeholder: "min 2 chars" },
          { type: "select", name: "plan", label: "Org plan", options: planOptions },
        ]}
      />

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-3">Org</th>
              <th className="py-2 pr-3">Slug</th>
              <th className="py-2 pr-3 text-right">Campaigns</th>
              <th className="py-2 pr-3">Plan</th>
              <th className="py-2">Report</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-[var(--crm-muted)] text-sm">
                  No orgs match filters.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.org_id} className="border-b border-[var(--crm-border)]/60">
                  <td className="py-2 pr-3 font-medium">{r.name ?? "—"}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.slug ?? "—"}</td>
                  <td className="py-2 pr-3 text-right tabular-nums">{r.campaign_count}</td>
                  <td className="py-2 pr-3 font-mono text-xs">{r.plan_key}</td>
                  <td className="py-2">
                    <Link
                      href={`/ops/reports/projects/${r.org_id}`}
                      className="text-[var(--crm-primary)] font-medium text-xs underline-offset-2 hover:underline"
                    >
                      Open
                    </Link>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-[var(--crm-muted)]">
        <span>
          Page {page} / {totalPages} · {totalMatching} orgs
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/ops/reports/projects${hrefWith(sp, { page: String(page - 1) })}`}
              className="px-3 py-1.5 rounded border border-[var(--crm-border)] text-[var(--crm-foreground)] no-underline hover:bg-[var(--crm-accent)]"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={`/ops/reports/projects${hrefWith(sp, { page: String(page + 1) })}`}
              className="px-3 py-1.5 rounded border border-[var(--crm-border)] text-[var(--crm-foreground)] no-underline hover:bg-[var(--crm-accent)]"
            >
              Next
            </Link>
          ) : null}
        </div>
      </div>
    </div>
  );
}
