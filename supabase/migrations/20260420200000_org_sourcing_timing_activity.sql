-- Timing + operator activity log. Pipeline milestones are derived in API from grounded tables (no trigger RLS issues).

ALTER TABLE public.org_sourcing_creator_workflow
  ADD COLUMN IF NOT EXISTS follow_up_due_at timestamptz,
  ADD COLUMN IF NOT EXISTS snoozed_until timestamptz,
  ADD COLUMN IF NOT EXISTS last_operator_action_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_operator_action_by uuid REFERENCES auth.users(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.org_sourcing_creator_workflow.follow_up_due_at IS 'Operator follow-up target; not pipeline truth.';
COMMENT ON COLUMN public.org_sourcing_creator_workflow.snoozed_until IS 'Snooze overdue visibility until this time.';
COMMENT ON COLUMN public.org_sourcing_creator_workflow.last_operator_action_at IS 'Last team workflow save.';
COMMENT ON COLUMN public.org_sourcing_creator_workflow.last_operator_action_by IS 'User who last saved team workflow.';

CREATE TABLE IF NOT EXISTS public.org_sourcing_workflow_activity (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kind text NOT NULL,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_sourcing_wf_act_org_profile_created
  ON public.org_sourcing_workflow_activity(org_id, profile_id, created_at DESC);

COMMENT ON TABLE public.org_sourcing_workflow_activity IS 'Operator-side workflow edits only; pipeline events shown via API-derived timeline from grounded data.';

ALTER TABLE public.org_sourcing_workflow_activity ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_sourcing_wf_activity_select
  ON public.org_sourcing_workflow_activity FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_workflow_activity.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY org_sourcing_wf_activity_insert
  ON public.org_sourcing_workflow_activity FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_workflow_activity.org_id AND om.user_id = auth.uid()
    )
  );
