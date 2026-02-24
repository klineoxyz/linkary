-- Media file paths: store storage paths for images; URLs derived server-side (signed or public).
-- Bucket "media" must be created in Supabase Dashboard (private). Paths:
--   profile/{profile_id}/header/{uuid}.ext
--   org/{org_id}/logo/{uuid}.ext
--   partner/{partner_program_id}/logo/{uuid}.ext
--   case_study/{case_study_id}/proof/{uuid}.ext

-- profile_media: header image file (VIDEO can remain URL for external embed)
ALTER TABLE public.profile_media
  ADD COLUMN IF NOT EXISTS header_media_file_path text;
COMMENT ON COLUMN public.profile_media.header_media_file_path IS 'Storage path for header image; URL derived server-side.';

-- orgs: logo file
ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS logo_file_path text;
COMMENT ON COLUMN public.orgs.logo_file_path IS 'Storage path for org logo; URL derived server-side.';

-- partner_programs: logo file
ALTER TABLE public.partner_programs
  ADD COLUMN IF NOT EXISTS logo_file_path text;
COMMENT ON COLUMN public.partner_programs.logo_file_path IS 'Storage path for partner logo; URL derived server-side.';

-- case_studies: proof file (image or PDF)
ALTER TABLE public.case_studies
  ADD COLUMN IF NOT EXISTS proof_file_path text;
COMMENT ON COLUMN public.case_studies.proof_file_path IS 'Storage path for proof document/image; URL derived server-side.';
