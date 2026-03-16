"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { getTask, updateTask } from "@/lib/tasks";
import {
  createSubmission,
  isValidProofUrl,
  normalizePlatform,
} from "@/lib/submissions";
import { revalidatePath } from "next/cache";

/** Allowed status values for creator updates */
const ALLOWED_STATUSES = new Set([
  "backlog", "to_do", "in_progress", "submitted", "approved", "rejected", "done",
]);

export async function updateTaskAction(
  taskId: string,
  updates: {
    title?: string;
    description?: string | null;
    platform?: string | null;
    status?: string;
    due_at?: string | null;
  }
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const existing = await getTask(supabase, taskId);
  if (!existing) return { error: "Task not found or access denied" };

  const task = existing.task;
  const isManual = task.source_type === "manual";

  const allowed: {
    title?: string;
    description?: string | null;
    platform?: string | null;
    status?: string;
    due_at?: string | null;
  } = {};

  if (updates.status !== undefined) {
    if (ALLOWED_STATUSES.has(updates.status)) allowed.status = updates.status;
  }

  if (isManual) {
    if (updates.title !== undefined) allowed.title = updates.title;
    if (updates.description !== undefined) allowed.description = updates.description;
    if (updates.platform !== undefined) allowed.platform = updates.platform;
    if (updates.due_at !== undefined) allowed.due_at = updates.due_at;
  }

  const result = await updateTask(supabase, taskId, allowed);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return result;
}

export async function submitProofAction(
  taskId: string,
  payload: { url: string; platform: string; notes?: string | null; title?: string | null }
): Promise<{ error?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const profileRes = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .single();
  const profileId = profileRes.data?.id;
  if (!profileId) return { error: "Profile not found" };

  const existing = await getTask(supabase, taskId);
  if (!existing) return { error: "Task not found or access denied" };

  const task = existing.task;
  const url = (payload.url ?? "").trim();
  if (!url) return { error: "Proof URL is required" };
  if (!isValidProofUrl(url)) return { error: "Please enter a valid http or https URL" };

  const platform = (normalizePlatform(payload.platform) ?? "other").trim() || "other";

  const result = await createSubmission(supabase, {
    task_id: taskId,
    campaign_id: task.campaign_id,
    participant_profile_id: profileId,
    platform,
    url,
    title: payload.title?.trim() || null,
    notes: payload.notes?.trim() || null,
  });

  if ("error" in result) {
    return { error: result.error };
  }
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return {};
}
