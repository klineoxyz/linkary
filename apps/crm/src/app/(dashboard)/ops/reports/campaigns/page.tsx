import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignReportList } from "@/lib/opsReporting";
import {
  parseCampaignStatus,
  parseOpsDateRangeExplicit,
  parsePage,
  parsePageSize,
  parseSearchQ,
  parseUuid,
} from "@/lib/opsReportParams";
import { OpsReportFilterForm } from "@/components/OpsReportFilterForm";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function rate(num: number, den: number): string {
  if (den <= 0) return "—";
  return `${((num / den) * 100).toFixed(1)}%`;
}

function hrefWith(sp: URLSearchParams, updates: Record<string, string>) {
  const n = new URLSearchParams(sp.toString());
  for (const [k, v] of Object.entries(updates)) {
    if (v === "") n.delete(k);
    else n.set(k, v);
  }
  const q = n.toString();
  return q ? `?${q}` : "";
}

export default async function OpsReportsCampaignsPage({
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

  const dr = parseOpsDateRangeExplicit(sp);
  const page = parsePage(sp);
  const pageSize = parsePageSize(sp, 25, 80);
  const status = parseCampaignStatus(sp);
  const q = parseSearchQ(sp);
  const orgId = parseUuid(sp, "org_id");

  const { rows, scanned, truncated, totalInSample } = await fetchOpsCampaignReportList(service, {
    fromIso: dr?.fromIso ?? null,
    toIso: dr?.toIso ?? null,
    status,
    q,
    limit: pageSize,
    offset: (page - 1) * pageSize,
    orgId,
  });

  const totalPages = Math.max(1, Math.ceil(totalInSample / pageSize));
  const exportQs = new URLSearchParams();
  if (dr?.fromIso) exportQs.set("from", sp.get("from") ?? "");
  if (dr?.toIso) exportQs.set("to", sp.get("to") ?? "");
  if (status) exportQs.set("status", status);
  if (q.length >= 2) exportQs.set("q", q);
  if (orgId) exportQs.set("org_id", orgId);

  return (
    <div className="space-y-8">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-title">Campaign reports</h1>
          <p className="crm-page-subtitle">
            Filterable list with KPIs from participants + submissions. Full campaign scan paginated (500k safety cap). Date filters apply to{" "}
            <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">crm_campaigns.created_at</code> when set.
          </p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-[var(--crm-muted)]">
            <span>Rows scanned: {scanned}</span>
            {truncated ? <OpsConfidenceBadge kind="estimated" /> : <OpsConfidenceBadge kind="exact" />}
            {truncated ? <span className="text-amber-800">Truncated — refine filters.</span> : null}
          </div>
        </div>
        <a
          href={`/api/ops/export/campaigns?${exportQs.toString()}`}
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Export CSV
        </a>
      </header>

      <OpsReportFilterForm
        fields={[
          { type: "date", name: "from", label: "Created from" },
          { type: "date", name: "to", label: "Created to" },
          {
            type: "select",
            name: "status",
            label: "Campaign status",
            options: [
              { value: "", label: "All" },
              { value: "draft", label: "draft" },
              { value: "active", label: "active" },
              { value: "paused", label: "paused" },
              { value: "completed", label: "completed" },
              { value: "cancelled", label: "cancelled" },
            ],
          },
          { type: "text", name: "q", label: "Title contains" },
          { type: "text", name: "org_id", label: "Org UUID" },
        ]}
      />

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[1020px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">Campaign</th>
              <th className="py-2 pr-2">Status</th>
              <th className="py-2 pr-2">Org</th>
              <th className="py-2 pr-2 text-right">Invited</th>
              <th className="py-2 pr-2 text-right">Accepted</th>
              <th className="py-2 pr-2 text-right">Sub</th>
              <th className="py-2 pr-2 text-right">Appr</th>
              <th className="py-2 pr-2 text-right">Rates</th>
              <th className="py-2">Report</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-[var(--crm-muted)]">
                  No campaigns in this slice.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.campaign_id} className="border-b border-[var(--crm-border)]/60 align-top">
                  <td className="py-2 pr-2 max-w-[200px]">{r.title}</td>
                  <td className="py-2 pr-2 font-mono text-xs">{r.status}</td>
                  <td className="py-2 pr-2 text-xs max-w-[140px]">{r.org_name ?? r.linked_org_id ?? "—"}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.invited}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.accepted}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.submissions}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.approved_submissions}</td>
                  <td className="py-2 pr-2 text-right text-[10px] text-[var(--crm-muted)]">
                    {rate(r.accepted, r.invited)} / {rate(r.approved_submissions, r.submissions)}
                    <span className="block">
                      <OpsConfidenceBadge kind="proxy" />
                    </span>
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/ops/reports/campaigns/${r.campaign_id}`}
                      className="text-[var(--crm-primary)] text-xs font-medium underline-offset-2 hover:underline"
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
          Page {page} / {totalPages} · {totalInSample} in filtered set
        </span>
        <div className="flex gap-2">
          {page > 1 ? (
            <Link
              href={`/ops/reports/campaigns${hrefWith(sp, { page: String(page - 1) })}`}
              className="px-3 py-1.5 rounded border border-[var(--crm-border)] text-[var(--crm-foreground)] no-underline hover:bg-[var(--crm-accent)]"
            >
              Previous
            </Link>
          ) : null}
          {page < totalPages ? (
            <Link
              href={`/ops/reports/campaigns${hrefWith(sp, { page: String(page + 1) })}`}
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
