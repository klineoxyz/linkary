-- Harden identity at DB level: no duplicate X identity across profiles or social_accounts.
-- Makes merges impossible even if app code bugs exist.

-- Slug history: btree on old_slug so eq("old_slug", segmentNorm) uses an index (trigger stores normalized lowercase).
CREATE INDEX IF NOT EXISTS idx_profile_slug_history_old_slug_btree
  ON public.profile_slug_history (old_slug);

-- A) One twitter_user_id per profile globally (no two profiles can share the same X user ID).
CREATE UNIQUE INDEX IF NOT EXISTS profiles_twitter_user_id_unique
  ON public.profiles (twitter_user_id)
  WHERE twitter_user_id IS NOT NULL AND btrim(twitter_user_id) <> '';

-- B) One (provider, provider_user_id) globally: one X account cannot appear in multiple rows.
-- Stronger than idx_social_accounts_one_x_per_provider_user (which only applies when revoked_at IS NULL AND status = 'connected').
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_provider_identity_unique
  ON public.social_accounts (provider, provider_user_id)
  WHERE provider_user_id IS NOT NULL AND btrim(provider_user_id) <> '';

-- C) One row per (user_id, provider): no duplicate provider linkage per user.
CREATE UNIQUE INDEX IF NOT EXISTS social_accounts_user_provider_unique
  ON public.social_accounts (user_id, provider);

COMMENT ON INDEX public.profiles_twitter_user_id_unique IS 'X user ID is unique across profiles; two different X accounts cannot map to the same profile.';
COMMENT ON INDEX public.social_accounts_provider_identity_unique IS 'Provider identity is unique; one X account cannot be linked to multiple users.';
COMMENT ON INDEX public.social_accounts_user_provider_unique IS 'One provider row per user (e.g. one Twitter link per user).';
