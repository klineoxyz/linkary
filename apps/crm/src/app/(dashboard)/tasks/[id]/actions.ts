"use server";

import { createServerSupabase } from "@/lib/supabase/server";
import { updateTask } from "@/lib/tasks";
import { revalidatePath } from "next/cache";

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

  const result = await updateTask(supabase, taskId, updates);
  revalidatePath("/tasks");
  revalidatePath(`/tasks/${taskId}`);
  return result;
}
