"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LayoutDashboard,
  ListTodo,
  Megaphone,
  LogOut,
} from "lucide-react";
import type { User } from "@supabase/supabase-js";

const nav = [
  { href: "/", label: "Home", icon: LayoutDashboard },
  { href: "/tasks", label: "My tasks", icon: ListTodo },
  { href: "/campaigns", label: "Campaigns (review & reports)", icon: Megaphone },
];

export function DashboardShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      <aside className="w-full lg:w-56 border-b lg:border-b-0 lg:border-r border-[var(--crm-border)] bg-[var(--crm-card)] p-4">
        <div className="flex items-center gap-2 mb-6">
          <span className="font-semibold text-[var(--crm-foreground)]">
            <span className="text-[var(--crm-primary)]">Linkary</span> CRM
          </span>
        </div>
        <nav className="space-y-1">
          {nav.map(({ href, label, icon: Icon }) => {
            const active = pathname === href || (href !== "/" && pathname.startsWith(href));
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-[var(--crm-primary)] text-[var(--crm-primary-foreground)]"
                    : "text-[var(--crm-muted)] hover:bg-[var(--crm-accent)] hover:text-[var(--crm-foreground)]"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto pt-6 border-t border-[var(--crm-border)] space-y-3">
          <p className="text-[10px] leading-snug text-[var(--crm-muted)] px-3">
            <strong className="text-[var(--crm-foreground)]">Linkary</strong> = profiles &amp; deals.
            <strong className="text-[var(--crm-foreground)]"> CRM</strong> = submit links &amp; track delivery after accepted work.
          </p>
          <p className="text-xs text-[var(--crm-muted)] truncate px-3 mb-2" title={user.email ?? undefined}>
            {user.email ?? user.id}
          </p>
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--crm-muted)] hover:bg-[var(--crm-accent)] hover:text-[var(--crm-foreground)]"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 p-3 sm:p-6 lg:p-10 overflow-auto min-w-0">
        {children}
      </main>
    </div>
  );
}
