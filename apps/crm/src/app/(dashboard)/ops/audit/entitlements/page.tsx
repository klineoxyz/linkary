import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsAuditRows } from "@/lib/opsData";
import { OpsAuditTable } from "@/components/OpsAuditTable";

export default async function OpsAuditEntitlementsPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsAuditRows(service, 120, "entitlement");

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Entitlement actions</h1>
        <p className="crm-page-subtitle">
          Filter: <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">action</code> LIKE{" "}
          <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">ops.entitlement.%</code> — exact filter on stored action strings.
        </p>
      </header>
      <OpsAuditTable rows={rows} />
    </div>
  );
}
