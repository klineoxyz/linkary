import { assertOpsPageAccess } from "@/lib/opsAccess";
import { fetchOpsAuditRows } from "@/lib/opsData";
import { OpsAuditTable } from "@/components/OpsAuditTable";

export default async function OpsAuditPlatformPage() {
  const { service } = await assertOpsPageAccess();
  const rows = await fetchOpsAuditRows(service, 120, "all");

  return (
    <div className="space-y-6">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Platform audit</h1>
        <p className="crm-page-subtitle">Read-only <code className="text-xs bg-[var(--crm-accent)] px-1 rounded">platform_audit_log</code>. Newest first. Exact rows.</p>
      </header>
      <OpsAuditTable rows={rows} />
    </div>
  );
}
