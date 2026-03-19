-- =============================================================================
-- CRM bootstrap fix: owners could not SELECT their own workspace row until they
-- were already a workspace member — but member INSERT required crm_workspace_member(),
-- which needed to read that workspace row → circular RLS → member/board inserts
-- failed; retries hit UNIQUE(slug) and surfaced as "Could not create workspace".
-- =============================================================================

DROP POLICY IF EXISTS "crm_workspaces_select_owner_row" ON public.crm_workspaces;
CREATE POLICY "crm_workspaces_select_owner_row" ON public.crm_workspaces
  FOR SELECT USING (owner_profile_id = auth.uid());

COMMENT ON POLICY "crm_workspaces_select_owner_row" ON public.crm_workspaces IS
  'Lets workspace owners read rows they own without prior membership (breaks RLS cycle with crm_workspace_member).';
