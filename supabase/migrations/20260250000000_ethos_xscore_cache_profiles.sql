-- =============================================================================
-- Ethos + XScore cache on profiles and xscore_scores table for deterministic
-- cached scores with daily refresh. Single source of truth: twitter_user_id
-- when available, else normalized twitter_username.
-- =============================================================================

-- 1) Profiles: denormalized Ethos + XScore cache for fast reads
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ethos_score numeric,
  ADD COLUMN IF NOT EXISTS ethos_score_updated_at timestamptz,
  ADD COLUMN IF NOT EXISTS xscore_updated_at timestamptz;

COMMENT ON COLUMN public.profiles.ethos_score IS 'Cached Ethos score; written by refresh-scores or daily worker';
COMMENT ON COLUMN public.profiles.ethos_score_updated_at IS 'When ethos_score was last refreshed';
COMMENT ON COLUMN public.profiles.xscore_updated_at IS 'When xscore was last refreshed (profiles.xscore already exists)';

-- 2) XScore cache table (raw response + parsed score per profile)
CREATE TABLE IF NOT EXISTS public.xscore_scores (
  profile_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  score_value numeric,
  score_json jsonb,
  updated_at timestamptz DEFAULT now() NOT NULL
);

COMMENT ON TABLE public.xscore_scores IS 'Cache for XScore per profile; written by refresh-scores or daily worker';

CREATE INDEX IF NOT EXISTS idx_xscore_scores_updated_at ON public.xscore_scores (updated_at);
