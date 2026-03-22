"use client";

import type { OpsRole } from "@/lib/internalOps";
import { OpsActionsWizard } from "@/components/OpsActionsWizard";

export function OpsActionsPanel({ role }: { role: OpsRole }) {
  if (role === "ops_readonly") {
    return (
      <div className="crm-surface-raised p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)] text-sm text-[var(--crm-muted)]">
        Read-only ops membership: no write actions. Use Overview, Financial reports, Users, and Audit log.
      </div>
    );
  }

  return <OpsActionsWizard role={role} />;
}
