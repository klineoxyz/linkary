import Link from "next/link";

const links = [
  { href: "/ops/overview/launch-diagnostics", label: "Launch diagnostics", hint: "Ingestion freshness, jobs, env flags" },
  { href: "/ops/overview/activation-funnel", label: "Activation funnel", hint: "Sign-in → profile → X → analytics → marketplace → campaign" },
  { href: "/ops/reports/snapshot", label: "Platform snapshot", hint: "Counts, subs, proxy ratios" },
  { href: "/ops/reports/growth", label: "Platform growth", hint: "New entities, status breakdowns" },
  { href: "/ops/reports/monetization", label: "Subscription & monetization", hint: "Plan mix + budget proxy" },
  { href: "/ops/reports/projects", label: "Project reports", hint: "Org / workspace campaign density" },
  { href: "/ops/reports/campaigns", label: "Campaign reports", hint: "Per-campaign funnel counts" },
  { href: "/ops/reports/creators", label: "Creators & participants", hint: "Reliability + drill-down" },
  { href: "/ops/reports/discounts", label: "Discount / comp usage", hint: "platform_ops_entitlements" },
  { href: "/ops/users/profiles", label: "Profiles", hint: "PII — handle carefully" },
  { href: "/ops/campaigns/campaigns", label: "Campaigns", hint: "Workspace + org plan" },
  { href: "/ops/audit/platform", label: "Platform audit", hint: "platform_audit_log" },
  { href: "/ops/actions", label: "Actions", hint: "Audited writes (role-gated)" },
] as const;

export default function OpsOverviewQuickLinksPage() {
  return (
    <div className="space-y-8">
      <header className="crm-page-header">
        <h1 className="crm-page-title">Quick links</h1>
        <p className="crm-page-subtitle">Jump into the nested ops workspace without using the sidebar.</p>
      </header>

      <ul className="grid gap-3 sm:grid-cols-2">
        {links.map((l) => (
          <li key={l.href}>
            <Link
              href={l.href}
              className="block crm-surface-raised p-4 rounded-[var(--crm-radius)] border border-[var(--crm-border)] hover:border-[var(--crm-primary)]/40 transition-colors no-underline"
            >
              <span className="text-sm font-semibold text-[var(--crm-foreground)]">{l.label}</span>
              <span className="block text-xs text-[var(--crm-muted)] mt-1">{l.hint}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
