import { notFound } from "next/navigation";
import { assertOpsPageAccess } from "@/lib/opsAccess";
import { OpsActionsPanel } from "@/components/OpsActionsPanel";
import { canAccessOpsWriteActionsArea } from "@/lib/internalOps";

export default async function OpsActionsPage() {
  const { role } = await assertOpsPageAccess();
  if (!canAccessOpsWriteActionsArea(role)) {
    notFound();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="crm-page-title">Ops actions</h1>
        <p className="crm-page-subtitle">
          Server-enforced writes: comp grants, discount metadata, plan overrides, usage counter reset, revoke. Every action requires a reason and is audited.
        </p>
      </div>
      <OpsActionsPanel role={role} />
    </div>
  );
}
