-- case_studies: restrict SELECT so anon can only read is_public = true; owners can read their own.
-- Replaces the previous SELECT USING (true) policy.

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

COMMENT ON POLICY "case_studies_select_public" ON public.case_studies IS 'Public: only is_public rows. Owners: profile owner or org member can read own.';
