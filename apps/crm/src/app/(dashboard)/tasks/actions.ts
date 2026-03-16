"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { createTask } from "@/lib/tasks";
import { revalidatePath } from "next/cache";

export async function createTaskAction(formData: FormData): Promise<{ error?: string; id?: string }> {
  const supabase = await createServerSupabase();
  if (!supabase) return { error: "Not configured" };

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.id) return { error: "Unauthorized" };

  const { getOrCreateCreatorWorkspaceAndBoard } = await import("@/lib/workspace");
  const ws = await getOrCreateCreatorWorkspaceAndBoard(supabase, user.id);
  if (!ws) return { error: "Workspace not found" };

  const title = formData.get("title") as string | null;
  if (!title?.trim()) return { error: "Title is required" };

  const description = (formData.get("description") as string | null)?.trim() || null;
  const platform = (formData.get("platform") as string | null)?.trim() || null;
  const dueRaw = formData.get("due_at") as string | null;
  const due_at = dueRaw?.trim() ? dueRaw : null;

  const result = await createTask(supabase, {
    workspace_id: ws.workspaceId,
    board_id: ws.boardId,
    title: title.trim(),
    description,
    platform,
    due_at,
    created_by: user.id,
    assigned_to: user.id,
  });

  if ("error" in result) return { error: result.error };
  revalidatePath("/tasks");
  return { id: result.id };
}
