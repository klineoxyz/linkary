"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { LogOut } from "lucide-react";

/**
 * Minimal shell for CRM home when showing switcher or no-access (no dashboard sidebar).
 */
export function HomeShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="min-h-screen flex flex-col bg-[var(--crm-page-bg)]">
      <header className="border-b border-[var(--crm-border)] bg-[var(--crm-sidebar-bg)] px-4 py-3.5 flex items-center justify-between shadow-[var(--crm-shadow-sm)]">
        <Link href="/" className="font-semibold text-[var(--crm-foreground)] tracking-tight">
          <span className="text-[var(--crm-primary)]">Linkary</span>
          <span className="text-[var(--crm-muted)] font-medium"> CRM</span>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-[var(--crm-radius)] px-3 py-2 text-sm text-[var(--crm-muted)] hover:bg-[var(--crm-banner-muted)] hover:text-[var(--crm-foreground)] transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </header>
      <main className="flex-1 p-4 sm:p-8 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}
