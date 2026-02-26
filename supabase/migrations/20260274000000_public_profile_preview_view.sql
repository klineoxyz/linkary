-- public_profile_preview_view: same display shape as public_profile_view, no published filter.
-- Used server-side only for owner preview (after isOwner gating). No private/sensitive fields.
-- Service role only; anon cannot read.

BEGIN;

CREATE OR REPLACE VIEW public.public_profile_preview_view AS
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
  CASE WHEN p.analytics_visibility = 'public' THEN p.followers_total ELSE NULL END AS followers_total,
  CASE WHEN p.analytics_visibility = 'public' THEN p.avg_engagement_rate ELSE NULL END AS avg_engagement_rate,
  CASE WHEN p.analytics_visibility = 'public' THEN p.xscore ELSE NULL END AS xscore,
  p.public_layout,
  p.created_at,
  p.updated_at
FROM public.profiles p;

COMMENT ON VIEW public.public_profile_preview_view IS 'Display fields for owner preview of unpublished profile. Server-only; do not grant anon.';

REVOKE ALL ON public.public_profile_preview_view FROM anon;
REVOKE ALL ON public.public_profile_preview_view FROM authenticated;
REVOKE ALL ON public.public_profile_preview_view FROM PUBLIC;
GRANT SELECT ON public.public_profile_preview_view TO service_role;

COMMIT;
