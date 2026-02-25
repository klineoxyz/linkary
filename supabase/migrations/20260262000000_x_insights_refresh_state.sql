-- Phase 6: Global rate-limit state for X insights refresh (twitterapi.io backoff).
-- key='global' stores rate_limited_until; no policies (service only).

CREATE TABLE IF NOT EXISTS public.x_insights_refresh_state (
  key text PRIMARY KEY,
  rate_limited_until timestamptz NULL,
  last_error text NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.x_insights_refresh_state IS 'Global/per-key state for X insights refresh; service role only. key=global for rate limit backoff.';

ALTER TABLE public.x_insights_refresh_state ENABLE ROW LEVEL SECURITY;
