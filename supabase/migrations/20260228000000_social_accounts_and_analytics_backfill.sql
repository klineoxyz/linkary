-- =============================================================================
-- Social accounts (persist X/social connections) + analytics backfill tables
-- =============================================================================

-- 1) social_accounts: durable connection state (user_id + provider)
CREATE TABLE IF NOT EXISTS public.social_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider text NOT NULL,
  provider_user_id text,
  username text,
  access_token text,
  refresh_token text,
  token_expires_at timestamptz,
  scopes text[],
  profile_json jsonb,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  status text NOT NULL DEFAULT 'connected' CHECK (status IN ('connected', 'revoked', 'error')),
  UNIQUE(user_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_social_accounts_user_provider ON public.social_accounts (user_id, provider);
CREATE INDEX IF NOT EXISTS idx_social_accounts_status ON public.social_accounts (user_id, provider, status) WHERE revoked_at IS NULL;
ALTER TABLE public.social_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "social_accounts_select_own" ON public.social_accounts;
CREATE POLICY "social_accounts_select_own" ON public.social_accounts FOR SELECT USING (auth.uid() = user_id);
DROP POLICY IF EXISTS "social_accounts_insert_own" ON public.social_accounts;
CREATE POLICY "social_accounts_insert_own" ON public.social_accounts FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "social_accounts_update_own" ON public.social_accounts;
CREATE POLICY "social_accounts_update_own" ON public.social_accounts FOR UPDATE USING (auth.uid() = user_id);

COMMENT ON TABLE public.social_accounts IS 'Persisted OAuth/social connections; connection state from DB not session-only.';

-- 2) x_daily_snapshots: one row per (owner, day) for 7D/30D/90D windows
CREATE TABLE IF NOT EXISTS public.x_daily_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  day date NOT NULL,
  followers int,
  following int,
  tweets_count int,
  likes_received int,
  retweets_received int,
  replies_received int,
  impressions int,
  engagement_rate numeric,
  reach_estimate int,
  raw jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, day)
);

CREATE INDEX IF NOT EXISTS idx_x_daily_snapshots_owner_day ON public.x_daily_snapshots (owner_type, owner_id, day DESC);
ALTER TABLE public.x_daily_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_daily_snapshots_select_own_or_public" ON public.x_daily_snapshots;
CREATE POLICY "x_daily_snapshots_select_own_or_public" ON public.x_daily_snapshots
  FOR SELECT USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = x_daily_snapshots.owner_id AND m.user_id = auth.uid()))
    OR (owner_type = 'profile' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = x_daily_snapshots.owner_id AND p.published = true))
  );

-- 3) x_window_aggregates: computed 7/30/90 day windows
CREATE TABLE IF NOT EXISTS public.x_window_aggregates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  window_days int NOT NULL CHECK (window_days IN (7, 30, 90)),
  as_of date NOT NULL,
  followers_start int,
  followers_end int,
  followers_delta int,
  avg_engagement_rate numeric,
  avg_likes_per_post numeric,
  avg_replies_per_post numeric,
  avg_retweets_per_post numeric,
  reach_avg numeric,
  spaces_count int,
  posts_count int,
  raw jsonb,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(owner_type, owner_id, window_days, as_of)
);

CREATE INDEX IF NOT EXISTS idx_x_window_aggregates_owner ON public.x_window_aggregates (owner_type, owner_id, window_days);
ALTER TABLE public.x_window_aggregates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "x_window_aggregates_select_own_or_public" ON public.x_window_aggregates;
CREATE POLICY "x_window_aggregates_select_own_or_public" ON public.x_window_aggregates
  FOR SELECT USING (
    (owner_type = 'profile' AND owner_id = auth.uid())
    OR (owner_type = 'org' AND EXISTS (SELECT 1 FROM public.org_members m WHERE m.org_id = x_window_aggregates.owner_id AND m.user_id = auth.uid()))
    OR (owner_type = 'profile' AND EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = x_window_aggregates.owner_id AND p.published = true))
  );

-- 4) analytics_jobs: queue for backfill and refresh
CREATE TABLE IF NOT EXISTS public.analytics_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL,
  owner_type text NOT NULL CHECK (owner_type IN ('profile', 'org')),
  owner_id uuid NOT NULL,
  run_after timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued', 'running', 'done', 'failed')),
  attempts int NOT NULL DEFAULT 0,
  last_error text,
  payload jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_analytics_jobs_status_run ON public.analytics_jobs (status, run_after);
CREATE INDEX IF NOT EXISTS idx_analytics_jobs_owner ON public.analytics_jobs (owner_type, owner_id, job_type);
ALTER TABLE public.analytics_jobs ENABLE ROW LEVEL SECURITY;

-- Only service role / worker inserts and updates jobs (no anon policy for insert/update)
