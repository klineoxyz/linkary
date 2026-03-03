# Analytics Phase 2: When DB Does Not Have 90D Data

Use this when the Phase 1 conclusion is: **"DB does not have 90D data for this profile."**

---

## 2A) Why it might be missing

Pick the real reason(s) for your case:

| Reason | What to check |
|--------|----------------|
| **Worker only tracks connected (or indexed) profiles** | Worker uses `profiles` with `twitter_username` and `twitter_connected_at` (or `is_indexed`). Searched-but-not-connected users may not be in the worker’s selection. |
| **Worker/cron started recently** | History is only from first run. No backfill was run for past 90 days. |
| **Data retention or cleanup** | Old rows in `x_daily_snapshots` or `x_tweets` were deleted. Check for retention jobs or manual deletes. |
| **twitterapi.io not requested historically** | Tweets/snapshots only exist from when crons/worker and API key were in place. |
| **Job queue failure or rate limit** | `analytics_jobs` (x_backfill_90d) failed or was rate-limited; worker retries but job may be stuck or delayed. |
| **Web cron not hitting worker** | `backfill-x-90d-batch` enqueues jobs; if the worker is not running, jobs never drain and 90d is never built. |

Confirm by running:

```bash
pnpm exec tsx apps/web/scripts/auditAnalyticsData.ts --user YOUR_PROFILE_UUID
```

---

## 2B) How to backfill safely

**Option 1 – Trigger existing backfill (recommended)**  
- User: Open Analytics and click **Retry** (or ensure “Rebuild” runs). That calls `POST /api/analytics/backfill-90`, which enqueues one `x_backfill_90d` job for the current user.  
- Worker must be running `run_analytics_jobs` so the job is drained.  
- Cron: `POST /api/cron/backfill-x-90d-batch` (with `CRON_SECRET`) enqueues jobs for X-connected profiles that lack 90d aggregate.

**Option 2 – Manual script (one profile)**  
- Add or use a script, e.g. `pnpm exec tsx scripts/backfillXHistory.ts --user YOUR_PROFILE_UUID --days 90`.  
- It should: call twitterapi.io (user info + last tweets), write `x_daily_snapshots` (per day) and `x_window_aggregates` (7/30/90), with rate limit (e.g. 400ms between calls), idempotent upserts, and progress logs.  
- Our architecture already has the worker job `xBackfill90d`; the script can enqueue one job for the given profile and rely on the worker, or reimplement the same logic in a one-off script.

**Option 3 – One-time backfill worker job**  
- Expose an internal or admin endpoint that enqueues `x_backfill_90d` for a given profile (or list). Worker drains as usual. Rate limits and idempotency are already in the worker.

**Idempotency:** Upserts on `(owner_type, owner_id, day)` for snapshots and on `(profile_id, tweet_id)` for tweets. Safe to rerun.

**Progress:** Worker logs; for a script, log “profile X, day Y” or “week Y” as you go.

---

## 2C) How to keep it always fresh

| Schedule | What runs | Purpose |
|----------|-----------|--------|
| **Daily** | `POST /api/cron/x-analytics-daily` | Today’s snapshot per X-connected user (social_accounts). |
| **Daily** | Worker `sync_x_profiles_daily` (if used) | Same, for profiles (is_indexed, twitter_username). |
| **Weekly or every 6h** | `POST /api/cron/sync-x-tweets-weekly` | Fetch tweets, write `x_tweets`, update rollups. |
| **Weekly** | Worker `sync_x_tweets_weekly` (if used) | Same. |
| **Daily** | `POST /api/cron/backfill-x-90d-batch` | Enqueue 90d backfill jobs for profiles that lack 90d aggregate. |
| **Continuous** | Worker `run_analytics_jobs` | Drain `analytics_jobs`, run `xBackfill90d` (90d snapshots + aggregates). |

If any of these are missing in your Railway (or env) setup, add them minimally so that:  
(1) snapshots are written at least daily,  
(2) tweets are ingested on a schedule,  
(3) 90d backfill is enqueued and drained.

See `docs/ANALYTICS_WHY_EMPTY.md` for full data flow and troubleshooting.
