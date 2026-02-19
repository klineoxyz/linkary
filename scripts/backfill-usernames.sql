-- =============================================================================
-- One-time: Backfill usernames table from existing profiles and orgs,
-- and rename unverified placeholders to test-* so verified X users can claim.
-- Run AFTER migration 20260221000000_usernames_claim.sql.
-- Use with care: run in a transaction and verify, then commit.
-- =============================================================================

BEGIN;

-- 1) Rename unverified profile usernames to test-<shortid> so they don't block claims
WITH unverified AS (
  SELECT id, username
  FROM public.profiles
  WHERE twitter_connected_at IS NULL
    AND username IS NOT NULL
    AND trim(username) <> ''
),
renamed AS (
  SELECT id, username,
    'test-' || left(replace(id::text, '-', ''), 8) AS new_username
  FROM unverified
)
UPDATE public.profiles p
SET username = r.new_username, updated_at = now()
FROM renamed r
WHERE p.id = r.id;

-- 2) Insert usernames for all profiles (use same normalizer as RPC)
INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
SELECT
  public.normalize_username(username),
  'profile',
  id,
  CASE WHEN twitter_connected_at IS NOT NULL THEN 'x' ELSE NULL END,
  twitter_connected_at
FROM public.profiles
WHERE username IS NOT NULL AND trim(username) <> ''
  AND public.normalize_username(username) <> ''
ON CONFLICT (username) DO UPDATE SET
  owner_id = excluded.owner_id,
  owner_type = excluded.owner_type,
  provider = excluded.provider,
  verified_at = excluded.verified_at;

-- 3) Rename unverified org slugs that conflict with profile usernames (optional: only if you use shared namespace)
-- Here we only backfill orgs; takeover from org is handled by claim_username_for_org
INSERT INTO public.usernames (username, owner_type, owner_id, provider, verified_at)
SELECT
  public.normalize_username(slug),
  'org',
  id,
  NULL,
  NULL
FROM public.orgs
WHERE slug IS NOT NULL AND trim(slug) <> ''
  AND public.normalize_username(slug) <> ''
ON CONFLICT (username) DO NOTHING;

COMMIT;

-- Verification: list usernames and owners
-- SELECT u.username, u.owner_type, u.owner_id, u.verified_at FROM public.usernames u ORDER BY u.username;
