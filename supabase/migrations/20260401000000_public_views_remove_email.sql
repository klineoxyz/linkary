-- P0 privacy: Remove profiles.email from public views.
-- profiles.email is auth/user email (synced from auth or set in settings). It must not be exposed
-- to anonymous users, logged-in non-owners, or any discovery/search consumers.
-- If the product needs a public contact email later, implement a separate explicit optional column
-- (e.g. public_contact_email) and expose only that in views, never auth email.
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
  p.meta,
  CASE WHEN p.analytics_visibility = 'public' THEN p.followers_total ELSE NULL END AS followers_total,
  CASE WHEN p.analytics_visibility = 'public' THEN p.avg_engagement_rate ELSE NULL END AS avg_engagement_rate,
  CASE WHEN p.analytics_visibility = 'public' THEN p.ethos_score ELSE NULL END AS ethos_score,
  CASE WHEN p.analytics_visibility = 'public' THEN p.xscore ELSE NULL END AS xscore,
  p.rep_score,
  p.public_layout,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.published = true
  AND p.username IS NOT NULL AND p.username <> '';

GRANT SELECT ON public.public_profile_view TO anon;

DROP VIEW IF EXISTS public.public_profile_preview_view;
CREATE VIEW public.public_profile_preview_view AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.avatar_url,
  p.website,
  p.twitter_username,
  p.location,
  p.profile_type,
  p.hero_image_url,
  p.hero_video_url,
  p.hero_title,
  p.analytics_visibility,
  p.meta,
  CASE WHEN p.analytics_visibility = 'public' THEN p.followers_total ELSE NULL END AS followers_total,
  CASE WHEN p.analytics_visibility = 'public' THEN p.avg_engagement_rate ELSE NULL END AS avg_engagement_rate,
  CASE WHEN p.analytics_visibility = 'public' THEN p.ethos_score ELSE NULL END AS ethos_score,
  CASE WHEN p.analytics_visibility = 'public' THEN p.xscore ELSE NULL END AS xscore,
  p.rep_score,
  p.public_layout,
  p.created_at,
  p.updated_at
FROM public.profiles p;

COMMENT ON VIEW public.public_profile_preview_view IS 'Display fields for owner preview of unpublished profile. Server-only; do not grant anon. No email.';
REVOKE ALL ON public.public_profile_preview_view FROM anon;
REVOKE ALL ON public.public_profile_preview_view FROM authenticated;
REVOKE ALL ON public.public_profile_preview_view FROM PUBLIC;
GRANT SELECT ON public.public_profile_preview_view TO service_role;
