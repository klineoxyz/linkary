import { NextResponse } from "next/server";
import { requireOpsApiAccess } from "@/lib/opsAccess";
import { fetchOpsFinancialReport, fetchOpsCreatorsProfileCount } from "@/lib/opsData";
import { fetchOpsPlatformExtraCounts, fetchOpsCampaignBudgetRollup } from "@/lib/opsReporting";
import { toCsv } from "@/lib/opsCsv";

export async function GET() {
  const gate = await requireOpsApiAccess();
  if (gate instanceof NextResponse) return gate;

  const [report, extra, budget, creators] = await Promise.all([
    fetchOpsFinancialReport(gate.service),
    fetchOpsPlatformExtraCounts(gate.service),
    fetchOpsCampaignBudgetRollup(gate.service),
    fetchOpsCreatorsProfileCount(gate.service),
  ]);

  const dataRows: (string | number | null)[][] = [
    ["profiles_total", report.counts.profilesTotal.value, report.counts.profilesTotal.confidence],
    ["orgs_total", report.counts.orgsTotal.value, report.counts.orgsTotal.confidence],
    ["workspaces_total", extra.workspacesTotal, "exact"],
    ["crm_campaigns_total", report.counts.crmCampaignsTotal.value, report.counts.crmCampaignsTotal.confidence],
    ["crm_campaigns_active", report.counts.crmCampaignsActive.value, report.counts.crmCampaignsActive.confidence],
    ["crm_campaigns_completed", extra.campaignsCompleted, "exact"],
    ["participant_rows_total", report.counts.campaignParticipantRows.value, report.counts.campaignParticipantRows.confidence],
    ["profiles_individual_count", creators, "exact"],
    ["submissions_total", extra.submissionsTotal, "exact"],
    ["submissions_approved", extra.submissionsApproved, "exact"],
    ["submissions_rejected", extra.submissionsRejected, "exact"],
    ["submissions_needs_revision", extra.submissionsNeedsRevision, "exact"],
    ["submissions_pending", extra.submissionsPending, "exact"],
    ["active_ops_members", report.counts.activeOpsMembers.value, report.counts.activeOpsMembers.confidence],
    ["personal_sub_active_rows", report.personalSubscriptions.activeRows, report.personalSubscriptions.confidence],
    ["org_sub_active_rows", report.orgSubscriptions.activeRows, report.orgSubscriptions.confidence],
    ["budget_rows_count", budget.rowsWithBudget, "exact"],
    ["budget_sum_numeric_proxy", budget.sumBudgetNumeric, "proxy"],
    ["budget_scan_rows", budget.scanned, "exact"],
    ["budget_scan_truncated", budget.truncated ? "yes" : "no", "exact"],
  ];

  const body = toCsv(["metric", "value", "confidence"], dataRows);

  return new NextResponse(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="ops-platform-metrics.csv"`,
    },
  });
}
