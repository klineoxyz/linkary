import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsOverviewStats } from "@/lib/opsData";

export async function GET() {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const data = await fetchOpsOverviewStats(gate.service);
  return NextResponse.json({ ok: true as const, data });
}
