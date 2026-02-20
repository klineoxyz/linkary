-- =============================================================================
-- Identity hardening: unique case-insensitive twitter_username on profiles.
-- Run after resolving any existing duplicates (same LOWER(twitter_username)).
-- =============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS unique_twitter_username
  ON public.profiles (LOWER(TRIM(twitter_username)))
  WHERE twitter_username IS NOT NULL AND TRIM(twitter_username) <> '';

COMMENT ON INDEX public.unique_twitter_username IS 'One X handle per profile; case-insensitive. Resolve duplicates before applying.';
