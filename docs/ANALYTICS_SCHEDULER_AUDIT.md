# X Analytics Scheduler Audit

**Railway is the single source of truth for X analytics scheduling.** The web app (Vercel) does not run analytics crons; freshness does not depend on Vercel.

---

## 1. Railway cron jobs (scheduling authority)

| Cron name | Script | Recommended schedule | What it does |
|-----------|--------|----------------------|---------------|
| **sync:x:profiles:daily** | `pnpm run sync:x:profiles:daily` → `sync_x_profiles_daily.js` | **Daily** (e.g. `0 8 * * *`) | Profile info (followers, bio, avatar) + today’s `x_daily_snapshots` for eligible profiles. |
| **sync:x:tweets:daily** | `pnpm run sync:x:tweets:daily` → `sync_x_tweets_weekly.js` | **Every 6 hours** (e.g. `0 */6 * * *`) | Tweet ingestion into `x_tweets`, legacy rollups (`x_analytics_rollups`), then **enqueues** `x_backfill_90d` jobs for profiles with missing/stale 90d. |
| **linkary-queue-drainer** | `pnpm run run:jobs` → `run_analytics_jobs.js` | **Every 2–5 minutes** | Picks one queued `x_backfill_90d` job, runs it → writes `x_daily_snapshots` + `x_window_aggregates`. |

Schedules are configured in the **Railway dashboard** (Cron Runs). In-repo: `apps/worker/railway.toml` (comments) and `apps/worker/package.json` (scripts).

---

## 2. Which system triggers X ingestion?

| Trigger | Source | Frequency | What it does |
|--------|--------|-----------|----------------|
| **Railway: sync:x:tweets:daily** | `apps/worker` → `pnpm run sync:x:tweets:daily` → `sync_x_tweets_weekly.ts` | **Every 6h** (when cron set to `0 */6 * * *`) | Fetches tweets (twitterapi.io), inserts into `x_tweets`, calls `refreshXRollupsForProfile` → `x_analytics_rollups` + `x_top_drivers`. At end calls `enqueueXBackfill90d()` so queue drainer can refresh `x_window_aggregates`. |

Eligible profiles: `profiles` with `twitter_username` and `twitter_connected_at` set. Incremental: only syncs where `x_last_tweets_sync_at` is null or older than **6 hours** (not 6 days).

---

## 3. Which system triggers rollups / snapshots?

| Data | Written by | Trigger |
|------|------------|---------|
| **x_analytics_rollups** | Worker `refreshXRollupsForProfile` | During sync:x:tweets:daily (after ingest per profile). |
| **x_daily_snapshots** (today only) | Worker `sync_x_profiles_daily` | sync:x:profiles:daily. |
| **x_daily_snapshots** (90d history) | Worker `runXBackfill90d` | linkary-queue-drainer when it runs an `x_backfill_90d` job. |
| **x_window_aggregates** | Worker `runXBackfill90d` only | linkary-queue-drainer; jobs are enqueued by sync:x:tweets:daily (when 90d missing or stale 24h). |

---

## 4. Frequency and env

| Component | Intended frequency | Where configured |
|-----------|--------------------|------------------|
| **sync:x:profiles:daily** | Daily | Railway Cron Runs |
| **sync:x:tweets:daily** | Every 6 hours | Railway Cron Runs |
| **linkary-queue-drainer** | Every 2–5 minutes | Railway Cron Runs |

No `vercel.json` crons for analytics. Web cron routes (e.g. `/api/cron/sync-x-tweets-weekly`, `/api/cron/x-analytics-refresh`) exist for **manual** or on-demand use only; analytics freshness does **not** depend on them.

---

## 5. Logging (worker)

Worker logs use clear prefixes for observability:

| Prefix | When | Example |
|--------|------|---------|
| **[INGEST]** | Tweet sync script | `[INGEST] profile_id=... twitter_username=... tweets_inserted=...` |
| **[ROLLUP]** | After legacy rollup refresh, or after backfill job writes aggregates | `[ROLLUP] profile_id=... updated` |
| **[BACKFILL]** | Queue drainer processing `x_backfill_90d` | `[BACKFILL] start job_id=... profile_id=...` then `[BACKFILL] success job_id=... profile_id=...` or `[BACKFILL] failed job_id=... profile_id=... error=...` |

---

## 6. Endpoints and auth

| Endpoint | Method | Auth | Purpose |
|----------|--------|------|---------|
| `/api/cron/x-analytics-daily` | POST | `CRON_SECRET` | Manual / on-demand: today’s snapshot (social_accounts). |
| `/api/cron/sync-x-profiles-daily` | POST | `CRON_SECRET` | Manual: today’s snapshot (profiles.is_indexed). |
| `/api/cron/sync-x-tweets-weekly` | POST | `CRON_SECRET` | Manual: same ingestion logic as worker. |
| `/api/cron/backfill-x-90d-batch` | POST | `CRON_SECRET` | Manual: enqueue backfill jobs only. |
| `/api/cron/x-analytics-refresh` | POST | `CRON_SECRET` | Manual: ingest + snapshot + enqueue (web path; not used by Railway). |
| `/api/cron/health/x-analytics` | GET | `CRON_SECRET` | Pipeline health: last_ingestion_run_at, last_rollup_run_at, counts, last_error. |
| **Worker** `run_analytics_jobs.js` | N/A | Supabase service role | Picks one queued job, runs `runXBackfill90d`, marks done/failed. |

---

## 7. Files reference

| Purpose | File(s) |
|---------|--------|
| Worker cron scripts | `apps/worker/package.json` (scripts), `apps/worker/railway.toml` (comments) |
| Tweet ingestion (6h window + enqueue) | `apps/worker/src/sync_x_tweets_weekly.ts` |
| Profile/snapshot daily | `apps/worker/src/sync_x_profiles_daily.ts` |
| Enqueue backfill (worker) | `apps/worker/src/lib/enqueueXBackfill.ts` |
| Queue drainer | `apps/worker/src/run_analytics_jobs.ts` → `jobs/xBackfill90d.ts` |
| Legacy rollups | `apps/worker/src/lib/refreshXRollups.ts` |
| Web cron routes (manual only) | `apps/web/src/app/api/cron/*` |
| Health | `apps/web/src/app/api/cron/health/x-analytics/route.ts` |

---

## 8. Freshness guarantees

- **Tweet ingestion:** Every 6h (sync:x:tweets:daily with schedule `0 */6 * * *`).
- **Queue drainer:** Every 2–5 min so enqueued backfill jobs are processed quickly.
- **Backfill enqueue:** Only when 90d aggregate is missing or `x_window_aggregates.updated_at` is older than 24h (see `enqueueXBackfill90d` in worker).

Result: `x_window_aggregates.updated_at` advances at least daily for active connected accounts; debug panel should not show >24h stale data when Railway crons are running as above.
