import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsFinancialReport } from "@/lib/opsData";
import { FinancialReportsView } from "@/components/FinancialReportsView";

export default async function OpsFinancialReportsPage() {
  const { service } = await assertOpsPageAccess();
  const report = await fetchOpsFinancialReport(service);
  return <FinancialReportsView report={report} />;
}
