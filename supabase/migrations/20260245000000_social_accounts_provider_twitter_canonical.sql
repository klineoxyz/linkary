-- =============================================================================
-- Canonical provider name: use 'twitter' (matches Supabase auth identities).
-- Read with IN ('twitter','x') for backward compatibility; write only 'twitter'.
-- =============================================================================

UPDATE public.social_accounts
SET provider = 'twitter', updated_at = COALESCE(updated_at, now())
WHERE provider = 'x';

COMMENT ON COLUMN public.social_accounts.provider IS 'Canonical value: twitter. Legacy x is normalized to twitter by this migration.';
