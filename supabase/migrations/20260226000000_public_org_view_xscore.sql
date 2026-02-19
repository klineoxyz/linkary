-- Add xscore to public_org_view (orgs.xscore added in 20260225)
CREATE OR REPLACE VIEW public.public_org_view AS
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
