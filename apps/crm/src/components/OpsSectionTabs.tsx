"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { OpsRole } from "@/lib/internalOps";
import { canAccessOpsWriteActionsArea } from "@/lib/internalOps";

type Tab = { href: string; label: string };

function sectionForPath(pathname: string, role: OpsRole): { title: string; tabs: Tab[] } | null {
  if (pathname.startsWith("/ops/overview")) {
    return {
      title: "Overview",
      tabs: [
        { href: "/ops/overview/summary", label: "Summary" },
        { href: "/ops/overview/health", label: "Ops health" },
        { href: "/ops/overview/launch-diagnostics", label: "Launch diagnostics" },
        { href: "/ops/overview/quick-links", label: "Quick links" },
      ],
    };
  }
  if (pathname.startsWith("/ops/reports")) {
    return {
      title: "Financial reports",
      tabs: [
        { href: "/ops/reports/snapshot", label: "Platform snapshot" },
        { href: "/ops/reports/growth", label: "Platform growth" },
        { href: "/ops/reports/monetization", label: "Subscription & monetization" },
        { href: "/ops/reports/projects", label: "Project reports" },
        { href: "/ops/reports/campaigns", label: "Campaign reports" },
        { href: "/ops/reports/creators", label: "Creators & participants" },
        { href: "/ops/reports/discounts", label: "Discount / comp usage" },
      ],
    };
  }
  if (pathname.startsWith("/ops/users")) {
    return {
      title: "Users & plans",
      tabs: [
        { href: "/ops/users/profiles", label: "Profiles" },
        { href: "/ops/users/orgs", label: "Orgs" },
        { href: "/ops/users/plan-distribution", label: "Plan distribution" },
        { href: "/ops/users/entitlements", label: "Active entitlements" },
      ],
    };
  }
  if (pathname.startsWith("/ops/campaigns")) {
    return {
      title: "Campaigns & participants",
      tabs: [
        { href: "/ops/campaigns/campaigns", label: "Campaigns" },
        { href: "/ops/campaigns/participants", label: "Participants" },
        { href: "/ops/campaigns/deliveries", label: "Deliveries" },
        { href: "/ops/campaigns/compliance", label: "Follow compliance" },
      ],
    };
  }
  if (pathname.startsWith("/ops/audit")) {
    return {
      title: "Audit log",
      tabs: [
        { href: "/ops/audit/platform", label: "Platform audit" },
        { href: "/ops/audit/entitlements", label: "Entitlement actions" },
        { href: "/ops/audit/usage-resets", label: "Usage resets" },
      ],
    };
  }
  if (pathname.startsWith("/ops/actions")) {
    if (!canAccessOpsWriteActionsArea(role)) return { title: "Actions", tabs: [] };
    return { title: "Actions", tabs: [] };
  }
  return null;
}

function tabIsActive(pathname: string, href: string): boolean {
  if (pathname === href) return true;
  return pathname.startsWith(`${href}/`);
}

export function OpsSectionTabs({ role }: { role: OpsRole }) {
  const pathname = usePathname() ?? "";
  const section = sectionForPath(pathname, role);

  if (!section) return null;

  return (
    <div className="crm-surface-raised mb-6 p-4 border border-[var(--crm-border)] rounded-[var(--crm-radius)]">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
        <h2 className="text-sm font-semibold text-[var(--crm-foreground)]">{section.title}</h2>
        <span className="text-xs text-[var(--crm-muted)] uppercase tracking-wide">{role}</span>
      </div>
      {section.tabs.length > 0 ? (
        <nav className="flex flex-wrap gap-2 border-t border-[var(--crm-border)] pt-3" aria-label="Section">
          {section.tabs.map((tab) => {
            const active = tabIsActive(pathname, tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`text-sm px-3 py-1.5 rounded-[var(--crm-radius)] border no-underline transition-colors ${
                  active
                    ? "border-[var(--crm-primary)] bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)]"
                    : "border-[var(--crm-border)] text-[var(--crm-foreground)] hover:bg-[var(--crm-accent)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
      ) : null}
    </div>
  );
}
