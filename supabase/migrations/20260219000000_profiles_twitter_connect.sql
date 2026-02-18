-- =============================================================================
-- Linkary: X (Twitter) OAuth connection fields on profiles
-- Run after existing migrations. Used by Connect X in Settings.
-- =============================================================================

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitter_user_id text,
  ADD COLUMN IF NOT EXISTS twitter_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS twitter_username_candidate text;

COMMENT ON COLUMN public.profiles.twitter_user_id IS 'X (Twitter) provider user id from OAuth';
COMMENT ON COLUMN public.profiles.twitter_connected_at IS 'When the user connected X via Supabase OAuth';
COMMENT ON COLUMN public.profiles.twitter_username_candidate IS 'Proposed handle from OAuth when profiles.twitter_username already set (guardrail)';
