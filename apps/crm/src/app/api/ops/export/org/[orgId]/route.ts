import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsOrgDetailReport } from "@/lib/opsReporting";
import { toCsv } from "@/lib/opsCsv";

export async function GET(_request: Request, { params }: { params: Promise<{ orgId: string }> }) {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const { orgId } = await params;
  const rep = await fetchOpsOrgDetailReport(gate.service, orgId);
  if (!rep) {
    return NextResponse.json({ error: "Org not found" }, { status: 404 });
  }

  const headers = [
    "campaign_id",
    "title",
    "status",
    "starts_at",
    "ends_at",
    "budget",
    "currency",
    "campaign_value_usd",
    "invited",
    "accepted",
    "declined",
    "submissions",
    "approved",
    "rejected",
    "needs_revision",
    "pending",
  ];
  const body = toCsv(
    headers,
    rep.campaigns.map((c) => [
      c.id,
      c.title,
      c.status,
      c.starts_at,
      c.ends_at,
      c.budget,
      c.currency,
      c.campaign_value_usd,
      c.invited,
      c.accepted,
      c.declined,
      c.submissions,
      c.approved_submissions,
      c.rejected_submissions,
      c.needs_revision_submissions,
      c.pending_submissions,
    ])
  );

  const safeSlug = (rep.org.slug ?? "org").replace(/[^a-z0-9_-]/gi, "_").slice(0, 48);
  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-org-${safeSlug}-campaigns.csv"`,
    },
  });
}
