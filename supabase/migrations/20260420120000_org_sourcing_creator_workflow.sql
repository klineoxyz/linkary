-- Org-side operator workflow per creator (not pipeline truth). Org members CRUD.

CREATE TABLE IF NOT EXISTS public.org_sourcing_creator_workflow (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  follow_up_status text NOT NULL DEFAULT 'none'
    CHECK (follow_up_status IN (
      'none',
      'needs_review',
      'follow_up_needed',
      'waiting_internal',
      'blocked',
      'resolved'
    )),
  internal_note text,
  updated_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (org_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_sourcing_creator_workflow_org ON public.org_sourcing_creator_workflow(org_id);
CREATE INDEX IF NOT EXISTS idx_org_sourcing_creator_workflow_assignee ON public.org_sourcing_creator_workflow(org_id, assignee_user_id)
  WHERE assignee_user_id IS NOT NULL;

COMMENT ON TABLE public.org_sourcing_creator_workflow IS 'Operator assignment and follow-up metadata per org+creator; does not replace shortlist/invites/deals.';

ALTER TABLE public.org_sourcing_creator_workflow ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_sourcing_creator_workflow_select
  ON public.org_sourcing_creator_workflow FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_creator_workflow.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY org_sourcing_creator_workflow_insert
  ON public.org_sourcing_creator_workflow FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_creator_workflow.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY org_sourcing_creator_workflow_update
  ON public.org_sourcing_creator_workflow FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_creator_workflow.org_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_creator_workflow.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY org_sourcing_creator_workflow_delete
  ON public.org_sourcing_creator_workflow FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_creator_workflow.org_id AND om.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_org_sourcing_creator_workflow_updated_at ON public.org_sourcing_creator_workflow;
CREATE TRIGGER trg_org_sourcing_creator_workflow_updated_at
  BEFORE UPDATE ON public.org_sourcing_creator_workflow
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
