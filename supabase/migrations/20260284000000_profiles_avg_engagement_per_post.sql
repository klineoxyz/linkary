-- REP quality: canonical engagement input as raw count (avg engagement per post).
-- Used by computeRep() with log scaling (cap 5000) so strong engagement scores higher
-- without whales dominating. Populated by x rollup job from x_analytics_rollups / x_tweets.
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS avg_engagement_per_post numeric DEFAULT NULL;

COMMENT ON COLUMN public.profiles.avg_engagement_per_post IS 'Average engagement per post (likes + 2*replies + reposts) over 30d window. Raw count; REP uses logScale100(., 5000). Set by rollup job.';
