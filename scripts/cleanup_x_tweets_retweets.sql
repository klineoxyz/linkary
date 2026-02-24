-- One-time cleanup: remove retweets from public.x_tweets so user analytics reflect only original posts.
-- Run in Supabase SQL Editor (or psql). Safe and idempotent; re-run is a no-op after cleanup.
--
-- Step 1: Delete retweets (text starting with "RT @" after trim)
DELETE FROM public.x_tweets
WHERE ltrim(text) ILIKE 'RT @%';

-- Step 2: Rebuild derived tables by running the worker rebuild script once (from repo root):
--   pnpm --filter worker run rebuild:x:rollups
-- Or: cd apps/worker && node dist/rebuild_x_rollups.js
--
-- This refreshes x_analytics_rollups and x_top_drivers for all profiles with twitter_connected_at set.
-- x_daily_snapshots and x_window_aggregates are repopulated by the queue drainer (x_backfill_90d jobs)
-- when jobs run; or run backfill per profile if needed.
