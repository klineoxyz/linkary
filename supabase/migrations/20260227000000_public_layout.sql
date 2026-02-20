-- public_layout: section order and optional hidden sections for public one-pager (owner edit only)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS public_layout jsonb DEFAULT NULL;

ALTER TABLE public.orgs
  ADD COLUMN IF NOT EXISTS public_layout jsonb DEFAULT NULL;

COMMENT ON COLUMN public.profiles.public_layout IS 'Public one-pager section order: { "order": ["hero","socials",...], "hidden": [] }';
COMMENT ON COLUMN public.orgs.public_layout IS 'Public one-pager section order for org/project/agency';

-- Views already select from base tables; add public_layout to views so public page can read it
-- Recreate views to include public_layout (select from tables)
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
  p.followers_total,
  p.avg_engagement_rate,
  p.xscore,
  p.public_layout,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.published = true AND p.username IS NOT NULL AND p.username <> '';

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
  o.created_at,
  o.updated_at
FROM public.orgs o;

GRANT SELECT ON public.public_profile_view TO anon;
GRANT SELECT ON public.public_org_view TO anon;
