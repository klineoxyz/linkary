-- Profile-level toggle to show/hide reviews section on public profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS show_reviews boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN public.profiles.show_reviews IS 'When false, Reviews section is hidden on public profile.';
