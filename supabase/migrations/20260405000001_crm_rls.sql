-- =============================================================================
-- CRM RLS: creator sees own workspaces + campaigns they participate in;
-- org members see only their org workspaces. Enforce at DB layer.
-- =============================================================================

-- Helper: profile_id for current auth user (profiles.id = auth.uid() in Linkary)
CREATE OR REPLACE FUNCTION public.crm_current_profile_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

-- Helper: is current user member (or owner) of workspace
CREATE OR REPLACE FUNCTION public.crm_workspace_member(ws_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_workspace_members
    WHERE workspace_id = ws_id AND profile_id = public.crm_current_profile_id()
  )
  OR EXISTS (
    SELECT 1 FROM public.crm_workspaces
    WHERE id = ws_id AND owner_profile_id = public.crm_current_profile_id()
  );
$$;

-- crm_workspaces: see if owner or member
ALTER TABLE public.crm_workspaces ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_workspaces_select" ON public.crm_workspaces;
CREATE POLICY "crm_workspaces_select" ON public.crm_workspaces
  FOR SELECT USING (public.crm_workspace_member(id));

DROP POLICY IF EXISTS "crm_workspaces_insert_owner" ON public.crm_workspaces;
CREATE POLICY "crm_workspaces_insert_owner" ON public.crm_workspaces
  FOR INSERT WITH CHECK (owner_profile_id = public.crm_current_profile_id());

DROP POLICY IF EXISTS "crm_workspaces_update_owner" ON public.crm_workspaces;
CREATE POLICY "crm_workspaces_update_owner" ON public.crm_workspaces
  FOR UPDATE USING (owner_profile_id = public.crm_current_profile_id());

-- crm_workspace_members: see if member of that workspace
ALTER TABLE public.crm_workspace_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_workspace_members_select" ON public.crm_workspace_members;
CREATE POLICY "crm_workspace_members_select" ON public.crm_workspace_members
  FOR SELECT USING (public.crm_workspace_member(workspace_id));

DROP POLICY IF EXISTS "crm_workspace_members_insert_admin" ON public.crm_workspace_members;
CREATE POLICY "crm_workspace_members_insert_admin" ON public.crm_workspace_members
  FOR INSERT WITH CHECK (public.crm_workspace_member(workspace_id));

-- crm_boards: via workspace
ALTER TABLE public.crm_boards ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_boards_select" ON public.crm_boards;
CREATE POLICY "crm_boards_select" ON public.crm_boards
  FOR SELECT USING (public.crm_workspace_member(workspace_id));

DROP POLICY IF EXISTS "crm_boards_insert" ON public.crm_boards;
CREATE POLICY "crm_boards_insert" ON public.crm_boards
  FOR INSERT WITH CHECK (public.crm_workspace_member(workspace_id));

-- crm_board_columns: via board -> workspace
ALTER TABLE public.crm_board_columns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_board_columns_select" ON public.crm_board_columns;
CREATE POLICY "crm_board_columns_select" ON public.crm_board_columns
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crm_boards b
      WHERE b.id = board_id AND public.crm_workspace_member(b.workspace_id)
    )
  );

DROP POLICY IF EXISTS "crm_board_columns_insert" ON public.crm_board_columns;
CREATE POLICY "crm_board_columns_insert" ON public.crm_board_columns
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_boards b
      WHERE b.id = board_id AND public.crm_workspace_member(b.workspace_id)
    )
  );

-- crm_campaigns: via workspace
ALTER TABLE public.crm_campaigns ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_campaigns_select" ON public.crm_campaigns;
CREATE POLICY "crm_campaigns_select" ON public.crm_campaigns
  FOR SELECT USING (public.crm_workspace_member(workspace_id));

DROP POLICY IF EXISTS "crm_campaigns_insert" ON public.crm_campaigns;
CREATE POLICY "crm_campaigns_insert" ON public.crm_campaigns
  FOR INSERT WITH CHECK (public.crm_workspace_member(workspace_id));

DROP POLICY IF EXISTS "crm_campaigns_update" ON public.crm_campaigns;
CREATE POLICY "crm_campaigns_update" ON public.crm_campaigns
  FOR UPDATE USING (public.crm_workspace_member(workspace_id));

-- crm_task_bundles: workspace or participant (creator sees own bundles)
ALTER TABLE public.crm_task_bundles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_task_bundles_select" ON public.crm_task_bundles;
CREATE POLICY "crm_task_bundles_select" ON public.crm_task_bundles
  FOR SELECT USING (
    public.crm_workspace_member(workspace_id)
    OR participant_profile_id = public.crm_current_profile_id()
  );

DROP POLICY IF EXISTS "crm_task_bundles_insert" ON public.crm_task_bundles;
CREATE POLICY "crm_task_bundles_insert" ON public.crm_task_bundles
  FOR INSERT WITH CHECK (public.crm_workspace_member(workspace_id));

-- crm_tasks: via workspace or assignee/creator
ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_tasks_select" ON public.crm_tasks;
CREATE POLICY "crm_tasks_select" ON public.crm_tasks
  FOR SELECT USING (
    public.crm_workspace_member(workspace_id)
    OR assigned_to = public.crm_current_profile_id()
    OR created_by = public.crm_current_profile_id()
  );

DROP POLICY IF EXISTS "crm_tasks_insert" ON public.crm_tasks;
CREATE POLICY "crm_tasks_insert" ON public.crm_tasks
  FOR INSERT WITH CHECK (public.crm_workspace_member(workspace_id));

DROP POLICY IF EXISTS "crm_tasks_update" ON public.crm_tasks;
CREATE POLICY "crm_tasks_update" ON public.crm_tasks
  FOR UPDATE USING (
    public.crm_workspace_member(workspace_id)
    OR assigned_to = public.crm_current_profile_id()
  );

-- crm_campaign_participants: campaign -> workspace or self as participant
ALTER TABLE public.crm_campaign_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_campaign_participants_select" ON public.crm_campaign_participants;
CREATE POLICY "crm_campaign_participants_select" ON public.crm_campaign_participants
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
    OR participant_profile_id = public.crm_current_profile_id()
  );

DROP POLICY IF EXISTS "crm_campaign_participants_insert" ON public.crm_campaign_participants;
CREATE POLICY "crm_campaign_participants_insert" ON public.crm_campaign_participants
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

-- crm_submission_requirements: via campaign
ALTER TABLE public.crm_submission_requirements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_submission_requirements_select" ON public.crm_submission_requirements;
CREATE POLICY "crm_submission_requirements_select" ON public.crm_submission_requirements
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

-- crm_submissions: task/campaign participant or workspace member (reviewer)
ALTER TABLE public.crm_submissions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_submissions_select" ON public.crm_submissions;
CREATE POLICY "crm_submissions_select" ON public.crm_submissions
  FOR SELECT USING (
    participant_profile_id = public.crm_current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

DROP POLICY IF EXISTS "crm_submissions_insert" ON public.crm_submissions;
CREATE POLICY "crm_submissions_insert" ON public.crm_submissions
  FOR INSERT WITH CHECK (participant_profile_id = public.crm_current_profile_id());

DROP POLICY IF EXISTS "crm_submissions_update" ON public.crm_submissions;
CREATE POLICY "crm_submissions_update" ON public.crm_submissions
  FOR UPDATE USING (
    participant_profile_id = public.crm_current_profile_id()
    OR EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

-- crm_activity_log: workspace member
ALTER TABLE public.crm_activity_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_activity_log_select" ON public.crm_activity_log;
CREATE POLICY "crm_activity_log_select" ON public.crm_activity_log
  FOR SELECT USING (public.crm_workspace_member(workspace_id));

DROP POLICY IF EXISTS "crm_activity_log_insert" ON public.crm_activity_log;
CREATE POLICY "crm_activity_log_insert" ON public.crm_activity_log
  FOR INSERT WITH CHECK (public.crm_workspace_member(workspace_id));

-- crm_campaign_metrics_daily: campaign -> workspace
ALTER TABLE public.crm_campaign_metrics_daily ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_campaign_metrics_daily_select" ON public.crm_campaign_metrics_daily;
CREATE POLICY "crm_campaign_metrics_daily_select" ON public.crm_campaign_metrics_daily
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );

-- crm_campaign_reports: campaign -> workspace
ALTER TABLE public.crm_campaign_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "crm_campaign_reports_select" ON public.crm_campaign_reports;
CREATE POLICY "crm_campaign_reports_select" ON public.crm_campaign_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.crm_campaigns c
      WHERE c.id = campaign_id AND public.crm_workspace_member(c.workspace_id)
    )
  );
