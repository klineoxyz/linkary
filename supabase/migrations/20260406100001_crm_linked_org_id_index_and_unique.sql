-- =============================================================================
-- CRM: linked_org_id lookup index and uniqueness for org-style workspaces.
-- - Index for fast sync resolution (getCrmWorkspaceIdByOrgId).
-- - One Linkary org can be linked to at most one org/project/brand/agency workspace.
-- =============================================================================

-- If multiple org-style workspaces share the same linked_org_id, clear duplicates (keep one per org).
UPDATE public.crm_workspaces a
SET linked_org_id = NULL
FROM public.crm_workspaces b
WHERE a.type IN ('org', 'project', 'brand', 'agency')
  AND b.type IN ('org', 'project', 'brand', 'agency')
  AND a.linked_org_id IS NOT NULL
  AND b.linked_org_id IS NOT NULL
  AND a.linked_org_id = b.linked_org_id
  AND a.id > b.id;

CREATE INDEX IF NOT EXISTS idx_crm_workspaces_linked_org_id
  ON public.crm_workspaces(linked_org_id)
  WHERE linked_org_id IS NOT NULL;

-- Guard: only one org-style workspace per Linkary org (sync resolves by linked_org_id).
-- Multiple workspaces with linked_org_id NULL are allowed (e.g. before backfill).
CREATE UNIQUE INDEX IF NOT EXISTS crm_workspaces_linked_org_id_org_types_key
  ON public.crm_workspaces(linked_org_id)
  WHERE type IN ('org', 'project', 'brand', 'agency') AND linked_org_id IS NOT NULL;
