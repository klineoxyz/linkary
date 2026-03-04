-- =============================================================================
-- Slug history & identity debug pack
-- Replace <PROFILE_ID> with a real profile (auth.users.id / profiles.id).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A) Profile identity
-- -----------------------------------------------------------------------------
-- Expected: twitter_user_id is set once and must never change (immutable).
-- username = public slug (can change); twitter_username = display handle (can change).
SELECT id, username, twitter_user_id, twitter_username, twitter_username_candidate
FROM public.profiles
WHERE id = '<PROFILE_ID>';

-- -----------------------------------------------------------------------------
-- B) X identity linkage (social_accounts)
-- -----------------------------------------------------------------------------
-- Expected: provider_user_id must remain constant for provider = 'twitter'.
-- A profile must not have multiple different provider_user_id for the same provider.
SELECT user_id, provider, provider_user_id, username, created_at, updated_at
FROM public.social_accounts
WHERE user_id = '<PROFILE_ID>'
ORDER BY updated_at DESC;

-- Invariant check: no profile should have more than one distinct provider_user_id per provider.
-- (Run without substitution to find violations.)
SELECT user_id, provider, count(DISTINCT provider_user_id) AS distinct_provider_ids
FROM public.social_accounts
WHERE provider IN ('twitter', 'x')
  AND provider_user_id IS NOT NULL
  AND btrim(provider_user_id) <> ''
GROUP BY user_id, provider
HAVING count(DISTINCT provider_user_id) > 1;

-- -----------------------------------------------------------------------------
-- C) Slug ownership (usernames table)
-- -----------------------------------------------------------------------------
-- Replace slugs with real usernames to check who owns them.
SELECT username, owner_type, owner_id, verified_at
FROM public.usernames
WHERE username IN ('muazxinthi', 'web3rehman');

-- -----------------------------------------------------------------------------
-- D) Slug history (profile_slug_history)
-- -----------------------------------------------------------------------------
-- Should contain only real slug changes (no empty old_slug).
SELECT id, profile_id, old_slug, new_slug, changed_at
FROM public.profile_slug_history
WHERE profile_id = '<PROFILE_ID>'
ORDER BY changed_at DESC;

-- Rows with empty old_slug should be zero after cleanup migration.
SELECT count(*) AS invalid_old_slug_count
FROM public.profile_slug_history
WHERE old_slug IS NULL OR btrim(old_slug) = '';

-- -----------------------------------------------------------------------------
-- E) Identity invariant checks (one-time; all should return 0 rows)
-- -----------------------------------------------------------------------------
-- 1) Any duplicate twitter_user_id in profiles (violates profiles_twitter_user_id_unique).
SELECT twitter_user_id, count(*)
FROM public.profiles
WHERE twitter_user_id IS NOT NULL AND btrim(twitter_user_id) <> ''
GROUP BY twitter_user_id
HAVING count(*) > 1;

-- 2) Any duplicate (provider, provider_user_id) in social_accounts (violates social_accounts_provider_identity_unique).
SELECT provider, provider_user_id, count(*)
FROM public.social_accounts
WHERE provider_user_id IS NOT NULL AND btrim(provider_user_id) <> ''
GROUP BY provider, provider_user_id
HAVING count(*) > 1;

-- 3) Any multiple rows per (user_id, provider) (violates social_accounts_user_provider_unique).
SELECT user_id, provider, count(*)
FROM public.social_accounts
GROUP BY user_id, provider
HAVING count(*) > 1;

-- Record results (one-time verification): all three queries above should return 0 rows.
-- If any return rows, fix data before relying on identity uniqueness.

-- -----------------------------------------------------------------------------
-- Identity invariants (documentation)
-- -----------------------------------------------------------------------------
-- 1. User identity = twitter_user_id (or social_accounts.provider_user_id for provider='twitter').
--    This value must NEVER change once linked.
-- 2. Two different X accounts (different provider_user_id) must never resolve to the same profile.
-- 3. profiles.username = public URL slug (can change); history stored in profile_slug_history.
-- 4. profiles.twitter_username = display handle (can change).
