-- =============================================================================
-- Option B follow-up: profile must not hold desicryptoclub in twitter_username.
-- Audit uses both profiles.username and profiles.twitter_username; clearing
-- username alone left twitter_username = desicryptoclub, so collision persisted.
-- =============================================================================

UPDATE public.profiles
SET twitter_username = NULL,
    updated_at = now()
WHERE id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed'
  AND LOWER(TRIM(REPLACE(COALESCE(twitter_username, ''), '@', ''))) = 'desicryptoclub';
