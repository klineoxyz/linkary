-- =============================================================================
-- Share analytics on apply: profiles flags + applications snapshot columns
-- =============================================================================

-- 1) Profiles: persist share settings (default true)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS share_analytics_on_apply boolean DEFAULT true,
  ADD COLUMN IF NOT EXISTS share_cv_on_apply boolean DEFAULT true;

COMMENT ON COLUMN public.profiles.share_analytics_on_apply IS 'When true, attaching x_analytics_rollups snapshot to new applications';
COMMENT ON COLUMN public.profiles.share_cv_on_apply IS 'When true, allow sharing CV with org when applying (prep for CV upload)';

-- 2) Applications: snapshot and CV sharing
ALTER TABLE public.applications
  ADD COLUMN IF NOT EXISTS shared_analytics boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS analytics_snapshot_json jsonb,
  ADD COLUMN IF NOT EXISTS shared_cv boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS cv_file_path text;

COMMENT ON COLUMN public.applications.shared_analytics IS 'True if applicant shared analytics snapshot at apply time';
COMMENT ON COLUMN public.applications.analytics_snapshot_json IS 'Latest x_analytics_rollups row for applicant at apply time';
COMMENT ON COLUMN public.applications.shared_cv IS 'True if applicant shared CV at apply time';
COMMENT ON COLUMN public.applications.cv_file_path IS 'Path to CV in storage when shared_cv true';
