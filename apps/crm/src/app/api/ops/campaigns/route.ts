import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignRows, fetchOpsParticipantRows } from "@/lib/opsData";

export async function GET(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const cLimit = Math.min(200, Math.max(1, parseInt(searchParams.get("campaignLimit") ?? "80", 10) || 80));
  const pLimit = Math.min(200, Math.max(1, parseInt(searchParams.get("participantLimit") ?? "60", 10) || 60));

  const [campaigns, participants] = await Promise.all([
    fetchOpsCampaignRows(gate.service, cLimit),
    fetchOpsParticipantRows(gate.service, pLimit),
  ]);

  return NextResponse.json({ ok: true as const, data: { campaigns, participants } });
}
