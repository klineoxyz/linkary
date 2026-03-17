import { redirect } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { resolveCrmAccess, canBootstrapCreatorWorkspace } from "@/lib/access";
import { getOrCreateCreatorWorkspaceAndBoard, workspaceBootstrapMessage } from "@/lib/workspace";
import { fetchTasks } from "@/lib/tasks";
import type { TaskFilter } from "@/lib/tasks";
import { TasksList } from "./TasksList";
import { TasksFilters } from "./TasksFilters";
import { CreateTaskButton } from "./CreateTaskButton";

const VALID_FILTERS: TaskFilter[] = [
  "all",
  "this_week",
  "overdue",
  "campaign",
  "submitted",
  "approved",
];

/** No-access state: user is not eligible for creator workspace and has none. */
function TasksNoAccess() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center space-y-4">
        <p className="text-[var(--crm-foreground)] font-medium">
          You don’t have access to a personal task board
        </p>
        <p className="text-sm text-[var(--crm-muted)] max-w-md mx-auto">
          Only individual creator accounts can create one. If you have org or campaign access, use{" "}
          <Link href="/campaigns" className="underline text-[var(--crm-primary)]">
            Campaigns
          </Link>{" "}
          from the sidebar or{" "}
          <Link href="/" className="underline text-[var(--crm-primary)]">
            home
          </Link>.
        </p>
      </div>
    </div>
  );
}

export default async function TasksPage({
  searchParams,
}: {
  searchParams: Promise<{ filter?: string }>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) redirect("/login");

  const access = await resolveCrmAccess(supabase, user.id);
  const hasCreatorWorkspace = !!access.creatorWorkspace;
  const eligibleToBootstrap = await canBootstrapCreatorWorkspace(supabase, user.id);

  if (!hasCreatorWorkspace && !eligibleToBootstrap) {
    return <TasksNoAccess />;
  }

  const wsResult = await getOrCreateCreatorWorkspaceAndBoard(supabase, user.id);
  if (!wsResult || "error" in wsResult) {
    const reason = wsResult && "error" in wsResult ? wsResult.error : "unknown";
    const { message, hint } = workspaceBootstrapMessage(reason);
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center space-y-2">
          <p className="text-[var(--crm-foreground)]">{message}</p>
          {hint && <p className="text-sm text-[var(--crm-muted)]">{hint}</p>}
        </div>
      </div>
    );
  }
  const ws = wsResult;

  const params = await searchParams;
  const filterRaw = params.filter ?? "all";
  const filter: TaskFilter = VALID_FILTERS.includes(filterRaw as TaskFilter)
    ? (filterRaw as TaskFilter)
    : "all";

  const tasks = await fetchTasks(supabase, ws.boardId, filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--crm-foreground)]">Tasks</h1>
        <CreateTaskButton />
      </div>
      <TasksFilters />
      <TasksList tasks={tasks} />
    </div>
  );
}
