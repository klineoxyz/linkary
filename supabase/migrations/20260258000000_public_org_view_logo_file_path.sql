-- Expose logo_file_path on public_org_view so server can resolve signed URLs for org logos
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
  o.logo_file_path,
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
