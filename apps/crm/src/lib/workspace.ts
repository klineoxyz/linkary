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

/** Failure reason for observability and user-facing message. Not exposed to client except via safe copy. */
export type BootstrapFailureReason =
  | "no_profile"
  | "workspace_insert"
  | "workspace_member_insert"
  | "board_insert"
  | "unknown";

export type GetOrCreateCreatorResult =
  | CreatorWorkspaceBoard
  | { error: BootstrapFailureReason };

/** User-facing message and optional hint for each bootstrap failure reason. */
export function workspaceBootstrapMessage(
  reason: BootstrapFailureReason
): { message: string; hint: string | null } {
  switch (reason) {
    case "no_profile":
      return {
        message: "Your account isn’t set up for Tasks yet.",
        hint: "Sign in on linkary.xyz first, then open Tasks again. If it persists, try signing out and back in.",
      };
    case "workspace_insert":
    case "workspace_member_insert":
    case "board_insert":
      return {
        message: "Could not create your workspace. Try signing out and back in.",
        hint: "If the problem continues, contact support.",
      };
    default:
      return {
        message: "Could not load workspace. Try signing out and back in.",
        hint: null,
      };
  }
}

const LOG_PREFIX = "[CRM tasks]";

function logBootstrapFailure(reason: BootstrapFailureReason, detail?: string) {
  const detailStr = detail ? ` ${detail}` : "";
  console.warn(`${LOG_PREFIX} workspace bootstrap failed: reason=${reason}${detailStr}`);
}

export async function getOrCreateCreatorWorkspaceAndBoard(
  supabase: SupabaseClient,
  profileId: string
): Promise<GetOrCreateCreatorResult> {
  const slug = `creator-${profileId.slice(0, 8)}`;
  const name = "My workspace";

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", profileId)
    .maybeSingle();
  if (!profileRow?.id) {
    logBootstrapFailure("no_profile");
    return { error: "no_profile" };
  }

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
    if (insertWs || !inserted?.id) {
      const code = insertWs?.code ?? "unknown";
      // Race: another request may have created the workspace (duplicate slug 23505). Re-select and continue.
      if (code === "23505") {
        const { data: raceExisting } = await supabase
          .from("crm_workspaces")
          .select("id")
          .eq("owner_profile_id", profileId)
          .eq("type", "creator")
          .maybeSingle();
        if (raceExisting?.id) {
          workspaceId = raceExisting.id;
        } else {
          logBootstrapFailure("workspace_insert", `code=${code} no_race_row`);
          return { error: "workspace_insert" };
        }
      } else {
        logBootstrapFailure("workspace_insert", `code=${code}`);
        return { error: "workspace_insert" };
      }
    } else {
      workspaceId = inserted.id;
    }

    if (workspaceId) {
      const { error: memberErr } = await supabase.from("crm_workspace_members").insert({
        workspace_id: workspaceId,
        profile_id: profileId,
        role: "owner",
      });
      // Ignore duplicate member (23505): we may have lost the race and another request added us.
      if (memberErr && memberErr.code !== "23505") {
        logBootstrapFailure("workspace_member_insert", `code=${memberErr.code}`);
        return { error: "workspace_member_insert" };
      }
    }
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
    if (insertBoard || !insertedBoard?.id) {
      const code = insertBoard?.code ?? "unknown";
      logBootstrapFailure("board_insert", `code=${code}`);
      return { error: "board_insert" };
    }
    boardId = insertedBoard.id;
  }

  return { workspaceId, boardId };
}
