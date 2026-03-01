-- case_studies: tighten SELECT so anon/authenticated see only is_public = true.
-- Owners (profile or org member) can read their own private rows.
-- Idempotent: drops and recreates the same policy.

DROP POLICY IF EXISTS "case_studies_select_public" ON public.case_studies;

CREATE POLICY "case_studies_select_public" ON public.case_studies
  FOR SELECT
  USING (
    is_public = true
    OR (owner_type = 'profile' AND owner_profile_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (
      SELECT 1 FROM public.org_members m
      WHERE m.org_id = case_studies.owner_org_id
        AND m.user_id = auth.uid()
        AND m.role IN ('owner', 'admin', 'member')
    ))
  );

COMMENT ON POLICY "case_studies_select_public" ON public.case_studies IS
  'Anon/authenticated: only is_public = true. Owners: profile owner or org member can read own private rows.';
