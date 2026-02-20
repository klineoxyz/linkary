-- public_views_privacy: add analytics_visibility (profiles), published (orgs), recreate views with gating/filtering
BEGIN;

-- 1) Profiles analytics visibility
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'analytics_visibility'
  ) THEN
    ALTER TABLE public.profiles
      ADD COLUMN analytics_visibility text NOT NULL DEFAULT 'public';
    COMMENT ON COLUMN public.profiles.analytics_visibility IS 'Controls whether analytics fields are exposed on public views. Values: public, private';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_analytics_visibility_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_analytics_visibility_check
      CHECK (analytics_visibility IN ('public', 'private'));
  END IF;
END $$;

-- 2) Orgs published flag
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'orgs' AND column_name = 'published'
  ) THEN
    ALTER TABLE public.orgs
      ADD COLUMN published boolean NOT NULL DEFAULT false;
    COMMENT ON COLUMN public.orgs.published IS 'Whether this org is publicly listed on Linkary public pages/search.';
  END IF;
END $$;

-- 3) Recreate public_profile_view with analytics gating
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

-- 4) Recreate public_org_view with published filter
DROP VIEW IF EXISTS public.public_org_view;
CREATE VIEW public.public_org_view AS
SELECT
  o.id,
  o.slug,
  o.name,
  o.tagline,
  o.website,
  o.twitter_username,
  o.logo_url,
  o.org_type,
  o.parent_org_id,
  o.is_crypto_project,
  o.has_token,
  o.token_symbol,
  o.dexscreener_url,
  o.xscore,
  o.public_layout,
  o.published,
  o.created_at,
  o.updated_at
FROM public.orgs o
WHERE o.published = true
  AND o.slug IS NOT NULL AND o.slug <> ''
  AND o.name IS NOT NULL AND o.name <> '';

GRANT SELECT ON public.public_org_view TO anon;

-- 5) Helpful indexes
CREATE INDEX IF NOT EXISTS idx_profiles_published ON public.profiles (published);
CREATE INDEX IF NOT EXISTS idx_profiles_analytics_visibility ON public.profiles (analytics_visibility);
CREATE INDEX IF NOT EXISTS idx_orgs_published ON public.orgs (published);

COMMIT;
