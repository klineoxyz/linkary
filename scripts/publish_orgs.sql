-- One-time script: set published = true for orgs that are X-verified.
-- Run only after confirming orgs exist and is_x_verified is set correctly.
-- Constraint orgs_published_requires_x_verified ensures published can only be true when is_x_verified = true.

-- Preview: see which orgs would be published
-- SELECT id, slug, name, is_x_verified, published FROM public.orgs WHERE is_x_verified = true AND (published IS FALSE OR published IS NULL);

UPDATE public.orgs
SET published = true, updated_at = now()
WHERE is_x_verified = true
  AND (published IS FALSE OR published IS NULL);
