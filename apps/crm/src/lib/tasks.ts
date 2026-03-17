/**
 * CRM: Task CRUD and list. RLS-safe via Supabase client (session).
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type TaskFilter =
  | "all"
  | "this_week"
  | "overdue"
  | "campaign"
  | "submitted"
  | "approved";

/** Structured deliverable type for campaign tasks. */
export type DeliverableType = "one_off" | "weekly_post" | "daily_engagement" | "custom";

export type TaskRow = {
  id: string;
  workspace_id: string;
  board_id: string;
  campaign_id: string | null;
  task_bundle_id: string | null;
  source_type: string;
  title: string;
  description: string | null;
  platform: string | null;
  status: string;
  priority: string | null;
  due_at: string | null;
  created_by: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
  campaign_title?: string | null;
  task_bundle_title?: string | null;
  deliverable_type?: DeliverableType | string | null;
};

function startOfTodayUtc(): string {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d.toISOString();
}

function endOfWeekUtc(): string {
  const d = new Date();
  const day = d.getUTCDay();
  const toSunday = day === 0 ? 0 : 7 - day;
  d.setUTCDate(d.getUTCDate() + toSunday);
  d.setUTCHours(23, 59, 59, 999);
  return d.toISOString();
}

export async function fetchTasks(
  supabase: SupabaseClient,
  boardId: string,
  filter: TaskFilter,
  options?: { campaignId?: string }
): Promise<TaskRow[]> {
  let query = supabase
    .from("crm_tasks")
    .select(
      "id, workspace_id, board_id, campaign_id, task_bundle_id, source_type, title, description, platform, status, priority, due_at, created_by, assigned_to, created_at, updated_at, deliverable_type"
    )
    .eq("board_id", boardId)
    .order("due_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false });

  if (options?.campaignId) {
    query = query.eq("campaign_id", options.campaignId);
  }

  const now = new Date().toISOString();
  const todayStart = startOfTodayUtc();
  const weekEnd = endOfWeekUtc();

  switch (filter) {
    case "this_week":
      query = query
        .not("due_at", "is", null)
        .gte("due_at", todayStart)
        .lte("due_at", weekEnd);
      break;
    case "overdue":
      query = query.not("due_at", "is", null).lt("due_at", todayStart);
      break;
    case "campaign":
      query = query.not("campaign_id", "is", null);
      break;
    case "submitted":
      query = query.eq("status", "submitted");
      break;
    case "approved":
      query = query.eq("status", "approved");
      break;
    default:
      break;
  }

  const { data: tasks, error } = await query;
  if (error) return [];

  const campaignIds = [...new Set((tasks ?? []).map((t) => t.campaign_id).filter(Boolean))] as string[];
  const bundleIds = [...new Set((tasks ?? []).map((t) => t.task_bundle_id).filter(Boolean))] as string[];

  let campaignTitles: Record<string, string> = {};
  let bundleTitles: Record<string, string> = {};

  if (campaignIds.length > 0) {
    const { data: campaigns } = await supabase
      .from("crm_campaigns")
      .select("id, title")
      .in("id", campaignIds);
    campaignTitles = Object.fromEntries((campaigns ?? []).map((c) => [c.id, c.title]));
  }
  if (bundleIds.length > 0) {
    const { data: bundles } = await supabase
      .from("crm_task_bundles")
      .select("id, title")
      .in("id", bundleIds);
    bundleTitles = Object.fromEntries((bundles ?? []).map((b) => [b.id, b.title]));
  }

  return (tasks ?? []).map((t) => ({
    ...t,
    campaign_title: t.campaign_id ? campaignTitles[t.campaign_id] ?? null : null,
    task_bundle_title: t.task_bundle_id ? bundleTitles[t.task_bundle_id] ?? null : null,
  })) as TaskRow[];
}

export async function getTask(
  supabase: SupabaseClient,
  taskId: string
): Promise<{ task: TaskRow; campaignTitle: string | null; bundleTitle: string | null } | null> {
  const { data: task, error } = await supabase
    .from("crm_tasks")
    .select(
      "id, workspace_id, board_id, campaign_id, task_bundle_id, source_type, title, description, platform, status, priority, due_at, created_by, assigned_to, created_at, updated_at, deliverable_type"
    )
    .eq("id", taskId)
    .maybeSingle();

  if (error || !task) return null;

  let campaignTitle: string | null = null;
  let bundleTitle: string | null = null;
  if (task.campaign_id) {
    const { data: c } = await supabase
      .from("crm_campaigns")
      .select("title")
      .eq("id", task.campaign_id)
      .maybeSingle();
    campaignTitle = c?.title ?? null;
  }
  if (task.task_bundle_id) {
    const { data: b } = await supabase
      .from("crm_task_bundles")
      .select("title")
      .eq("id", task.task_bundle_id)
      .maybeSingle();
    bundleTitle = b?.title ?? null;
  }

  return {
    task: { ...task, campaign_title: campaignTitle, task_bundle_title: bundleTitle } as TaskRow,
    campaignTitle,
    bundleTitle,
  };
}

export async function createTask(
  supabase: SupabaseClient,
  params: {
    workspace_id: string;
    board_id: string;
    title: string;
    description?: string | null;
    platform?: string | null;
    due_at?: string | null;
    created_by: string;
    assigned_to?: string | null;
  }
): Promise<{ id: string } | { error: string }> {
  const { data, error } = await supabase
    .from("crm_tasks")
    .insert({
      workspace_id: params.workspace_id,
      board_id: params.board_id,
      source_type: "manual",
      title: params.title,
      description: params.description ?? null,
      platform: params.platform ?? null,
      due_at: params.due_at ?? null,
      status: "to_do",
      priority: "medium",
      created_by: params.created_by,
      assigned_to: params.assigned_to ?? params.created_by,
    })
    .select("id")
    .single();

  if (error) return { error: error.message };
  if (!data?.id) return { error: "Insert failed" };
  return { id: data.id };
}

export async function updateTask(
  supabase: SupabaseClient,
  taskId: string,
  updates: {
    title?: string;
    description?: string | null;
    platform?: string | null;
    status?: string;
    priority?: string;
    due_at?: string | null;
  }
): Promise<{ error?: string }> {
  const { error } = await supabase
    .from("crm_tasks")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", taskId);

  if (error) return { error: error.message };
  return {};
}
