-- Org-scoped saved filter presets for sourcing workbench (org members only).

CREATE TABLE IF NOT EXISTS public.org_sourcing_saved_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  name text NOT NULL,
  filters jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_org_sourcing_saved_views_org ON public.org_sourcing_saved_views(org_id);

COMMENT ON TABLE public.org_sourcing_saved_views IS 'Saved sourcing workbench filter presets; org members CRUD; filters JSON only.';

ALTER TABLE public.org_sourcing_saved_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_sourcing_saved_views_select
  ON public.org_sourcing_saved_views FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_saved_views.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY org_sourcing_saved_views_insert
  ON public.org_sourcing_saved_views FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_saved_views.org_id AND om.user_id = auth.uid()
    )
    AND created_by = auth.uid()
  );

CREATE POLICY org_sourcing_saved_views_update
  ON public.org_sourcing_saved_views FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_saved_views.org_id AND om.user_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_saved_views.org_id AND om.user_id = auth.uid()
    )
  );

CREATE POLICY org_sourcing_saved_views_delete
  ON public.org_sourcing_saved_views FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.org_members om
      WHERE om.org_id = org_sourcing_saved_views.org_id AND om.user_id = auth.uid()
    )
  );

DROP TRIGGER IF EXISTS trg_org_sourcing_saved_views_updated_at ON public.org_sourcing_saved_views;
CREATE TRIGGER trg_org_sourcing_saved_views_updated_at
  BEFORE UPDATE ON public.org_sourcing_saved_views
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
