/**
 * CRM: Recurring task generation from campaign definition.
 * Uses workspace_id = operator; creates tasks on creator or org board per participant.
 * No auth/RLS/sync changes; call with appropriate Supabase client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type GenerateRecurringResult = {
  ok: boolean;
  tasks_created?: number;
  error?: string;
};

function startOfDayUtc(d: Date): string {
  const x = new Date(d);
  x.setUTCHours(0, 0, 0, 0);
  return x.toISOString();
}

function endOfDayUtc(d: Date): string {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x.toISOString();
}

/** Monday 00:00 UTC to Sunday 23:59 UTC. */
export function getWeekRangeUtc(forDate: Date): { weekStart: string; weekEnd: string } {
  const d = new Date(forDate);
  const day = d.getUTCDay();
  const toMonday = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + toMonday);
  const weekStart = startOfDayUtc(d);
  d.setUTCDate(d.getUTCDate() + 6);
  const weekEnd = endOfDayUtc(d);
  return { weekStart, weekEnd };
}

async function getOrCreateCampaignBoard(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string | null> {
  const { data: list } = await supabase
    .from("crm_boards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("kind", ["campaign", "ops"])
    .limit(1);
  const first = Array.isArray(list) ? list[0] : list;
  if (first && (first as { id?: string }).id) return (first as { id: string }).id;
  const { data: inserted, error } = await supabase
    .from("crm_boards")
    .insert({
      workspace_id: workspaceId,
      name: "Campaign tasks",
      kind: "campaign",
    })
    .select("id")
    .single();
  if (error || !inserted?.id) return null;
  return inserted.id as string;
}

async function getBoardIdForParticipant(
  supabase: SupabaseClient,
  workspaceId: string,
  participantProfileId: string
): Promise<{ boardId: string; taskWorkspaceId: string } | null> {
  const { data: creatorWs } = await supabase
    .from("crm_workspaces")
    .select("id")
    .eq("owner_profile_id", participantProfileId)
    .eq("type", "creator")
    .maybeSingle();

  if (creatorWs?.id) {
    const { data: creatorBoard } = await supabase
      .from("crm_boards")
      .select("id")
      .eq("workspace_id", creatorWs.id)
      .eq("kind", "personal")
      .maybeSingle();
    if (creatorBoard?.id) {
      return {
        boardId: creatorBoard.id as string,
        taskWorkspaceId: creatorWs.id as string,
      };
    }
  }

  const boardId = await getOrCreateCampaignBoard(supabase, workspaceId);
  if (!boardId) return null;
  return { boardId, taskWorkspaceId: workspaceId };
}

/**
 * Generate recurring tasks for a campaign for the given week.
 * Uses campaign definition: weekly_required_posts, daily_engagement_required, required_platforms.
 * Idempotent: only creates missing tasks per bundle.
 */
export async function generateRecurringTasksForCampaignWeek(
  supabase: SupabaseClient,
  campaignId: string,
  options?: { weekStart?: string; weekEnd?: string }
): Promise<GenerateRecurringResult> {
  const { weekStart, weekEnd } = options?.weekStart && options?.weekEnd
    ? { weekStart: options.weekStart, weekEnd: options.weekEnd }
    : getWeekRangeUtc(new Date());

  const { data: campaign, error: campErr } = await supabase
    .from("crm_campaigns")
    .select("id, workspace_id, weekly_required_posts, daily_engagement_required, required_platforms")
    .eq("id", campaignId)
    .single();

  if (campErr || !campaign?.id) {
    return { ok: false, error: "Campaign not found" };
  }

  const workspaceId = (campaign as { workspace_id: string }).workspace_id;
  const weeklyRequired = (campaign as { weekly_required_posts?: number | null }).weekly_required_posts ?? 0;
  const dailyRequired = (campaign as { daily_engagement_required?: string | null }).daily_engagement_required;
  const platforms = (campaign as { required_platforms?: string[] | null }).required_platforms ?? [];

  if (weeklyRequired <= 0 && !dailyRequired) {
    return { ok: false, error: "Campaign has no recurring definition (set weekly required posts or daily engagement)" };
  }

  const { data: bundles, error: bundleErr } = await supabase
    .from("crm_task_bundles")
    .select("id, participant_profile_id")
    .eq("campaign_id", campaignId);

  if (bundleErr || !bundles?.length) {
    return { ok: true, tasks_created: 0 };
  }

  let tasksCreated = 0;
  const weekEndDate = new Date(weekEnd);

  for (const bundle of bundles as { id: string; participant_profile_id: string }[]) {
    const boardInfo = await getBoardIdForParticipant(
      supabase,
      workspaceId,
      bundle.participant_profile_id
    );
    if (!boardInfo) continue;

    if (weeklyRequired > 0) {
      const { count } = await supabase
        .from("crm_tasks")
        .select("id", { count: "exact", head: true })
        .eq("task_bundle_id", bundle.id)
        .eq("deliverable_type", "weekly_post")
        .gte("due_at", weekStart)
        .lte("due_at", weekEnd);

      const existing = count ?? 0;
      const toCreate = Math.max(0, weeklyRequired - existing);
      const platform = platforms[0] ?? null;

      for (let i = 0; i < toCreate; i++) {
        const { error: insertErr } = await supabase.from("crm_tasks").insert({
          workspace_id: boardInfo.taskWorkspaceId,
          board_id: boardInfo.boardId,
          campaign_id: campaignId,
          task_bundle_id: bundle.id,
          source_type: "sprint_auto",
          deliverable_type: "weekly_post",
          title: `Weekly post ${existing + i + 1} (week of ${weekStart.slice(0, 10)})`,
          description: null,
          platform,
          due_at: weekEndDate.toISOString(),
          status: "to_do",
          priority: "medium",
          assigned_to: bundle.participant_profile_id,
          created_by: null,
        });
        if (!insertErr) tasksCreated++;
      }
    }

    if (dailyRequired) {
      const dayStart = new Date(weekStart);
      for (let i = 0; i < 7; i++) {
        const d = new Date(dayStart);
        d.setUTCDate(d.getUTCDate() + i);
        const dueAt = startOfDayUtc(d);
        const { data: existingDaily } = await supabase
          .from("crm_tasks")
          .select("id")
          .eq("task_bundle_id", bundle.id)
          .eq("deliverable_type", "daily_engagement")
          .gte("due_at", dueAt)
          .lt("due_at", new Date(d.getTime() + 86400000).toISOString())
          .limit(1)
          .maybeSingle();

        if (existingDaily?.id) continue;

        const { error: insertErr } = await supabase.from("crm_tasks").insert({
          workspace_id: boardInfo.taskWorkspaceId,
          board_id: boardInfo.boardId,
          campaign_id: campaignId,
          task_bundle_id: bundle.id,
          source_type: "sprint_auto",
          deliverable_type: "daily_engagement",
          title: "Daily engagement",
          description: dailyRequired,
          platform: null,
          due_at: dueAt,
          status: "to_do",
          priority: "medium",
          assigned_to: bundle.participant_profile_id,
          created_by: null,
        });
        if (!insertErr) tasksCreated++;
      }
    }
  }

  return { ok: true, tasks_created: tasksCreated };
}
