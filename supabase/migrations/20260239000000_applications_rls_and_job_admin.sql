-- =============================================================================
-- Phase 1 security: lock down applications (no public read); job-org-admin helper;
-- optional duplicate-application prevention.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- A) SECURITY DEFINER: is_job_org_admin(job_id, uid) for applications RLS
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_job_org_admin(p_job_id uuid, p_uid uuid)
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT COALESCE((
    SELECT public.is_org_admin(j.org_id, p_uid)
    FROM public.jobs j
    WHERE j.id = p_job_id
  ), false);
$$;

COMMENT ON FUNCTION public.is_job_org_admin(uuid, uuid) IS 'True if p_uid is org owner/admin of the org that owns the job. Used by applications RLS.';

-- -----------------------------------------------------------------------------
-- B) Applications: drop public SELECT, add private SELECT
-- -----------------------------------------------------------------------------
ALTER TABLE public.applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_select_public" ON public.applications;

CREATE POLICY "applications_select_private" ON public.applications
  FOR SELECT USING (
    (applicant_type = 'profile' AND applicant_profile_id = auth.uid())
    OR (applicant_type = 'org' AND applicant_org_id IS NOT NULL AND public.is_org_admin(applicant_org_id, auth.uid()))
    OR public.is_job_org_admin(job_id, auth.uid())
  );

-- -----------------------------------------------------------------------------
-- C) Applications INSERT unchanged (applicant only) – ensure name matches
-- -----------------------------------------------------------------------------
-- Already exists: applications_insert_applicant (profile = auth.uid() or org admin for applicant_org_id)
-- No change.

-- -----------------------------------------------------------------------------
-- D) Applications UPDATE: job org admin (any status) OR applicant withdraw only
-- -----------------------------------------------------------------------------
DROP POLICY IF EXISTS "applications_update_org_admin" ON public.applications;

CREATE POLICY "applications_update_org_admin" ON public.applications
  FOR UPDATE USING (public.is_job_org_admin(job_id, auth.uid()));

CREATE POLICY "applications_update_applicant_withdraw" ON public.applications
  FOR UPDATE USING (
    (applicant_type = 'profile' AND applicant_profile_id = auth.uid())
    OR (applicant_type = 'org' AND applicant_org_id IS NOT NULL AND public.is_org_admin(applicant_org_id, auth.uid()))
  )
  WITH CHECK (status = 'withdrawn');

-- -----------------------------------------------------------------------------
-- E) Indexes (if not already present)
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_applications_job_id ON public.applications (job_id);
CREATE INDEX IF NOT EXISTS idx_applications_applicant_profile ON public.applications (applicant_profile_id) WHERE applicant_profile_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_applicant_org ON public.applications (applicant_org_id) WHERE applicant_org_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_applications_status ON public.applications (status);

-- -----------------------------------------------------------------------------
-- F) Duplicate prevention: one pending/accepted application per (job, applicant)
-- -----------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_one_per_job_profile
  ON public.applications (job_id, applicant_profile_id)
  WHERE applicant_type = 'profile' AND applicant_profile_id IS NOT NULL AND status IN ('pending', 'accepted');

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_one_per_job_org
  ON public.applications (job_id, applicant_org_id)
  WHERE applicant_type = 'org' AND applicant_org_id IS NOT NULL AND status IN ('pending', 'accepted');

COMMIT;
