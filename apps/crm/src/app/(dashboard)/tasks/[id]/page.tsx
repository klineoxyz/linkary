import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getTask } from "@/lib/tasks";
import { getCampaign } from "@/lib/campaigns";
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
  const [submissions, campaignContext] = await Promise.all([
    fetchSubmissionsForTask(supabase, task.id),
    task.campaign_id ? getCampaign(supabase, task.campaign_id) : null,
  ]);
  const sourceLabel =
    task.source_type === "manual"
      ? "Personal task"
      : "From campaign (Linkary)";

  const hasCampaignContext =
    campaignContext &&
    (campaignContext.campaign_objective ||
      (campaignContext.guidance_links?.length ?? 0) > 0 ||
      (campaignContext.required_platforms?.length ?? 0) > 0 ||
      (campaignContext.promoted_social_handles?.length ?? 0) > 0 ||
      campaignContext.weekly_required_posts != null ||
      campaignContext.daily_engagement_required);

  return (
    <div className="space-y-6 min-w-0 max-w-full px-1 sm:px-0">
      <Link
        href="/tasks"
        className="inline-flex items-center gap-2 text-sm font-medium text-[var(--crm-muted)] hover:text-[var(--crm-primary)]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to tasks
      </Link>

      <div className="crm-surface-raised p-4 sm:p-6 overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div className="min-w-0">
            <h1 className="text-lg sm:text-xl font-bold text-[var(--crm-foreground)] break-words">{task.title}</h1>
            <div className="flex flex-wrap gap-x-2 gap-y-1 mt-2 text-sm text-[var(--crm-muted)]">
              <span className="capitalize">Status: {task.status.replace(/_/g, " ")}</span>
              <span aria-hidden>•</span>
              <span>{sourceLabel}</span>
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

        {hasCampaignContext && campaignContext && (
          <div className="mt-6 pt-4 border-t border-[var(--crm-border)]">
            <h2 className="text-sm font-semibold text-[var(--crm-foreground)] mb-3">Campaign context</h2>
            <p className="text-xs text-[var(--crm-muted)] mb-3">Requirements and guidance for this campaign.</p>
            <div className="rounded-lg border border-[var(--crm-border)] bg-[var(--crm-bg)] p-4 space-y-3 text-sm">
              {campaignContext.campaign_objective && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">Objective: </span>
                  <span className="text-[var(--crm-foreground)]">{campaignContext.campaign_objective}</span>
                </div>
              )}
              {(campaignContext.required_platforms?.length ?? 0) > 0 && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">Platforms: </span>
                  <span className="text-[var(--crm-foreground)]">{campaignContext.required_platforms!.join(", ")}</span>
                </div>
              )}
              {campaignContext.weekly_required_posts != null && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">Weekly posts expected: </span>
                  <span className="text-[var(--crm-foreground)]">{campaignContext.weekly_required_posts}</span>
                </div>
              )}
              {campaignContext.daily_engagement_required && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">Daily engagement: </span>
                  <span className="text-[var(--crm-foreground)]">{campaignContext.daily_engagement_required}</span>
                </div>
              )}
              {(campaignContext.promoted_social_handles?.length ?? 0) > 0 && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">Accounts to promote: </span>
                  <ul className="mt-1 list-disc list-inside text-[var(--crm-foreground)]">
                    {campaignContext.promoted_social_handles!.map((h, i) => (
                      <li key={i}>{h.platform}: {h.handle}</li>
                    ))}
                  </ul>
                </div>
              )}
              {(campaignContext.guidance_links?.length ?? 0) > 0 && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">Guidance links</span>
                  <ul className="mt-2 space-y-1">
                    {campaignContext.guidance_links!.map((link, i) => (
                      <li key={i}>
                        <a
                          href={link.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--crm-primary)] underline break-all"
                        >
                          {link.label || link.url}
                        </a>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        )}

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
