import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignReportList } from "@/lib/opsReporting";
import { parseCampaignStatus, parseOpsDateRangeExplicit, parseSearchQ, parseUuid } from "@/lib/opsReportParams";
import { toCsv } from "@/lib/opsCsv";

export async function GET(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const dr = parseOpsDateRangeExplicit(searchParams);
  const fromIso = dr?.fromIso ?? null;
  const toIso = dr?.toIso ?? null;
  const status = parseCampaignStatus(searchParams);
  const q = parseSearchQ(searchParams);
  const orgId = parseUuid(searchParams, "org_id");

  const { rows, scanned, truncated, totalInSample } = await fetchOpsCampaignReportList(gate.service, {
    fromIso,
    toIso,
    status,
    q,
    limit: Math.min(8000, Math.max(1, parseInt(searchParams.get("limit") ?? "4000", 10) || 4000)),
    offset: 0,
    orgId,
  });

  const headers = [
    "campaign_id",
    "title",
    "status",
    "workspace_id",
    "workspace_name",
    "linked_org_id",
    "org_name",
    "starts_at",
    "ends_at",
    "created_at",
    "budget",
    "currency",
    "invited",
    "accepted",
    "submissions",
    "approved_submissions",
    "scan_rows",
    "truncated",
    "total_in_sample",
  ];
  const body = toCsv(
    headers,
    rows.map((r) => [
      r.campaign_id,
      r.title,
      r.status,
      r.workspace_id,
      r.workspace_name,
      r.linked_org_id,
      r.org_name,
      r.starts_at,
      r.ends_at,
      r.created_at,
      r.budget,
      r.currency,
      r.invited,
      r.accepted,
      r.submissions,
      r.approved_submissions,
      scanned,
      truncated ? "yes" : "no",
      totalInSample,
    ])
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-campaigns-report.csv"`,
    },
  });
}
