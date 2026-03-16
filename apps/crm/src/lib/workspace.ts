/**
 * CRM: Creator workspace and board. Get or create personal workspace + board for a profile.
 * RLS-safe: owner_profile_id = profileId allows insert/select.
 *
 * Only call this for users who are eligible for creator bootstrap (see canBootstrapCreatorWorkspace).
 * Callers (e.g. /tasks page) must check eligibility before calling when the user does not yet
 * have a creator workspace; otherwise org-only or company profiles could get a creator workspace.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

export type CreatorWorkspaceBoard = {
  workspaceId: string;
  boardId: string;
};

export async function getOrCreateCreatorWorkspaceAndBoard(
  supabase: SupabaseClient,
  profileId: string
): Promise<CreatorWorkspaceBoard | null> {
  const slug = `creator-${profileId.slice(0, 8)}`;
  const name = "My workspace";

  const { data: existing } = await supabase
    .from("crm_workspaces")
    .select("id")
    .eq("owner_profile_id", profileId)
    .eq("type", "creator")
    .maybeSingle();

  let workspaceId: string;

  if (existing?.id) {
    workspaceId = existing.id;
  } else {
    const { data: inserted, error: insertWs } = await supabase
      .from("crm_workspaces")
      .insert({
        type: "creator",
        slug,
        name,
        owner_profile_id: profileId,
      })
      .select("id")
      .single();
    if (insertWs || !inserted?.id) return null;
    workspaceId = inserted.id;

    await supabase.from("crm_workspace_members").insert({
      workspace_id: workspaceId,
      profile_id: profileId,
      role: "owner",
    });
  }

  const { data: board } = await supabase
    .from("crm_boards")
    .select("id")
    .eq("workspace_id", workspaceId)
    .eq("kind", "personal")
    .maybeSingle();

  let boardId: string;
  if (board?.id) {
    boardId = board.id;
  } else {
    const { data: insertedBoard, error: insertBoard } = await supabase
      .from("crm_boards")
      .insert({
        workspace_id: workspaceId,
        name: "My tasks",
        kind: "personal",
      })
      .select("id")
      .single();
    if (insertBoard || !insertedBoard?.id) return null;
    boardId = insertedBoard.id;
  }

  return { workspaceId, boardId };
}
