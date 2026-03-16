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
    <div className="min-h-screen flex flex-col bg-[var(--crm-bg)]">
      <header className="border-b border-[var(--crm-border)] bg-[var(--crm-card)] px-4 py-3 flex items-center justify-between">
        <Link href="/" className="font-semibold text-[var(--crm-primary)]">
          Linkary CRM
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-[var(--crm-muted)] hover:bg-[var(--crm-border)] hover:text-[var(--crm-primary)]"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </button>
      </header>
      <main className="flex-1 p-6 flex items-center justify-center">
        {children}
      </main>
    </div>
  );
}
