import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsAuditRows } from "@/lib/opsData";
import { OpsAuditTable } from "@/components/OpsAuditTable";

export default async function OpsAuditUsageResetsPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsAuditRows(service, 120, "usage");

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Usage resets</h1>
        <p className="crm-page-subtitle">
          Filter: <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">action</code> ={" "}
          <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">ops.usage_counter.reset</code>.
        </p>
      </header>
      <OpsAuditTable rows={rows} />
    </div>
  );
}
