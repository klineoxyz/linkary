-- =============================================================================
-- CRM: Allow workspace members to update contribution_percent for their campaigns.
-- Contribution recalculation must run only in operator (workspace) context;
-- this enables those updates to persist.
-- =============================================================================

-- crm_task_bundles: workspace members may update (e.g. contribution_percent)
DROP POLICY IF EXISTS "crm_task_bundles_update" ON public.crm_task_bundles;
CREATE POLICY "crm_task_bundles_update" ON public.crm_task_bundles
  FOR UPDATE USING (public.crm_workspace_member(workspace_id));

-- crm_campaign_participants: workspace members may update (e.g. contribution_percent) for participants in their campaigns
DROP POLICY IF EXISTS "crm_campaign_participants_update" ON public.crm_campaign_participants;
CREATE POLICY "crm_campaign_participants_update" ON public.crm_campaign_participants
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );
