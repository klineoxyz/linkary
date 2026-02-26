-- profiles: profile_type + universal hero media for public one-pager
BEGIN;

-- 1) profile_type: individual | project | company
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'profile_type'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN profile_type text NOT NULL DEFAULT 'individual';
    COMMENT ON COLUMN public.profiles.profile_type IS 'Profile kind: individual, project, or company (org-style).';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_profile_type_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_profile_type_check
      CHECK (profile_type IN ('individual', 'project', 'company'));
  END IF;
END $$;

-- 2) Hero media (universal): only one of image/video used at a time
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hero_image_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN hero_image_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hero_video_url'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN hero_video_url text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'hero_title'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN hero_title text;
  END IF;
END $$;

-- 3) Recreate public_profile_view to expose new columns
DROP VIEW IF EXISTS public.public_profile_view;
CREATE VIEW public.public_profile_view AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.avatar_url,
  p.website,
  p.twitter_username,
  p.location,
  p.published,
  p.profile_type,
  p.hero_image_url,
  p.hero_video_url,
  p.hero_title,
  p.analytics_visibility,
  CASE WHEN p.analytics_visibility = 'public' THEN p.followers_total ELSE NULL END AS followers_total,
  CASE WHEN p.analytics_visibility = 'public' THEN p.avg_engagement_rate ELSE NULL END AS avg_engagement_rate,
  CASE WHEN p.analytics_visibility = 'public' THEN p.xscore ELSE NULL END AS xscore,
  p.public_layout,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.published = true
  AND p.username IS NOT NULL AND p.username <> '';

GRANT SELECT ON public.public_profile_view TO anon;

COMMIT;
