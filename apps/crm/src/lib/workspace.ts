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
  | "wrong_profile_type"
  | "workspace_insert"
  | "workspace_member_insert"
  | "board_insert"
  | "session_missing"
  | "rls_denied"
  | "duplicate_slug_unresolved"
  | "unknown";

export type GetOrCreateCreatorResult =
  | CreatorWorkspaceBoard
  | { error: BootstrapFailureReason; stage?: string };

/** Stable stage labels for logging and optional debug UI. No PII. */
export const BOOTSTRAP_STAGES = {
  profile_check: "profile_check",
  workspace_select: "workspace_select",
  workspace_insert: "workspace_insert",
  member_insert: "workspace_member_insert",
  board_select: "board_select",
  board_insert: "board_insert",
} as const;

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
    case "wrong_profile_type":
      return {
        message: "Personal task board isn't available for this account type.",
        hint: "Use Campaigns for org accounts, or sign in with an individual creator account.",
      };
    case "workspace_insert":
    case "workspace_member_insert":
    case "board_insert":
    case "rls_denied":
    case "duplicate_slug_unresolved":
      return {
        message: "Could not create your workspace. Try signing out and back in.",
        hint: "If the problem continues, contact support and mention the failure code if you see one.",
      };
    case "session_missing":
      return {
        message: "Session expired or not found.",
        hint: "Sign in again, then open Tasks.",
      };
    default:
      return {
        message: "Could not load workspace. Try signing out and back in.",
        hint: null,
      };
  }
}

const LOG_PREFIX = "[CRM bootstrap]";

/** Server-side only. No PII. Stable reason + optional stage/code for logs. */
function logBootstrapFailure(
  reason: BootstrapFailureReason,
  stage?: string,
  detail?: string
) {
  const parts = [`reason=${reason}`];
  if (stage) parts.push(`stage=${stage}`);
  if (detail) parts.push(`detail=${detail}`);
  console.warn(`${LOG_PREFIX} failed: ${parts.join(" ")}`);
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
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
    logBootstrapFailure("no_profile", BOOTSTRAP_STAGES.profile_check);
    return { error: "no_profile", stage: BOOTSTRAP_STAGES.profile_check };
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
      const msg = (insertWs?.message ?? "").toLowerCase();
      // Race: another request may have created the workspace (duplicate slug 23505). Re-select, optionally after short delay.
      if (code === "23505") {
        await sleep(150);
        const { data: raceExisting } = await supabase
          .from("crm_workspaces")
          .select("id")
          .eq("owner_profile_id", profileId)
          .eq("type", "creator")
          .maybeSingle();
        if (raceExisting?.id) {
          workspaceId = raceExisting.id;
        } else {
          logBootstrapFailure("duplicate_slug_unresolved", BOOTSTRAP_STAGES.workspace_insert, `code=${code}`);
          return { error: "duplicate_slug_unresolved", stage: BOOTSTRAP_STAGES.workspace_insert };
        }
      } else if (code === "42501" || msg.includes("policy") || msg.includes("row-level")) {
        logBootstrapFailure("rls_denied", BOOTSTRAP_STAGES.workspace_insert, `code=${code}`);
        return { error: "rls_denied", stage: BOOTSTRAP_STAGES.workspace_insert };
      } else {
        logBootstrapFailure("workspace_insert", BOOTSTRAP_STAGES.workspace_insert, `code=${code}`);
        return { error: "workspace_insert", stage: BOOTSTRAP_STAGES.workspace_insert };
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
        const m = (memberErr.message ?? "").toLowerCase();
        const isRls = memberErr.code === "42501" || m.includes("policy") || m.includes("row-level");
        logBootstrapFailure(
          isRls ? "rls_denied" : "workspace_member_insert",
          BOOTSTRAP_STAGES.member_insert,
          `code=${memberErr.code}`
        );
        return {
          error: isRls ? "rls_denied" : "workspace_member_insert",
          stage: BOOTSTRAP_STAGES.member_insert,
        };
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
      const m = (insertBoard?.message ?? "").toLowerCase();
      const isRls = code === "42501" || m.includes("policy") || m.includes("row-level");
      logBootstrapFailure(
        isRls ? "rls_denied" : "board_insert",
        BOOTSTRAP_STAGES.board_insert,
        `code=${code}`
      );
      return {
        error: isRls ? "rls_denied" : "board_insert",
        stage: BOOTSTRAP_STAGES.board_insert,
      };
    }
    boardId = insertedBoard.id;
  }

  return { workspaceId, boardId };
}
