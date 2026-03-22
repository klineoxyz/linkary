import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsOrgReportList } from "@/lib/opsReporting";
import { parsePlanKeyFilter, parseSearchQ } from "@/lib/opsReportParams";
import { toCsv } from "@/lib/opsCsv";

export async function GET(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const q = parseSearchQ(searchParams);
  const plan = parsePlanKeyFilter(searchParams);
  const { rows, totalMatching, rollupTruncated } = await fetchOpsOrgReportList(gate.service, {
    q,
    planKey: plan,
    limit: Math.min(5000, Math.max(1, parseInt(searchParams.get("limit") ?? "2000", 10) || 2000)),
    offset: 0,
  });

  const headers = ["org_id", "name", "slug", "campaign_count", "plan_key", "rollup_truncated", "total_matching"];
  const body = toCsv(
    headers,
    rows.map((r) => [r.org_id, r.name, r.slug, r.campaign_count, r.plan_key, rollupTruncated ? "yes" : "no", totalMatching])
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-orgs-report.csv"`,
    },
  });
}
