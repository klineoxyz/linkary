-- =============================================================================
-- Linkary: X analytics ingestion – profiles columns, snapshots, tweets, rollups, top drivers
-- Run after profiles_twitter_connect. No sync-on-load; cron/worker fills these.
-- =============================================================================

-- =============================================================================
-- 1) profiles: X sync and indexing columns
-- =============================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS twitter_username text,
  ADD COLUMN IF NOT EXISTS is_indexed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS x_last_profile_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS x_last_tweets_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS x_sync_status text,
  ADD COLUMN IF NOT EXISTS x_sync_error text;

COMMENT ON COLUMN public.profiles.twitter_username IS 'X handle; single source of truth; do not overwrite non-empty with arbitrary value';
COMMENT ON COLUMN public.profiles.is_indexed IS 'If true, profile is eligible for daily/weekly X analytics cron';
COMMENT ON COLUMN public.profiles.x_last_profile_sync_at IS 'Last time profile snapshot (followers etc) was synced';
COMMENT ON COLUMN public.profiles.x_last_tweets_sync_at IS 'Last time tweets were ingested for this profile';
COMMENT ON COLUMN public.profiles.x_sync_status IS 'Last sync status: ok, error, skipped';
COMMENT ON COLUMN public.profiles.x_sync_error IS 'Last sync error message if any';

CREATE INDEX IF NOT EXISTS idx_profiles_is_indexed_twitter ON public.profiles (is_indexed, twitter_username)
  WHERE is_indexed = true AND twitter_username IS NOT NULL AND twitter_username <> '';

-- =============================================================================
-- 2) analytics_snapshots (daily profile snapshots for deltas)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.analytics_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'x',
  snapshot_date date NOT NULL,
  followers_total int,
  engagement_rate_proxy numeric,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(profile_id, platform, snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_analytics_snapshots_profile_platform_date
  ON public.analytics_snapshots (profile_id, platform, snapshot_date DESC);

ALTER TABLE public.analytics_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_snapshots_select_own_or_public" ON public.analytics_snapshots;
CREATE POLICY "analytics_snapshots_select_own_or_public" ON public.analytics_snapshots
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = analytics_snapshots.profile_id AND p.published = true)
  );

-- Service role / cron will INSERT (no policy for anon); use service role key in cron.

-- =============================================================================
-- 3) x_tweets (weekly ingestion, max 50 per user per run)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.x_tweets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  tweet_id text NOT NULL,
  tweeted_at timestamptz NOT NULL,
  text text,
  like_count int DEFAULT 0,
  reply_count int DEFAULT 0,
  repost_count int DEFAULT 0,
  quote_count int DEFAULT 0,
  impression_count int,
  raw jsonb,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(profile_id, tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_x_tweets_profile_tweeted_at ON public.x_tweets (profile_id, tweeted_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_x_tweets_profile_tweet_id ON public.x_tweets (profile_id, tweet_id);

ALTER TABLE public.x_tweets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_tweets_select_own_or_public" ON public.x_tweets;
CREATE POLICY "x_tweets_select_own_or_public" ON public.x_tweets
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = x_tweets.profile_id AND p.published = true)
  );

-- =============================================================================
-- 4) x_analytics_rollups (computed from x_tweets for fast UI reads)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.x_analytics_rollups (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  updated_at timestamptz DEFAULT now() NOT NULL,
  posts_7d int DEFAULT 0,
  posts_30d int DEFAULT 0,
  posts_90d int DEFAULT 0,
  avg_likes_7d numeric DEFAULT 0,
  avg_likes_30d numeric DEFAULT 0,
  avg_likes_90d numeric DEFAULT 0,
  avg_replies_7d numeric DEFAULT 0,
  avg_replies_30d numeric DEFAULT 0,
  avg_replies_90d numeric DEFAULT 0,
  engagement_rate_7d numeric DEFAULT 0,
  engagement_rate_30d numeric DEFAULT 0,
  engagement_rate_90d numeric DEFAULT 0,
  reach_proxy_7d int DEFAULT 0,
  reach_proxy_30d int DEFAULT 0,
  reach_proxy_90d int DEFAULT 0
);

ALTER TABLE public.x_analytics_rollups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_analytics_rollups_select_own_or_public" ON public.x_analytics_rollups;
CREATE POLICY "x_analytics_rollups_select_own_or_public" ON public.x_analytics_rollups
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = x_analytics_rollups.profile_id AND p.published = true)
  );

-- =============================================================================
-- 5) x_top_drivers (top 10 tweets by engagement in 30D window)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.x_top_drivers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  window_days int NOT NULL,
  tweet_id text NOT NULL,
  tweeted_at timestamptz,
  like_count int DEFAULT 0,
  reply_count int DEFAULT 0,
  repost_count int DEFAULT 0,
  engagement_score numeric DEFAULT 0,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(profile_id, window_days, tweet_id)
);

CREATE INDEX IF NOT EXISTS idx_x_top_drivers_profile_window ON public.x_top_drivers (profile_id, window_days);

ALTER TABLE public.x_top_drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_top_drivers_select_own_or_public" ON public.x_top_drivers;
CREATE POLICY "x_top_drivers_select_own_or_public" ON public.x_top_drivers
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = x_top_drivers.profile_id AND p.published = true)
  );
