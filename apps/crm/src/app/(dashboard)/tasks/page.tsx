import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getOrCreateCreatorWorkspaceAndBoard } from "@/lib/workspace";
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

  const ws = await getOrCreateCreatorWorkspaceAndBoard(supabase, user.id);
  if (!ws) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-[var(--crm-primary)]">Tasks</h1>
        <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-8 text-center text-[var(--crm-muted)]">
          Could not load workspace. Try signing out and back in.
        </div>
      </div>
    );
  }

  const params = await searchParams;
  const filterRaw = params.filter ?? "all";
  const filter: TaskFilter = VALID_FILTERS.includes(filterRaw as TaskFilter)
    ? (filterRaw as TaskFilter)
    : "all";

  const tasks = await fetchTasks(supabase, ws.boardId, filter);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-[var(--crm-primary)]">Tasks</h1>
        <CreateTaskButton />
      </div>
      <TasksFilters />
      <TasksList tasks={tasks} />
    </div>
  );
}
