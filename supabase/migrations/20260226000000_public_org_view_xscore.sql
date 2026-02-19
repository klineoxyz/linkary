-- Add xscore to public_org_view (orgs.xscore added in 20260225)
-- Drop and recreate so column order can change (REPLACE would fail when adding a column)
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
  o.created_at,
  o.updated_at
FROM public.orgs o;
GRANT SELECT ON public.public_org_view TO anon;
