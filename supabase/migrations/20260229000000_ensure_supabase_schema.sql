-- =============================================================================
-- Ensure Supabase schema is complete (idempotent). Run after all prior migrations.
-- Use: supabase db push  OR  run each migration in order in SQL Editor.
-- =============================================================================

-- 1) Profiles: ensure columns used by app exist (some may come from Auth or earlier setup)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS username text,
  ADD COLUMN IF NOT EXISTS display_name text,
  ADD COLUMN IF NOT EXISTS bio text,
  ADD COLUMN IF NOT EXISTS avatar_url text,
  ADD COLUMN IF NOT EXISTS website text,
  ADD COLUMN IF NOT EXISTS onboarding_completed_at timestamptz,
  ADD COLUMN IF NOT EXISTS public_layout jsonb DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS xscore int,
  ADD COLUMN IF NOT EXISTS twitter_username text,
  ADD COLUMN IF NOT EXISTS twitter_user_id text,
  ADD COLUMN IF NOT EXISTS twitter_connected_at timestamptz,
  ADD COLUMN IF NOT EXISTS twitter_username_candidate text,
  ADD COLUMN IF NOT EXISTS is_indexed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS x_last_profile_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS x_last_tweets_sync_at timestamptz,
  ADD COLUMN IF NOT EXISTS x_sync_status text,
  ADD COLUMN IF NOT EXISTS x_sync_error text,
  ADD COLUMN IF NOT EXISTS published boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS intents jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS followers_total bigint DEFAULT 0,
  ADD COLUMN IF NOT EXISTS avg_engagement_rate numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now() NOT NULL;

-- 2) analytics_snapshots: ensure snapshot_date exists (legacy x-sync uses it)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'analytics_snapshots')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'analytics_snapshots' AND column_name = 'snapshot_date') THEN
    ALTER TABLE public.analytics_snapshots ADD COLUMN snapshot_date date;
  END IF;
END $$;

-- 3) Grant anon read on views (required for public one-pager and entity resolver)
GRANT SELECT ON public.public_profile_view TO anon;
GRANT SELECT ON public.public_org_view TO anon;
GRANT SELECT ON public.usernames TO anon;

-- 4) ethos_scores: ensure table exists (API cache)
CREATE TABLE IF NOT EXISTS public.ethos_scores (
  userkey text PRIMARY KEY,
  score_json jsonb,
  score_value numeric,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.ethos_scores IS 'Cache for Ethos API scores by userkey; written by /api/ethos/score';
