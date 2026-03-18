-- Org KOL shortlist (org-owned lists only; UI enforces) + job-level invites (complements creator_program_invites).
-- Timestamp 20260419 so this runs after migrations already applied on remote (avoids out-of-order db push).

ALTER TABLE public.kol_list_members
  ADD COLUMN IF NOT EXISTS shortlisted boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.kol_list_members.shortlisted IS 'Operator shortlist flag; meaningful for org-owned KOL lists.';

CREATE TABLE IF NOT EXISTS public.org_job_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.orgs(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES public.jobs(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  kol_list_id uuid REFERENCES public.kol_lists(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (job_id, profile_id)
);

CREATE INDEX IF NOT EXISTS idx_org_job_invites_org ON public.org_job_invites (org_id);
CREATE INDEX IF NOT EXISTS idx_org_job_invites_job ON public.org_job_invites (job_id);
CREATE INDEX IF NOT EXISTS idx_org_job_invites_profile ON public.org_job_invites (profile_id);

COMMENT ON TABLE public.org_job_invites IS 'Org operator invited a creator to apply to a specific job/sprint.';

ALTER TABLE public.org_job_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY org_job_invites_select
  ON public.org_job_invites FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_job_invites.org_id AND m.user_id = auth.uid()
  ));

CREATE POLICY org_job_invites_insert
  ON public.org_job_invites FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = org_job_invites.org_id AND m.user_id = auth.uid()
    )
    AND EXISTS (
      SELECT 1 FROM public.jobs j
      WHERE j.id = org_job_invites.job_id AND j.org_id = org_job_invites.org_id
    )
  );

CREATE POLICY org_job_invites_delete
  ON public.org_job_invites FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.org_members m
    WHERE m.org_id = org_job_invites.org_id AND m.user_id = auth.uid()
    AND m.role IN ('owner', 'admin')
  ));
