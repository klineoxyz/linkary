/**
 * CRM: Role-aware access resolution. Determines where a logged-in user should land
 * based on profile/workspace/org data. All checks are server-side; do not rely on
 * client-only state.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

/** Creator (individual) workspace: one per profile, type='creator', owner is the profile. */
export type CreatorWorkspaceInfo = {
  id: string;
  slug: string;
  name: string;
};

/** Org-style workspace: type in org | project | brand | agency; user is member or owner. */
export type OrgWorkspaceInfo = {
  id: string;
  slug: string;
  name: string;
  type: "org" | "project" | "brand" | "agency";
};

/**
 * Resolved CRM access type for routing and UI.
 * - creator_only: has creator workspace only → land on /tasks
 * - org_only: has org-style workspace(s) only → land on /campaigns (org dashboard)
 * - both: has both → show workspace/access switcher
 * - none: no CRM workspaces → show no-access / setup-needed page
 */
export type CrmAccessType = "creator_only" | "org_only" | "both" | "none";

export type CrmAccessResult = {
  accessType: CrmAccessType;
  /** Present when user has a creator workspace (or can use creator flow). */
  creatorWorkspace: CreatorWorkspaceInfo | null;
  /** Non-empty when user has access to at least one org/project/brand/agency workspace. */
  orgWorkspaces: OrgWorkspaceInfo[];
  /** First org workspace slug; useful for default redirect when org_only. */
  firstOrgWorkspaceSlug: string | null;
};

const ORG_TYPES = ["org", "project", "brand", "agency"] as const;

function isOrgType(t: string): t is (typeof ORG_TYPES)[number] {
  return ORG_TYPES.includes(t as (typeof ORG_TYPES)[number]);
}

/**
 * Resolve CRM access for the authenticated user. Uses RLS: only workspaces
 * where the user is owner or member (via crm_workspace_member) are returned.
 * Call this server-side with the session Supabase client.
 */
export async function resolveCrmAccess(
  supabase: SupabaseClient,
  userId: string
): Promise<CrmAccessResult> {
  const { data: rows } = await supabase
    .from("crm_workspaces")
    .select("id, slug, name, type")
    .order("updated_at", { ascending: false });

  const workspaces = (rows ?? []) as { id: string; slug: string; name: string; type: string }[];
  const creator = workspaces.find((w) => w.type === "creator");
  const creatorWorkspace: CreatorWorkspaceInfo | null = creator
    ? { id: creator.id, slug: creator.slug, name: creator.name }
    : null;
  const orgList = workspaces
    .filter((w) => isOrgType(w.type))
    .map((w) => ({ id: w.id, slug: w.slug, name: w.name, type: w.type as OrgWorkspaceInfo["type"] }));
  const firstOrgSlug = orgList.length > 0 ? orgList[0].slug : null;

  let accessType: CrmAccessType = "none";
  if (creatorWorkspace && orgList.length > 0) {
    accessType = "both";
  } else if (creatorWorkspace) {
    accessType = "creator_only";
  } else if (orgList.length > 0) {
    accessType = "org_only";
  }

  return {
    accessType,
    creatorWorkspace,
    orgWorkspaces: orgList,
    firstOrgWorkspaceSlug: firstOrgSlug,
  };
}
