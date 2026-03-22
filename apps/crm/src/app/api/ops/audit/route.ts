import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsAuditRows, type OpsAuditFilter } from "@/lib/opsData";

export async function GET(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") ?? "100", 10) || 100));
  const filterRaw = searchParams.get("filter") ?? "all";
  const filter: OpsAuditFilter =
    filterRaw === "entitlement" || filterRaw === "usage" ? filterRaw : "all";

  const data = await fetchOpsAuditRows(gate.service, limit, filter);
  return NextResponse.json({ ok: true as const, data });
}
