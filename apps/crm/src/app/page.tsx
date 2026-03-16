import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { HomeShell } from "@/components/HomeShell";
import { resolveCrmAccess } from "@/lib/access";
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

  if (access.accessType === "creator_only") {
    redirect("/tasks");
  }

  if (access.accessType === "org_only") {
    redirect("/campaigns");
  }

  if (access.accessType === "both") {
    return (
      <HomeShell>
        <div className="w-full max-w-md rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 shadow-sm">
          <h1 className="text-xl font-semibold text-[var(--crm-primary)] mb-2">
            Choose workspace
          </h1>
          <p className="text-sm text-[var(--crm-muted)] mb-6">
            You have access to both your personal task board and org workspaces.
          </p>
          <div className="space-y-3">
            <Link
              href="/tasks"
              className="flex items-center gap-3 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] p-4 text-[var(--crm-primary)] hover:bg-[var(--crm-border)] transition-colors"
            >
              <LayoutDashboard className="h-5 w-5 shrink-0" />
              <div className="text-left">
                <span className="font-medium">My tasks</span>
                <p className="text-xs text-[var(--crm-muted)]">
                  Personal task board (creator)
                </p>
              </div>
            </Link>
            <Link
              href="/campaigns"
              className="flex items-center gap-3 rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] p-4 text-[var(--crm-primary)] hover:bg-[var(--crm-border)] transition-colors"
            >
              <Megaphone className="h-5 w-5 shrink-0" />
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

  // accessType === "none"
  return (
    <HomeShell>
      <div className="w-full max-w-md rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6 shadow-sm text-center">
        <h1 className="text-xl font-semibold text-[var(--crm-primary)] mb-2">
          No CRM access yet
        </h1>
        <p className="text-sm text-[var(--crm-muted)] mb-6">
          You don’t have access to any CRM workspace. Set up your personal task
          board to get started, or ask your org admin for access.
        </p>
        <div className="space-y-3">
          <Link
            href="/tasks"
            className="inline-flex items-center gap-2 rounded-lg bg-[var(--crm-primary)] px-4 py-2.5 text-sm font-medium text-white hover:opacity-90"
          >
            <ListTodo className="h-4 w-4" />
            Set up my task board
          </Link>
          <p className="text-xs text-[var(--crm-muted)]">
            This will create your creator workspace and personal board. You can
            add tasks and submit proof from there.
          </p>
        </div>
      </div>
    </HomeShell>
  );
}
