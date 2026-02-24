# X analytics: exclude retweets

Retweets are no longer ingested into `x_tweets` and are excluded from rollups and top drivers. After deploying the worker changes, run a one-time cleanup for existing data.

## Code behavior (no action needed)

- **ingestXTweets** (weekly + drainer): Skips any tweet whose text (after trim) starts with `RT @`. Logs `fetched_total`, `skipped_retweets`, `upserted`.
- **refreshXRollupsForProfile**: Excludes rows where `text` is a retweet when reading from `x_tweets`.
- **xBackfill90d** (drainer): Excludes retweets when building per-day aggregates for `x_daily_snapshots` and `x_window_aggregates`.

## One-time cleanup after deploy

1. **Delete existing retweets from `x_tweets`** (Supabase SQL Editor or psql):

   ```sql
   DELETE FROM public.x_tweets
   WHERE ltrim(text) ILIKE 'RT @%';
   ```

2. **Rebuild rollups and top drivers** for all eligible profiles:

   From repo root:

   ```bash
   pnpm --filter worker run rebuild:x:rollups
   ```

   Or from `apps/worker`:

   ```bash
   node dist/rebuild_x_rollups.js
   ```

   Ensure `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) are set (e.g. in `.env` or env).

3. **Optional**: `x_daily_snapshots` and `x_window_aggregates` are repopulated when queue drainer runs `x_backfill_90d` jobs. If you need them refreshed immediately without waiting for jobs, trigger backfill per profile or re-run the drainer after the cleanup.

## Files

- **Cleanup SQL**: `scripts/cleanup_x_tweets_retweets.sql`
- **Rebuild script**: `apps/worker/src/rebuild_x_rollups.ts` → `pnpm --filter worker run rebuild:x:rollups`
