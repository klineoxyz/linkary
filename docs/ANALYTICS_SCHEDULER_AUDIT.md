# X Analytics Scheduler Audit

Single source of truth for how X ingestion and rollups are scheduled, what runs in production, and what auth protects them.

---

## 1. Which system triggers X ingestion?

| Trigger | Source | Frequency | What it does |
|--------|--------|-----------|----------------|
| **Railway Cron: linkary-worker-weekly** | `apps/worker` → `pnpm run sync:x:tweets:weekly` → `sync_x_tweets_weekly.ts` | **Weekly** (config in Railway dashboard) | Fetches tweets (twitterapi.io), inserts into `x_tweets`, calls `refreshXRollupsForProfile` → writes `x_analytics_rollups` + `x_top_drivers`. Does **not** write `x_window_aggregates`. |
| **Web cron route** | `POST /api/cron/sync-x-tweets-weekly` | Only if something calls it (e.g. Vercel Cron or external scheduler) | Same logic as worker weekly: uses `profiles.is_indexed`, fetches tweets, `insertXTweets`, `computeAndUpsertRollups`. Auth: `CRON_SECRET` (header `x-cron-secret` or `Authorization: Bearer <CRON_SECRET>`). |

**Conclusion:** Ingestion today is **weekly** (worker or web). There is **no daily** tweet ingestion in the repo unless an external scheduler calls the web route daily. No `vercel.json` crons in repo; Vercel Cron may be configured in the dashboard.

---

## 2. Which system triggers rollups / snapshots?

| Data | Written by | Trigger |
|------|------------|---------|
| **x_analytics_rollups** (legacy 7d/30d/90d KPIs) | `computeAndUpsertRollups` (web) or worker `refreshXRollupsForProfile` | `sync-x-tweets-weekly` (worker or web) |
| **x_daily_snapshots** (per-day rows) | (1) Today-only row: `x-analytics-daily` or `sync-x-profiles-daily`. (2) Full 90d history: **worker** `runXBackfill90d` only. | (1) Daily crons. (2) Queue drainer when it runs an `x_backfill_90d` job. |
| **x_window_aggregates** (7/30/90d windows) | **Worker only** in `runXBackfill90d` (after writing `x_daily_snapshots` from tweets). | **Railway linkary-queue-drainer** running `pnpm run run:jobs` and processing `analytics_jobs` with `job_type = x_backfill_90d`. |

**Conclusion:**  
- **Rollups (legacy):** weekly, with tweet sync.  
- **Snapshots (today):** daily cron (profiles or social_accounts).  
- **Snapshots (90d) + x_window_aggregates:** only when a backfill job is **enqueued** and then **processed** by the queue drainer.

---

## 3. Frequency and env (prod vs staging)

| Component | Intended frequency | Where configured | Prod vs staging |
|-----------|--------------------|------------------|------------------|
| **Railway: sync:x:profiles:daily** | Daily | Railway Cron Runs (dashboard) | Same env as Railway worker (prod/staging by project). |
| **Railway: sync:x:tweets:weekly** | Weekly | Railway Cron Runs | Same. |
| **Railway: linkary-queue-drainer** | Every 5 min (or 2 min with backlog) | Railway Cron Runs | Same. |
| **Web: POST /api/cron/x-analytics-daily** | Daily (if used) | Vercel Cron or external cron | Vercel project env; `CRON_SECRET` must be set. |
| **Web: POST /api/cron/sync-x-tweets-weekly** | Weekly (if used) | Vercel Cron or external | Same. |
| **Web: POST /api/cron/backfill-x-90d-batch** | Daily/nightly (if used) | Vercel Cron or external | Same. Enqueues jobs; does not run them. |
| **Web: POST /api/cron/x-analytics-refresh** | Every 6h (when using `apps/web/vercel.json`) | `apps/web/vercel.json` crons | Ingestion + today snapshot + enqueue backfill; one route for daily freshness. |

In-repo config: **`apps/web/vercel.json`** defines one cron: `POST /api/cron/x-analytics-refresh` at `0 */6 * * *` (every 6 hours). Other schedules remain in **Vercel** and **Railway** dashboards.

---

## 4. Endpoints and auth

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/x-analytics-daily` | POST | `CRON_SECRET` (header `x-cron-secret` or Bearer) | Today’s `x_daily_snapshots` + profile followers for **social_accounts** (X connected). |
| `/api/cron/sync-x-profiles-daily` | POST | `CRON_SECRET` | Today’s snapshot + profile update for **profiles.is_indexed** with twitter_username. |
| `/api/cron/sync-x-tweets-weekly` | POST | `CRON_SECRET` | Tweet ingestion + `x_analytics_rollups` + `x_top_drivers` for **profiles.is_indexed**. |
| `/api/cron/backfill-x-90d-batch` | POST | `CRON_SECRET` | Enqueue `x_backfill_90d` jobs into `analytics_jobs`. Worker drainer processes them. |
| `/api/cron/sync-org-influence-daily` | POST | `CRON_SECRET` | Org influence rollups (not X analytics). |
| **Worker:** `run_analytics_jobs.js` | N/A (one-shot process) | None (uses Supabase service role) | Picks one `analytics_jobs` row (queued), runs `runXBackfill90d`, marks done/failed. |

---

## 5. Why freshness can be stale

1. **Tweet ingestion is weekly** – If only the weekly worker/cron runs, `x_tweets` and chart data from it update at most weekly.  
2. **x_window_aggregates** – Only updated when **backfill jobs** run (worker). Jobs must be **enqueued** (e.g. by `backfill-x-90d-batch` or ensure-backfill) and **drained** by linkary-queue-drainer. If no one calls the enqueue endpoint or the drainer is not running, aggregates never update.  
3. **Daily snapshot only** – `x-analytics-daily` / `sync-x-profiles-daily` write **today** only; they do not backfill 90d or write `x_window_aggregates`.  
4. **Scheduler not configured** – If Vercel Cron is not set for the web cron routes, only Railway cron runs exist; if Railway schedules are wrong or disabled, nothing runs.

---

## 6. Files reference

| Purpose | File(s) |
|---------|--------|
| Web cron auth | All under `apps/web/src/app/api/cron/*` – check `CRON_SECRET`. |
| X analytics daily (today snapshot) | `apps/web/src/app/api/cron/x-analytics-daily/route.ts` |
| X profiles daily | `apps/web/src/app/api/cron/sync-x-profiles-daily/route.ts` |
| X tweets weekly (ingestion + legacy rollups) | `apps/web/src/app/api/cron/sync-x-tweets-weekly/route.ts` |
| Enqueue backfill jobs | `apps/web/src/app/api/cron/backfill-x-90d-batch/route.ts` |
| X analytics refresh (ingestion + snapshot + enqueue) | `apps/web/src/app/api/cron/x-analytics-refresh/route.ts` |
| X analytics job health | `apps/web/src/app/api/cron/health/x-analytics/route.ts` |
| Vercel Cron config | `apps/web/vercel.json` (path `/api/cron/x-analytics-refresh`, schedule `0 */6 * * *`) |
| Worker: tweet sync weekly | `apps/worker/src/sync_x_tweets_weekly.ts` |
| Worker: profiles daily | `apps/worker/src/sync_x_profiles_daily.ts` |
| Worker: run one backfill job | `apps/worker/src/run_analytics_jobs.ts` → `jobs/xBackfill90d.ts` |
| Worker build/config | `apps/worker/railway.toml`, `apps/worker/package.json` (scripts: `sync:x:profiles:daily`, `sync:x:tweets:weekly`, `run:jobs`) |
| Enqueue helper | `apps/web/src/lib/backfill-x-90d.ts` (`enqueueXBackfill90dJobs`) |
| Rollups (legacy) | `apps/web/src/lib/x-analytics-server.ts` (`computeAndUpsertRollups`), `apps/worker/src/lib/refreshXRollups.ts` |

---

## 7. Implemented (post-audit)

- **GET /api/cron/health/x-analytics** – Service-only; returns `scheduler_present`, `last_ingestion_run_at`, `last_rollup_run_at`, `last_success_at`, `last_error_at`, `counts` (ingested_last_24h_tweets, updated_rollups_last_24h_profiles). Use for pipeline visibility.
- **POST /api/cron/x-analytics-refresh** – Service-only; for X-connected profiles (social_accounts): ingest tweets, update today’s `x_daily_snapshots`, legacy rollups, then enqueue `x_backfill_90d` (with force refresh when 90d is stale). Worker drainer fills `x_window_aggregates`.
- **apps/web/vercel.json** – Cron `0 */6 * * *` for `/api/cron/x-analytics-refresh`. Ensure `CRON_SECRET` is set in Vercel so the cron can authenticate.
- **Failure visibility** – Refresh route logs `[x-analytics-refresh] start`, `success` (profile_id, twitter_username), and `error` (profile_id, twitter_username, error). Health endpoint surfaces `last_error_at` and `last_error_message` from `analytics_jobs`.
