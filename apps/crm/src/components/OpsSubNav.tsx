import Link from "next/link";
import type { OpsRole } from "@/lib/internalOps";
import { canAccessOpsWriteActionsArea } from "@/lib/internalOps";

const items = [
  { href: "/ops/overview", label: "Overview" },
  { href: "/ops/reports", label: "Financial reports" },
  { href: "/ops/users", label: "Users & plans" },
  { href: "/ops/campaigns", label: "Campaigns & participants" },
  { href: "/ops/audit", label: "Audit log" },
  { href: "/ops/actions", label: "Actions" },
];

export function OpsSubNav({ role }: { role: OpsRole }) {
  const links = items.filter(
    (item) => item.href !== "/ops/actions" || canAccessOpsWriteActionsArea(role)
  );

  return (
    <div className="crm-surface-raised mb-6 p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">Internal ops</h2>
        <span className="text-xs text-[var(--crm-muted)] uppercase tracking-wide">{role}</span>
      </div>
      <nav className="flex flex-wrap gap-2">
        {links.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="text-sm px-3 py-1.5 rounded-[var(--crm-radius)] border border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)] no-underline"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </div>
  );
}
