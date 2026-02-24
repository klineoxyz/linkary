-- Search filters: indexes supporting profession and ecosystem filters
-- profile_professions(profile_id) and professions(slug) already exist (20260223000000_professions).
-- Add composite index for org_ecosystem_categories filter by org_id + category.
CREATE INDEX IF NOT EXISTS idx_org_ecosystem_categories_org_category
  ON public.org_ecosystem_categories (org_id, category);

COMMENT ON INDEX public.idx_org_ecosystem_categories_org_category IS 'Supports search filter by ecosystem category';
