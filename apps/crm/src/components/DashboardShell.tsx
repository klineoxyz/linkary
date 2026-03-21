"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ListTodo,
  Megaphone,
  LogOut,
  Shield,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "My tasks", icon: ListTodo },
  { href: "/campaigns", label: "Campaigns (review & reports)", icon: Megaphone },
];

const opsNav = [
  { href: "/ops/overview", label: "Overview" },
  { href: "/ops/campaigns", label: "Campaigns" },
  { href: "/ops/users", label: "Users" },
  { href: "/ops/audit", label: "Audit log" },
  { href: "/ops/actions", label: "Write actions" },
];

export function DashboardShell({
  user,
  children,
  showOpsNav = false,
}: {
  user: User;
  children: React.ReactNode;
  /** Server-computed: internal_ops_members active row for this user. */
  showOpsNav?: boolean;
}) {
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[var(--crm-page-bg)]">
      <aside className="w-full lg:w-[15.5rem] shrink-0 border-b lg:border-b-0 lg:border-r border-[var(--crm-border)] bg-[var(--crm-sidebar-bg)] p-4 lg:min-h-screen lg:flex lg:flex-col shadow-[var(--crm-shadow-sm)] lg:shadow-none">
        <div className="mb-6">
          <span className="font-semibold text-[var(--crm-foreground)] tracking-tight block">
            <span className="text-[var(--crm-primary)]">Linkary</span>
            <span className="text-[var(--crm-muted)] font-medium"> CRM</span>
          </span>
          <span className="text-[10px] uppercase tracking-wider text-[var(--crm-muted)] mt-1 block">
            Delivery workspace
          </span>
        </div>
        <nav className="space-y-0.5 flex-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2.5 rounded-[var(--crm-radius)] px-3 py-2.5 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)] shadow-sm"
                    : "text-[var(--crm-muted)] hover:bg-[var(--crm-accent)] hover:text-[var(--crm-foreground)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0 opacity-90" />
                <span className="leading-snug">{label}</span>
              </Link>
            );
          })}
          {showOpsNav ? (
            <div className="pt-2 border-t border-[var(--crm-border)] mt-2 space-y-0.5">
              <p className="px-3 pt-1 pb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--crm-muted)] flex items-center gap-2">
                <Shield className="h-3.5 w-3.5 opacity-80" aria-hidden />
                Ops
              </p>
              {opsNav.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex items-center gap-2 rounded-[var(--crm-radius)] px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-[var(--crm-accent)] text-[var(--crm-foreground)]"
                        : "text-[var(--crm-muted)] hover:bg-[var(--crm-accent)] hover:text-[var(--crm-foreground)]"
                    }`}
                  >
                    <span className="leading-snug">{label}</span>
                  </Link>
                );
              })}
            </div>
          ) : null}
        </nav>
        <div className="mt-8 pt-5 border-t border-[var(--crm-border)] space-y-3">
          <p className="text-[10px] leading-relaxed text-[var(--crm-muted)] px-1">
            Same account as <span className="text-[var(--crm-foreground)] font-medium">linkary.xyz</span>.
            Profiles &amp; deals there — task delivery here.
          </p>
          <p className="text-xs text-[var(--crm-muted)] truncate px-1" title={user.email ?? undefined}>
            {user.email ?? user.id}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-[var(--crm-radius)] px-3 py-2 text-sm text-[var(--crm-muted)] hover:bg-[var(--crm-banner-muted)] hover:text-[var(--crm-foreground)] transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-4 sm:p-6 lg:p-8 xl:p-10 overflow-auto min-w-0 max-w-[1600px]">
        {children}
      </main>
    </div>
  );
}
