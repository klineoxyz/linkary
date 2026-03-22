import Link from "next/link";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsCreatorLeaderboard } from "@/lib/opsReporting";
import { parsePage, parsePageSize, parseParticipantStatus, parseSearchQ, parseUuid } from "@/lib/opsReportParams";
import { OpsReportFilterForm } from "@/components/OpsReportFilterForm";
import { OpsConfidenceBadge } from "@/components/OpsConfidenceBadge";

function displayHandle(username: string | null): string {
  if (!username?.trim()) return "—";
  const u = username.replace(/^@/, "");
  return `@${u}`;
}

function rate(a: number, b: number): string {
  if (b <= 0) return "—";
  return `${((a / b) * 100).toFixed(1)}%`;
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

export default async function OpsReportsCreatorsPage({
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
  const orgId = parseUuid(sp, "org_id");
  const campaignId = parseUuid(sp, "campaign_id");
  const partStatus = parseParticipantStatus(sp);

  const { rows, truncated, scannedParticipants } = await fetchOpsCreatorLeaderboard(service, {
    partStatus,
    campaignId,
    orgId,
    q,
    limit: pageSize,
    offset: (page - 1) * pageSize,
  });

  const exportQs = new URLSearchParams();
  if (q.length >= 2) exportQs.set("q", q);
  if (orgId) exportQs.set("org_id", orgId);
  if (campaignId) exportQs.set("campaign_id", campaignId);
  if (partStatus) exportQs.set("part_status", partStatus);

  return (
    <div className="space-y-8">
      <header className="crm-page-header flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="crm-page-title">Creators &amp; participants</h1>
          <p className="crm-page-subtitle">
            Aggregated from <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">crm_campaign_participants</code> and{" "}
            <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">crm_submissions</code>. Full table scans with 500k safety cap.
          </p>
          <div className="flex flex-wrap gap-2 mt-2 text-xs text-[var(--crm-muted)] items-center">
            <span>Participant rows scanned: {scannedParticipants}</span>
            {truncated ? <OpsConfidenceBadge kind="estimated" /> : <OpsConfidenceBadge kind="exact" />}
            {truncated ? <span className="text-amber-800">Truncated — refine filters.</span> : null}
          </div>
        </div>
        <a
          href={`/api/ops/export/creators?${exportQs.toString()}`}
          className="text-sm px-3 py-2 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline shrink-0"
        >
          Export CSV
        </a>
      </header>

      <OpsReportFilterForm
        fields={[
          { type: "text", name: "q", label: "Profile search", placeholder: "username / display" },
          { type: "text", name: "org_id", label: "Org UUID filter" },
          { type: "text", name: "campaign_id", label: "Campaign UUID filter" },
          {
            type: "select",
            name: "part_status",
            label: "Participant status",
            options: [
              { value: "", label: "All" },
              { value: "invited", label: "invited" },
              { value: "accepted", label: "accepted" },
              { value: "declined", label: "declined" },
              { value: "removed", label: "removed" },
            ],
          },
        ]}
      />

      <div className="crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-[var(--crm-muted)] border-b border-[var(--crm-border)]">
              <th className="py-2 pr-2">Creator</th>
              <th className="py-2 pr-2 text-right">Campaigns</th>
              <th className="py-2 pr-2 text-right">Accepted rows</th>
              <th className="py-2 pr-2 text-right">Submissions</th>
              <th className="py-2 pr-2 text-right">Approved</th>
              <th className="py-2 pr-2 text-right">Appr ÷ sub</th>
              <th className="py-2 pr-2 text-right">Avg h accept→1st</th>
              <th className="py-2">Detail</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-8 text-center text-[var(--crm-muted)]">
                  No rows — widen filters or lower search specificity.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.profile_id} className="border-b border-[var(--crm-border)]/60">
                  <td className="py-2 pr-2">
                    <span className="font-medium">{displayHandle(r.username)}</span>
                    <span className="block text-xs text-[var(--crm-muted)]">{r.display_name ?? ""}</span>
                  </td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.campaigns_joined}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.participant_accepted}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.submissions}</td>
                  <td className="py-2 pr-2 text-right tabular-nums">{r.approved_submissions}</td>
                  <td className="py-2 pr-2 text-right text-xs">
                    {rate(r.approved_submissions, r.submissions)}
                    <span className="block">
                      <OpsConfidenceBadge kind="proxy" />
                    </span>
                  </td>
                  <td className="py-2 pr-2 text-right text-xs tabular-nums">
                    {r.avgHoursAcceptToFirstSubmit != null ? r.avgHoursAcceptToFirstSubmit.toFixed(1) : "—"}
                    <span className="block">
                      <OpsConfidenceBadge kind="estimated" />
                    </span>
                  </td>
                  <td className="py-2">
                    <Link
                      href={`/ops/reports/creators/${r.profile_id}`}
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

      <div className="flex flex-wrap gap-2 text-sm">
        {page > 1 ? (
          <Link
            href={`/ops/reports/creators${hrefWith(sp, { page: String(page - 1) })}`}
            className="px-3 py-1.5 rounded border border-[var(--crm-border)] text-[var(--crm-foreground)] no-underline hover:bg-[var(--crm-accent)]"
          >
            Previous
          </Link>
        ) : null}
        <Link
          href={`/ops/reports/creators${hrefWith(sp, { page: String(page + 1) })}`}
          className="px-3 py-1.5 rounded border border-[var(--crm-border)] text-[var(--crm-foreground)] no-underline hover:bg-[var(--crm-accent)]"
        >
          Next
        </Link>
      </div>
    </div>
  );
}
