import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getTask } from "@/lib/tasks";
import { fetchSubmissionsForTask } from "@/lib/submissions";
import { TaskDetailClient } from "./TaskDetailClient";
import { ArrowLeft } from "lucide-react";

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const supabase = await createServerSupabase();
  if (!supabase) return <SetupRequired />;

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) notFound();

  const { id } = await params;
  const data = await getTask(supabase, id);
  if (!data) notFound();

  const { task } = data;
  const isManual = task.source_type === "manual";
  const submissions = await fetchSubmissionsForTask(supabase, task.id);

  return (
    <div className="space-y-6">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tasks
      </Link>

      <div className="rounded-xl border border-[var(--crm-border)] bg-[var(--crm-card)] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-[var(--crm-foreground)]">{task.title}</h1>
            <div className="flex flex-wrap gap-2 mt-2 text-sm text-[var(--crm-muted)]">
              <span>Status: {task.status.replace("_", " ")}</span>
              <span>•</span>
              <span>Source: {task.source_type.replace("_", " ")}</span>
              {task.platform && (
                <>
                  <span>•</span>
                  <span>Platform: {task.platform}</span>
                </>
              )}
            </div>
          </div>
        </div>

        <dl className="grid gap-3 text-sm">
          {task.campaign_title && (
            <>
              <dt className="font-medium text-[var(--crm-muted)]">Campaign</dt>
              <dd className="text-[var(--crm-primary)]">{task.campaign_title}</dd>
            </>
          )}
          {task.task_bundle_title && (
            <>
              <dt className="font-medium text-[var(--crm-muted)]">Task bundle</dt>
              <dd className="text-[var(--crm-foreground)]">{task.task_bundle_title}</dd>
            </>
          )}
          <dt className="font-medium text-[var(--crm-muted)]">Due date</dt>
          <dd className="text-[var(--crm-primary)]">
            {task.due_at
              ? new Date(task.due_at).toLocaleDateString(undefined, {
                  dateStyle: "medium",
                })
              : "—"}
          </dd>
          {task.description && (
            <>
              <dt className="font-medium text-[var(--crm-muted)]">Description</dt>
              <dd className="text-[var(--crm-foreground)] whitespace-pre-wrap">{task.description}</dd>
            </>
          )}
        </dl>

        <TaskDetailClient
          taskId={task.id}
          currentStatus={task.status}
          isManual={isManual}
          initialTitle={task.title}
          initialDescription={task.description ?? ""}
          initialPlatform={task.platform ?? ""}
          initialDueAt={task.due_at ?? ""}
          submissions={submissions}
        />
      </div>
    </div>
  );
}
