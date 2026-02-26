-- Case studies visibility: allow draft/private case studies
ALTER TABLE public.case_studies
  ADD COLUMN IF NOT EXISTS is_public boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.case_studies.is_public IS 'When false, case study is hidden from public profile.';

CREATE INDEX IF NOT EXISTS idx_case_studies_owner_profile_is_public
  ON public.case_studies (owner_profile_id, is_public)
  WHERE owner_profile_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_case_studies_owner_org_is_public
  ON public.case_studies (owner_org_id, is_public)
  WHERE owner_org_id IS NOT NULL;
