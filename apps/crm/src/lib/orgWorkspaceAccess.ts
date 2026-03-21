import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * True if the user is a member of a CRM workspace linked to the given Linkary org id.
 * External X search is org-context only; personal CRM users must not call without membership.
 */
export async function isUserMemberOfOrgLinkedWorkspace(
  service: SupabaseClient,
  userId: string,
  orgId: string
): Promise<boolean> {
  const { data: ws } = await service
    .from("crm_workspaces")
    .select("id")
    .eq("linked_org_id", orgId)
    .limit(1)
    .maybeSingle();

  const workspaceId = (ws as { id?: string } | null)?.id;
  if (!workspaceId) return false;

  const { data: mem } = await service
    .from("crm_workspace_members")
    .select("user_id")
    .eq("workspace_id", workspaceId)
    .eq("user_id", userId)
    .maybeSingle();

  return !!(mem as { user_id?: string } | null)?.user_id;
}
