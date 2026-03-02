-- Classified tweet sync error for debug panel (last sync time + last error).
-- Set by worker sync_x_tweets_weekly on failure; cleared on success.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS x_last_tweets_sync_error text,
  ADD COLUMN IF NOT EXISTS x_last_tweets_sync_error_at timestamptz;

COMMENT ON COLUMN public.profiles.x_last_tweets_sync_error IS 'Classified: auth_invalid, rate_limited, provider_down, unknown. Cleared on success.';
COMMENT ON COLUMN public.profiles.x_last_tweets_sync_error_at IS 'When x_last_tweets_sync_error was set (ingestion failure).';
