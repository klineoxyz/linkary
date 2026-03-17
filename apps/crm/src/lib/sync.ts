/**
 * CRM: Idempotent Linkary → CRM sync. Creates/upserts campaign, participant, task bundle, tasks.
 * Uses source identifiers to avoid duplicates. Call from API route only, with service-role client.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { canBootstrapCreatorWorkspace } from "@/lib/access";
import { getOrCreateCreatorWorkspaceAndBoard } from "@/lib/workspace";

export type LinkarySyncTask = {
  linkary_task_id: string;
  title: string;
  description?: string | null;
  platform?: string | null;
};

/** workspace_id or org_id (Linkary org uuid); CRM resolves workspace from org via crm_workspaces.linked_org_id. */
export type LinkarySyncPayload = {
  workspace_id?: string;
  org_id?: string;
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

const ORG_WORKSPACE_TYPES = ["org", "project", "brand", "agency"] as const;

/**
 * Resolve CRM workspace id from Linkary org id. Source of truth: crm_workspaces.linked_org_id.
 * When creating an org workspace in CRM, set linked_org_id to the Linkary org id so this resolution works.
 */
export async function getCrmWorkspaceIdByOrgId(
  supabase: SupabaseClient,
  orgId: string
): Promise<string | null> {
  const { data } = await supabase
    .from("crm_workspaces")
    .select("id")
    .eq("linked_org_id", orgId)
    .in("type", ORG_WORKSPACE_TYPES)
    .limit(1)
    .maybeSingle();

  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Ensure profile is a member of the workspace so they can see tasks on the org board (fallback when not eligible for creator workspace).
 */
async function ensureWorkspaceMember(
  supabase: SupabaseClient,
  workspaceId: string,
  profileId: string
): Promise<{ error?: string }> {
  const { data: existing } = await supabase
    .from("crm_workspace_members")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (existing?.id) return {};

  const { error } = await supabase.from("crm_workspace_members").insert({
    workspace_id: workspaceId,
    profile_id: profileId,
    role: "member",
  });
  if (error) return { error: error.message };
  return {};
}

async function getOrCreateOrgBoard(
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

/**
 * Validate payload and resolve workspace_id. Returns [workspace_id, error].
 */
async function resolveWorkspaceAndValidate(
  supabase: SupabaseClient,
  payload: LinkarySyncPayload
): Promise<[string | null, string | null]> {
  const { workspace_id, org_id, source_linkary_campaign_id, participant_profile_id, tasks } = payload;

  if (typeof source_linkary_campaign_id !== "string" || !source_linkary_campaign_id.trim()) {
    return [null, "source_linkary_campaign_id is required"];
  }
  if (typeof participant_profile_id !== "string" || !participant_profile_id.trim()) {
    return [null, "participant_profile_id is required"];
  }
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return [null, "At least one task is required"];
  }
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t || typeof t !== "object" || typeof (t as LinkarySyncTask).title !== "string" || !(t as LinkarySyncTask).title.trim()) {
      return [null, `tasks[${i}].title is required`];
    }
    const lid = (t as LinkarySyncTask).linkary_task_id;
    if (lid !== undefined && (typeof lid !== "string" || !lid.trim())) {
      return [null, `tasks[${i}].linkary_task_id must be a non-empty string when provided`];
    }
  }

  let workspaceId: string | null = null;
  if (workspace_id && typeof workspace_id === "string" && workspace_id.trim()) {
    workspaceId = workspace_id.trim();
  } else if (org_id && typeof org_id === "string" && org_id.trim()) {
    workspaceId = await getCrmWorkspaceIdByOrgId(supabase, org_id.trim());
    if (!workspaceId) {
      return [null, "No CRM workspace linked to this org; create an org workspace in CRM with linked_org_id set"];
    }
  }
  if (!workspaceId) {
    return [null, "Either workspace_id or org_id is required"];
  }
  return [workspaceId, null];
}

/**
 * Idempotent sync: create or upsert campaign, participant, task bundle, and tasks.
 * Creator task visibility: if participant is eligible for creator workspace, bootstrap and put tasks on creator board; else add as org workspace member and put tasks on org board.
 */
export async function runLinkarySync(
  supabase: SupabaseClient,
  payload: LinkarySyncPayload
): Promise<LinkarySyncResult> {
  const [workspace_id, validationError] = await resolveWorkspaceAndValidate(supabase, payload);
  if (validationError || !workspace_id) {
    return { ok: false, error: validationError ?? "Invalid payload" };
  }

  const {
    source_linkary_campaign_id,
    campaign_title,
    participant_profile_id,
    tasks: taskListRaw,
  } = payload;

  const taskList = taskListRaw.map((t) => ({
    linkary_task_id: (t as LinkarySyncTask).linkary_task_id ?? (t as LinkarySyncTask).title,
    title: (t as LinkarySyncTask).title.trim(),
    description: (t as LinkarySyncTask).description ?? null,
    platform: (t as LinkarySyncTask).platform ?? null,
  }));

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
      return { ok: false, error: "Failed to create campaign" };
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
      return { ok: false, campaign_id: campaignId, error: "Failed to add participant" };
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
      return { ok: false, campaign_id: campaignId, error: "Failed to create task bundle" };
    }
    taskBundleId = insertedBundle.id as string;
  }

  // Prefer creator's personal board so tasks appear on /tasks
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
    const eligible = await canBootstrapCreatorWorkspace(supabase, participant_profile_id);
    if (eligible) {
      const creatorBoard = await getOrCreateCreatorWorkspaceAndBoard(supabase, participant_profile_id);
      if (creatorBoard) {
        boardId = creatorBoard.boardId;
        taskWorkspaceId = creatorBoard.workspaceId;
      }
    }
  }

  if (!boardId) {
    const ensure = await ensureWorkspaceMember(supabase, workspace_id, participant_profile_id);
    if (ensure.error) {
      return { ok: false, campaign_id: campaignId, task_bundle_id: taskBundleId, error: "Failed to add participant to workspace" };
    }
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
        error: "Failed to create task",
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
