import { notFound } from "next/navigation";
import Link from "next/link";
import { createServerSupabase } from "@/lib/supabase/server";
import { SetupRequired } from "@/components/SetupRequired";
import { getTask } from "@/lib/tasks";
import { getCampaign } from "@/lib/campaigns";
import { countSubmissionsForCampaignParticipant, fetchSubmissionsForTask } from "@/lib/submissions";
import {
  parseAttestation,
  parseFollowRules,
  parseVerification,
} from "@/lib/followRules";
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

  const rulesForContext = campaignContext ? parseFollowRules(campaignContext.follow_rules) : null;
  const hasCampaignContext =
    campaignContext &&
    (campaignContext.campaign_objective ||
      (campaignContext.guidance_links?.length ?? 0) > 0 ||
      (campaignContext.required_platforms?.length ?? 0) > 0 ||
      (campaignContext.promoted_social_handles?.length ?? 0) > 0 ||
      campaignContext.weekly_required_posts != null ||
      campaignContext.daily_engagement_required ||
      (rulesForContext?.requiresFollow ?? false));

  let taskFollowContext:
    | {
        campaignId: string;
        mustFollowHandles: string[];
        notes?: string;
        submissionCount: number;
        enforceOnThisSubmit: boolean;
        attestationConfirmedAt: string | null;
        attestationHandles: string[];
        verificationStatus: string | null;
      }
    | null = null;

  if (task.campaign_id && campaignContext) {
    const rules = parseFollowRules(campaignContext.follow_rules);
    if (rules.requiresFollow) {
      const submissionCount = await countSubmissionsForCampaignParticipant(
        supabase,
        task.campaign_id,
        user.id
      );
      const { data: part } = await supabase
        .from("crm_campaign_participants")
        .select("x_follow_attestation, x_follow_verification")
        .eq("campaign_id", task.campaign_id)
        .eq("participant_profile_id", user.id)
        .maybeSingle();
      const verification = parseVerification(part?.x_follow_verification);
      const attestation = parseAttestation(part?.x_follow_attestation);
      const cleared = verification.status === "verified" || verification.status === "waived";
      taskFollowContext = {
        campaignId: task.campaign_id,
        mustFollowHandles: rules.mustFollowHandles,
        notes: rules.notes,
        submissionCount,
        enforceOnThisSubmit: submissionCount === 0 && !cleared,
        attestationConfirmedAt: attestation.confirmedAt,
        attestationHandles: attestation.followedHandles,
        verificationStatus: verification.status,
      };
    }
  }

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
              {rulesForContext?.requiresFollow && (
                <div>
                  <span className="font-medium text-[var(--crm-muted)]">X follow (first submission)</span>
                  <p className="text-[var(--crm-foreground)] mt-1">
                    You must follow the required account(s) on X before your first proof submission for this campaign.
                    Confirm follow on this task page when prompted.
                  </p>
                  {rulesForContext.mustFollowHandles.length > 0 && (
                    <ul className="mt-2 list-disc list-inside text-[var(--crm-foreground)]">
                      {rulesForContext.mustFollowHandles.map((h) => (
                        <li key={h}>@{h}</li>
                      ))}
                    </ul>
                  )}
                  {rulesForContext.notes && (
                    <p className="mt-2 text-[var(--crm-muted)]">{rulesForContext.notes}</p>
                  )}
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
          followContext={taskFollowContext}
        />
      </div>
    </div>
  );
}
