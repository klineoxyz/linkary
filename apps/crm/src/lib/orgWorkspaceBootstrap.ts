/**
 * CRM: Bootstrap org workspace(s) for the current user when they are an org owner/admin.
 * When an org admin visits /campaigns and has no org workspace yet, we create one per org
 * they admin (linked_org_id) so they can use Campaigns. Idempotent.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceSupabase } from "@/lib/supabase/admin";

/**
 * For the given user, ensure they have a CRM org workspace for each Linkary org they are owner/admin of.
 * Creates crm_workspace (type=org, linked_org_id), adds user as member, creates campaign board if missing.
 * Returns updated access (with new workspaces) or null on error.
 */
export async function ensureOrgWorkspacesForUser(
  supabase: SupabaseClient,
  userId: string
): Promise<{ orgWorkspacesCreated: number; membershipsAdded: number } | null> {
  // Prefer service-role to avoid RLS blind spots when checking org memberships/workspaces.
  const admin = createServiceSupabase() ?? supabase;

  const { data: memberships } = await admin
    .from("org_members")
    .select("org_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"]);

  const orgIds = [...new Set((memberships ?? []).map((m: { org_id: string }) => m.org_id))];
  if (orgIds.length === 0) return { orgWorkspacesCreated: 0, membershipsAdded: 0 };

  const { data: orgs } = await admin
    .from("orgs")
    .select("id, slug, name")
    .in("id", orgIds);

  let created = 0;
  let membershipsAdded = 0;
  for (const org of orgs ?? []) {
    const o = org as { id: string; slug: string | null; name: string };
    const { data: existing } = await admin
      .from("crm_workspaces")
      .select("id")
      .eq("linked_org_id", o.id)
      .in("type", ["org", "project", "brand", "agency"])
      .maybeSingle();

    let workspaceId = (existing as { id?: string } | null)?.id ?? null;
    if (!workspaceId) {
      const slug = `org-${o.id.replace(/-/g, "")}`;
      const name = (o.name ?? "Org workspace").trim() || "Org workspace";

      const { data: inserted, error: insertErr } = await admin
        .from("crm_workspaces")
        .insert({
          type: "org",
          slug,
          name,
          owner_profile_id: userId,
          linked_org_id: o.id,
        })
        .select("id")
        .single();

      if (!insertErr && inserted?.id) {
        workspaceId = (inserted as { id: string }).id;
        created++;
      } else {
        // Race or pre-existing workspace hidden by previous checks: resolve again by linked_org_id.
        const { data: afterInsertExisting } = await admin
          .from("crm_workspaces")
          .select("id")
          .eq("linked_org_id", o.id)
          .in("type", ["org", "project", "brand", "agency"])
          .maybeSingle();
        workspaceId = (afterInsertExisting as { id?: string } | null)?.id ?? null;
      }
    }
    if (!workspaceId) continue;

    const { error: memberInsertErr } = await admin.from("crm_workspace_members").insert({
      workspace_id: workspaceId,
      profile_id: userId,
      role: "admin",
    });
    // 23505 duplicate key means already a member.
    if (!memberInsertErr || memberInsertErr.code === "23505") {
      if (!memberInsertErr) membershipsAdded++;
    }

    const { data: board } = await admin
      .from("crm_boards")
      .select("id")
      .eq("workspace_id", workspaceId)
      .in("kind", ["campaign", "ops"])
      .limit(1)
      .maybeSingle();

    if (!board?.id) {
      await admin.from("crm_boards").insert({
        workspace_id: workspaceId,
        name: "Campaign tasks",
        kind: "campaign",
      });
    }
  }

  return { orgWorkspacesCreated: created, membershipsAdded };
}
