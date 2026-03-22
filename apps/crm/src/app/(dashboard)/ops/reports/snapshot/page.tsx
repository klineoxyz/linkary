import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsFinancialReport } from "@/lib/opsData";
import { FinancialReportsView } from "@/components/FinancialReportsView";

export default async function OpsReportsSnapshotPage() {
  const { service } = await assertOpsPageAccess();
  const report = await fetchOpsFinancialReport(service);

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Platform snapshot</h1>
        <p className="crm-page-subtitle">
          Full financial &amp; business snapshot from in-DB subscriptions and CRM tables. Ratios are labeled proxy; dollar revenue is not
          computed here.
        </p>
      </header>
      <FinancialReportsView report={report} embedded />
    </div>
  );
}
