import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { createServiceSupabase } from "@/lib/supabase/admin";
import { SetupRequired } from "@/components/SetupRequired";
import { HomeShell } from "@/components/HomeShell";
import { resolveCrmAccess } from "@/lib/access";
import { getOpsMembershipRole } from "@/lib/internalOps";
import { ListTodo, Megaphone, LayoutDashboard } from "lucide-react";

export default async function HomePage() {
  const supabase = await createServerSupabase();
  if (!supabase) {
    return <SetupRequired />;
  }

  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    redirect("/login");
  }

  const access = await resolveCrmAccess(supabase, session.user.id);

  if (access.accessType === "none") {
    const service = createServiceSupabase();
    if (service) {
      const opsRole = await getOpsMembershipRole(service, session.user.id);
      if (opsRole) {
        redirect("/ops/overview");
      }
    }
  }

  if (access.accessType === "creator_only") {
    redirect("/tasks");
  }

  if (access.accessType === "org_only") {
    redirect("/campaigns");
  }

  if (access.accessType === "both") {
    return (
      <HomeShell>
        <div className="crm-surface-raised w-full max-w-md p-6 sm:p-8">
          <h1 className="crm-page-title mb-1">Choose workspace</h1>
          <p className="crm-page-subtitle mb-6">
            Personal tasks and org campaigns use the same Linkary account.
          </p>
          <div className="space-y-3">
            <Link
              href="/tasks"
              className="crm-surface-card flex items-center gap-3 p-4 text-[var(--crm-foreground)] hover:border-[var(--crm-primary)]/30 transition-colors no-underline"
            >
              <LayoutDashboard className="h-5 w-5 shrink-0 text-[var(--crm-primary)]" />
              <div className="text-left">
                <span className="font-medium">My tasks</span>
                <p className="text-xs text-[var(--crm-muted)]">
                  Personal task board (creator)
                </p>
              </div>
            </Link>
            <Link
              href="/campaigns"
              className="crm-surface-card flex items-center gap-3 p-4 text-[var(--crm-foreground)] hover:border-[var(--crm-primary)]/30 transition-colors no-underline"
            >
              <Megaphone className="h-5 w-5 shrink-0 text-[var(--crm-primary)]" />
              <div className="text-left">
                <span className="font-medium">Campaigns</span>
                <p className="text-xs text-[var(--crm-muted)]">
                  Org / project campaigns dashboard
                </p>
              </div>
            </Link>
          </div>
        </div>
      </HomeShell>
    );
  }

  // accessType === "none" — no CRM workspaces yet; only eligible users can bootstrap creator
  return (
    <HomeShell>
      <div className="crm-surface-raised w-full max-w-md p-8 text-center">
        <div className="flex justify-center mb-4">
          <ListTodo className="h-12 w-12 text-[var(--crm-primary)]" aria-hidden />
        </div>
        <h1 className="text-xl font-semibold text-[var(--crm-foreground)] mb-2">
          Get your personal task board
        </h1>
        <p className="text-sm text-[var(--crm-muted)] mb-6">
          You don’t have a task board yet. Click below to create one — you’ll be able to add and manage tasks right away.
        </p>
        <Link href="/tasks" className="crm-btn-primary px-6 py-2.5 no-underline">
          <ListTodo className="h-4 w-4" />
          Create my task board
        </Link>
        <p className="text-xs text-[var(--crm-muted)] mt-6">
          Individual creator accounts get a personal board. Org or project accounts should use Campaigns or request access from an admin.
        </p>
      </div>
    </HomeShell>
  );
}
