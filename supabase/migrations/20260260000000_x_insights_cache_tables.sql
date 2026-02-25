-- Phase 4: X insights cache tables for twitterapi.io (top followers, mentions, account feed).
-- Server-managed caches: RLS default deny; only service role reads/writes.
-- /api/social/x/insights reads via service role and returns safe subset.

-- 1) x_top_followers_cache: one row per profile, JSON by tier
CREATE TABLE IF NOT EXISTS public.x_top_followers_cache (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.x_top_followers_cache IS 'Cached top followers by tier (influencers/projects/funds) from twitterapi.io; service role only.';

-- 2) x_mentions_weekly_cache: one row per profile per week (monday week_start)
CREATE TABLE IF NOT EXISTS public.x_mentions_weekly_cache (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  week_start date NOT NULL,
  data jsonb NOT NULL DEFAULT '[]'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, week_start)
);

CREATE INDEX IF NOT EXISTS idx_x_mentions_weekly_cache_profile_week
  ON public.x_mentions_weekly_cache (profile_id, week_start DESC);

COMMENT ON TABLE public.x_mentions_weekly_cache IS 'Cached mentions per week; service role only.';

-- 3) x_account_feed_cache: one row per profile, feed JSON
CREATE TABLE IF NOT EXISTS public.x_account_feed_cache (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.x_account_feed_cache IS 'Cached account feed (actions + new followers); service role only.';

-- RLS: default deny; no policies for anon/auth so only service role (bypasses RLS) can access
ALTER TABLE public.x_top_followers_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_mentions_weekly_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.x_account_feed_cache ENABLE ROW LEVEL SECURITY;

-- No SELECT/INSERT/UPDATE/DELETE policies: anon and authenticated get no rows; service role bypasses RLS.
