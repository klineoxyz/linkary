/**
 * CRM: Idempotent Linkary → CRM sync. Creates/upserts campaign, participant, task bundle, tasks.
 * Uses source identifiers to avoid duplicates when sync is triggered multiple times.
 * Call from API route only, with service-role client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type LinkarySyncTask = {
  linkary_task_id: string;
  title: string;
  description?: string | null;
  platform?: string | null;
};

export type LinkarySyncPayload = {
  workspace_id: string;
  source_linkary_campaign_id: string;
  campaign_title?: string;
  participant_profile_id: string;
  tasks: LinkarySyncTask[];
};

export type LinkarySyncResult = {
  ok: boolean;
  campaign_id?: string;
  task_bundle_id?: string;
  tasks_created?: number;
  error?: string;
};

/**
 * Get or create a board for the workspace (kind 'campaign' or 'ops'). Used for synced tasks.
 */
async function getOrCreateOrgBoard(
  supabase: SupabaseClient,
  workspaceId: string
): Promise<string | null> {
  const { data: existingList } = await supabase
    .from("crm_boards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .in("kind", ["campaign", "ops"])
    .limit(1);
  const existing = Array.isArray(existingList) ? existingList[0] : existingList;

  if (existing && (existing as { id?: string }).id) return (existing as { id: string }).id;

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

/**
 * Idempotent sync: create or upsert campaign, participant, task bundle, and tasks.
 * Uses source_linkary_campaign_id for campaign; (campaign_id, participant_profile_id) for participant and bundle;
 * (task_bundle_id, metadata->>'linkary_task_id') for task deduplication.
 */
export async function runLinkarySync(
  supabase: SupabaseClient,
  payload: LinkarySyncPayload
): Promise<LinkarySyncResult> {
  const {
    workspace_id,
    source_linkary_campaign_id,
    campaign_title,
    participant_profile_id,
    tasks,
  } = payload;

  if (!workspace_id || !source_linkary_campaign_id || !participant_profile_id) {
    return { ok: false, error: "workspace_id, source_linkary_campaign_id, and participant_profile_id are required" };
  }

  const taskList = Array.isArray(tasks) ? tasks : [];
  if (taskList.length === 0) {
    return { ok: false, error: "At least one task is required" };
  }

  let campaignId: string;

  const { data: existingCampaign } = await supabase
    .from("crm_campaigns")
    .select("id")
    .eq("workspace_id", workspace_id)
    .eq("source_linkary_campaign_id", source_linkary_campaign_id)
    .maybeSingle();

  if (existingCampaign?.id) {
    campaignId = existingCampaign.id as string;
    if (campaign_title) {
      await supabase
        .from("crm_campaigns")
        .update({ title: campaign_title, updated_at: new Date().toISOString() })
        .eq("id", campaignId);
    }
  } else {
    const { data: insertedCampaign, error: campErr } = await supabase
      .from("crm_campaigns")
      .insert({
        workspace_id,
        source_linkary_campaign_id,
        title: campaign_title ?? "Synced campaign",
        status: "active",
      })
      .select("id")
      .single();

    if (campErr || !insertedCampaign?.id) {
      return { ok: false, error: campErr?.message ?? "Failed to create campaign" };
    }
    campaignId = insertedCampaign.id as string;
  }

  const { data: existingParticipant } = await supabase
    .from("crm_campaign_participants")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("participant_profile_id", participant_profile_id)
    .maybeSingle();

  if (!existingParticipant?.id) {
    const { error: partErr } = await supabase.from("crm_campaign_participants").insert({
      campaign_id: campaignId,
      participant_profile_id,
      role: "contributor",
      status: "accepted",
      accepted_at: new Date().toISOString(),
    });
    if (partErr) {
      return { ok: false, campaign_id: campaignId, error: partErr.message };
    }
  }

  const { data: existingBundle } = await supabase
    .from("crm_task_bundles")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("participant_profile_id", participant_profile_id)
    .maybeSingle();

  let taskBundleId: string;
  if (existingBundle?.id) {
    taskBundleId = existingBundle.id as string;
  } else {
    const { data: insertedBundle, error: bundleErr } = await supabase
      .from("crm_task_bundles")
      .insert({
        workspace_id,
        campaign_id: campaignId,
        participant_profile_id,
        title: "Synced bundle",
        expected_task_count: taskList.length,
      })
      .select("id")
      .single();

    if (bundleErr || !insertedBundle?.id) {
      return { ok: false, campaign_id: campaignId, error: bundleErr?.message ?? "Failed to create task bundle" };
    }
    taskBundleId = insertedBundle.id as string;
  }

  // Prefer creator's personal board so tasks appear on /tasks for the participant
  const { data: creatorWs } = await supabase
    .from("crm_workspaces")
    .select("id")
    .eq("owner_profile_id", participant_profile_id)
    .eq("type", "creator")
    .maybeSingle();

  let boardId: string | null = null;
  let taskWorkspaceId = workspace_id;

  if (creatorWs?.id) {
    const { data: creatorBoard } = await supabase
      .from("crm_boards")
      .select("id")
      .eq("workspace_id", creatorWs.id)
      .eq("kind", "personal")
      .maybeSingle();
    if (creatorBoard?.id) {
      boardId = creatorBoard.id as string;
      taskWorkspaceId = creatorWs.id as string;
    }
  }

  if (!boardId) {
    boardId = await getOrCreateOrgBoard(supabase, workspace_id);
  }
  if (!boardId) {
    return { ok: false, campaign_id: campaignId, task_bundle_id: taskBundleId, error: "Failed to get or create board" };
  }

  let tasksCreated = 0;
  for (const task of taskList) {
    const linkaryTaskId = task.linkary_task_id ?? task.title;
    const { data: existingTask } = await supabase
      .from("crm_tasks")
      .select("id")
      .eq("task_bundle_id", taskBundleId)
      .eq("metadata->>linkary_task_id", linkaryTaskId)
      .maybeSingle();

    if (existingTask?.id) continue;

    const { error: taskErr } = await supabase.from("crm_tasks").insert({
      workspace_id: taskWorkspaceId,
      board_id: boardId,
      campaign_id: campaignId,
      task_bundle_id: taskBundleId,
      source_type: "sprint_auto",
      title: task.title,
      description: task.description ?? null,
      platform: task.platform ?? null,
      status: "to_do",
      priority: "medium",
      assigned_to: participant_profile_id,
      created_by: participant_profile_id,
      metadata: { linkary_task_id: linkaryTaskId },
    });

    if (taskErr) {
      return {
        ok: false,
        campaign_id: campaignId,
        task_bundle_id: taskBundleId,
        tasks_created: tasksCreated,
        error: taskErr.message,
      };
    }
    tasksCreated++;
  }

  return {
    ok: true,
    campaign_id: campaignId,
    task_bundle_id: taskBundleId,
    tasks_created: tasksCreated,
  };
}
