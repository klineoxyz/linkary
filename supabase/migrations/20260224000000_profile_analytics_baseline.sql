-- =============================================================================
-- Linkary: Baseline snapshot per profile for "growth since joining" comparison
-- One row per (profile_id, platform); set on first successful sync.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile_analytics_baseline (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  platform text NOT NULL DEFAULT 'x',
  baseline_at timestamptz NOT NULL DEFAULT now(),
  baseline_date date NOT NULL DEFAULT (current_date),
  followers_total int,
  engagement_rate_proxy numeric,
  posts_30d int,
  avg_likes_30d numeric,
  avg_replies_30d numeric,
  reach_proxy_30d int,
  PRIMARY KEY (profile_id, platform)
);

COMMENT ON TABLE public.profile_analytics_baseline IS 'First snapshot when user/project started with Linkary; used to show growth since joining.';

CREATE INDEX IF NOT EXISTS idx_profile_analytics_baseline_profile ON public.profile_analytics_baseline (profile_id);

ALTER TABLE public.profile_analytics_baseline ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_analytics_baseline_select_own_or_public" ON public.profile_analytics_baseline;
CREATE POLICY "profile_analytics_baseline_select_own_or_public" ON public.profile_analytics_baseline
  FOR SELECT USING (
    profile_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = profile_analytics_baseline.profile_id AND p.published = true)
  );

-- Service role / cron inserts; anon with user token can insert own (for x-sync API)
DROP POLICY IF EXISTS "profile_analytics_baseline_insert_own" ON public.profile_analytics_baseline;
CREATE POLICY "profile_analytics_baseline_insert_own" ON public.profile_analytics_baseline
  FOR INSERT WITH CHECK (profile_id = auth.uid());
