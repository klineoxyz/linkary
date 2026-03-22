import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsCampaignDetailReport } from "@/lib/opsReporting";
import { toCsv } from "@/lib/opsCsv";

export async function GET(_request: Request, { params }: { params: Promise<{ campaignId: string }> }) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { campaignId } = await params;
  const rep = await fetchOpsCampaignDetailReport(gate.service, campaignId);
  if (!rep) {
    return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
  }

  const headers = [
    "submission_id",
    "platform",
    "status",
    "created_at",
    "reviewed_at",
    "participant_profile_id",
    "url",
  ];
  const body = toCsv(
    headers,
    rep.submissions.map((s) => [s.id, s.platform, s.status, s.created_at, s.reviewed_at, s.participant_profile_id, s.url])
  );

  const safe = rep.campaign.title.replace(/[^a-z0-9_-]/gi, "_").slice(0, 40);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-campaign-${safe}-submissions.csv"`,
    },
  });
}
