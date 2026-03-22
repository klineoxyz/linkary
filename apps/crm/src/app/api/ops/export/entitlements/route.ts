import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsEntitlementsForTable } from "@/lib/opsReporting";
import { parseEntitlementActiveMode, parseEntitlementKind } from "@/lib/opsReportParams";
import { toCsv } from "@/lib/opsCsv";

export async function GET(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const kind = parseEntitlementKind(searchParams);
  const state = parseEntitlementActiveMode(searchParams);
  const limit = Math.min(10000, Math.max(1, parseInt(searchParams.get("limit") ?? "5000", 10) || 5000));

  const { rows } = await fetchOpsEntitlementsForTable(gate.service, {
    kind,
    state,
    limit,
    offset: 0,
  });

  const headers = ["id", "subject_type", "subject_id", "kind", "expires_at", "revoked_at", "reason", "created_at"];
  const body = toCsv(
    headers,
    rows.map((r) => [r.id, r.subject_type, r.subject_id, r.kind, r.expires_at, r.revoked_at, r.reason, r.created_at])
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-entitlements.csv"`,
    },
  });
}
