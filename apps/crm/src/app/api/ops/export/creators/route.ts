import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsCreatorLeaderboard } from "@/lib/opsReporting";
import { parseParticipantStatus, parseSearchQ, parseUuid } from "@/lib/opsReportParams";
import { toCsv } from "@/lib/opsCsv";

export async function GET(request: Request) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { searchParams } = new URL(request.url);
  const q = parseSearchQ(searchParams);
  const orgId = parseUuid(searchParams, "org_id");
  const campaignId = parseUuid(searchParams, "campaign_id");
  const partStatus = parseParticipantStatus(searchParams);

  const { rows, truncated, scannedParticipants } = await fetchOpsCreatorLeaderboard(gate.service, {
    partStatus,
    campaignId,
    orgId,
    q,
    limit: Math.min(15000, Math.max(1, parseInt(searchParams.get("limit") ?? "8000", 10) || 8000)),
    offset: 0,
  });

  const headers = [
    "profile_id",
    "username",
    "display_name",
    "campaigns_joined",
    "participant_accepted_rows",
    "submissions",
    "approved_submissions",
    "avg_hours_accept_to_first_submit",
    "scan_truncated",
    "participant_rows_scanned",
  ];
  const body = toCsv(
    headers,
    rows.map((r) => [
      r.profile_id,
      r.username,
      r.display_name,
      r.campaigns_joined,
      r.participant_accepted,
      r.submissions,
      r.approved_submissions,
      r.avgHoursAcceptToFirstSubmit,
      truncated ? "yes" : "no",
      scannedParticipants,
    ])
  );

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-creators-report.csv"`,
    },
  });
}
