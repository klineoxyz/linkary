# Why X Analytics Might Look Empty

This doc explains how data flows into the analytics page and what to check when charts/KPIs are empty.

## Data flow (what fills the tables)

| Table / data | Written by | Trigger |
|--------------|------------|--------|
| **x_daily_snapshots** | Web cron `x-analytics-daily`, or Worker `sync_x_profiles_daily`, or Worker `xBackfill90d` | Railway cron (web) or Worker (Railway worker) |
| **x_tweets** | Web cron `sync-x-tweets-weekly`, or Worker `sync_x_tweets_weekly`, or Worker `xBackfill90d` (ingestXTweets) | Same |
| **x_window_aggregates** | **Worker only** (`xBackfill90d`) | Worker must run `run_analytics_jobs` and drain `analytics_jobs` |
| **x_top_drivers** | Web cron (via `computeAndUpsertRollups`) or Worker `refreshXRollupsForProfile` | Web cron or Worker |
| **profiles** (followers_total, x_last_*_sync_at) | x-sync (user), x-analytics-daily, sync-x-tweets-weekly, Worker | User action or cron/worker |

The analytics API reads: `profiles`, `x_daily_snapshots`, `x_tweets`, `x_window_aggregates`, `x_top_drivers`, `profile_analytics_baseline`. Chart points are built from **x_tweets** (engagement, cadence) and **x_daily_snapshots** (follower growth). KPIs use **x_window_aggregates** when present, otherwise computed from **x_tweets** (windowMetrics).

## Common reasons analytics are empty

### 1. No x_tweets for this profile

- **Web cron** `sync-x-tweets-weekly` only selects profiles where **`profiles.is_indexed = true`** and `twitter_username` is not null. If the profile was never marked indexed (e.g. missing step after X connect), tweets are never synced.
- **Worker** `sync_x_tweets_weekly` selects by `twitter_username` and `twitter_connected_at`; if the worker is not running, no tweets from that path.
- **Fix:** Ensure after X connect, `profiles.twitter_username` and `profiles.is_indexed` are set (e.g. via `api/x-sync` or auth callback). Ensure either the web cron `sync-x-tweets-weekly` or the worker tweet sync runs on a schedule (e.g. every 6h or weekly). Check **Railway**: cron for `sync-x-tweets-weekly` and worker service for `sync:x:tweets:weekly`.

### 2. No x_daily_snapshots for this profile

- **Web cron** `x-analytics-daily` selects from **social_accounts** (provider x/twitter, status=connected, revoked_at null). It writes one row per day per user to `x_daily_snapshots` with `owner_id = user_id`. So the user must have a connected X account in `social_accounts`.
- **Worker** `sync_x_profiles_daily` uses **profiles** (is_indexed, twitter_username, twitter_connected_at). If the worker is not running, no snapshots from that path.
- **Fix:** Ensure `x-analytics-daily` cron is configured in Railway and runs (e.g. daily). Ensure `CRON_SECRET` and `TWITTERAPI_API_KEY` are set in the web app env. If using worker for snapshots, ensure worker runs `sync:x:profiles:daily` on a schedule.

### 3. TWITTERAPI_API_KEY missing or invalid

- All tweet and snapshot writes depend on twitterapi.io. If `TWITTERAPI_API_KEY` is unset or wrong, `fetchXUserInfo` / `fetchXUserTweets` return null/empty and no data is written.
- **Fix:** Set `TWITTERAPI_API_KEY` (or `TWITTERAPI_IO_KEY` if that’s what the app uses) in Railway for both the web app (crons) and the worker. Test with a small script or the existing test script in `scripts/test-twitter-api.ps1`.

### 4. Crons not running or wrong URL/secret

- If Railway cron jobs are not configured, or the URL is wrong, or `CRON_SECRET` doesn’t match, the web crons (`x-analytics-daily`, `sync-x-tweets-weekly`, `backfill-x-90d-batch`) never run.
- **Fix:** In Railway, confirm cron triggers for:
  - `POST /api/cron/x-analytics-daily` (e.g. daily)
  - `POST /api/cron/sync-x-tweets-weekly` (e.g. every 6h or weekly)
  - `POST /api/cron/backfill-x-90d-batch` (e.g. daily)
  Use header `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

### 5. Worker not running (no 90d backfill, no job drain)

- **x_window_aggregates** (7/30/90) are written **only by the worker** in `xBackfill90d`. The web cron `backfill-x-90d-batch` only **enqueues** jobs into `analytics_jobs`; the worker must run `run_analytics_jobs` to drain them and write snapshots + aggregates.
- If the worker service is not running or not polling, jobs stay queued and 90d aggregates are never created. The API can still show KPIs and charts from **x_tweets** and **x_daily_snapshots** (using computed windowMetrics), but deltas and “full 90d” state depend on aggregates or at least tweets + snapshots.
- **Fix:** In Railway, ensure the worker service runs `pnpm run run:jobs` (or `node dist/run_analytics_jobs.js`) continuously, and that it has `SUPABASE_SERVICE_ROLE_KEY` and `TWITTERAPI_API_KEY`. Ensure `backfill-x-90d-batch` runs so jobs are enqueued.

### 6. Profile not eligible for sync (social_accounts vs profiles)

- **Web** `x-analytics-daily` uses **social_accounts** (user_id, username). **Web** `sync-x-tweets-weekly` uses **profiles** (id, twitter_username, **is_indexed = true**). So for tweets to sync via web cron, the profile must have `is_indexed = true`. For snapshots via web cron, the user must have a row in social_accounts with provider x/twitter and status=connected.
- **Fix:** After X connect, ensure both `social_accounts` has the connection and `profiles` has `twitter_username` and `is_indexed = true` (e.g. set in `api/x-sync` or auth callback).

## Quick checks (with ?debug=1 on the analytics page)

When you load the analytics page with `?debug=1`, the debug panel shows for the selected window:

- **Raw lengths** of `follower_growth`, `engagement_rate`, `posting_cadence` (from API).
- **Snapshot counts** 7d/30d/90d (rows in `x_daily_snapshots` in that window).
- **Verdict:** “API returns enough points” vs “API returned few points”.

If the verdict says “API returned few points”:

1. Run the **DB proof queries** in the comment at the top of `apps/web/src/app/api/analytics/x/route.ts` (replace `:profile_id` with the logged-in user’s profile id): check `x_daily_snapshots` counts and `x_tweets` count for last 90 days. If DB has 0 rows, the problem is upstream (crons/worker/env).
2. If DB has rows but API returns few points, the bug is in the API (e.g. window filter or owner_id). That’s rare; usually empty UI = empty DB for this profile.

## Summary table

| Symptom | Likely cause | Check |
|--------|----------------|------|
| No follower chart / “Building history” | Few or no `x_daily_snapshots` for this profile | x-analytics-daily cron, Worker sync_x_profiles_daily, TWITTERAPI key, social_accounts connected |
| No engagement/cadence charts / 0 posts | No `x_tweets` for this profile in window | sync-x-tweets-weekly cron, Worker sync_x_tweets_weekly, is_indexed=true, twitter_username set |
| KPIs all “—” or 0 | No rollup and no x_tweets in window | Same as above; also Worker xBackfill90d for x_window_aggregates |
| 90d view empty but 7d/30d have data | No 90d aggregates and no tweets in 90d window | Worker run_analytics_jobs + backfill-x-90d-batch enqueue; or tweet sync only has recent data |
| “Rebuild running” forever | Job stuck in “running” or worker crashed | analytics_jobs status, worker logs |

No global CSS or app code outside analytics was changed; this doc is for ops and debugging only.
