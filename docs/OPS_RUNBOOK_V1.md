# Ops Runbook V1 — Production Readiness

Repo-grounded runbook for verifying env, readiness, worker, and cron before onboarding users.

---

## Required environment variables

### Vercel (Next.js app)

| Variable | Required | Purpose |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Anon key for client auth |
| `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY` | Yes | Service client (rate limits, public profile, ensure-backfill, owner preview) |
| `NEXT_PUBLIC_SITE_URL` | Yes (prod) | Auth callback redirect; e.g. `https://linkary.xyz` |
| `CRON_SECRET` | Only if using /api/cron/* | Protects `/api/cron/*` when called from Vercel/external cron; not needed for Railway workers |
| `TWITTERAPI_API_KEY` | Yes for X analytics | twitterapi.io; cron and worker |
| `ETHOS_CLIENT_ID` | Optional | Ethos API; default `linkary@1` |
| `SUPERADMIN_EMAILS` | Optional | Comma-separated emails for admin/queue-status |
| `OPS_ENABLED` | Optional | If set (e.g. `true`), `/ops` page is reachable without auth |

### Railway (worker)

| Variable | Required | Purpose |
|----------|----------|---------|
| `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY` | Yes | Service client for `analytics_jobs` |
| `TWITTERAPI_API_KEY` | Yes | twitterapi.io for 90d backfill |

---

## Railway worker config (critical)

**All worker cron services MUST use Root Directory = `apps/worker`.**  
If the worker service uses repo root or `apps/api`, Railway can pick up **apps/api/railway.toml** and run `npm run start` (API server). Cron jobs would then never ingest tweets; they would stay "Running" like a server. Use **apps/worker** so Railway uses **apps/worker/railway.toml** (build only; no long-lived start).

| Setting | Value |
|--------|--------|
| Root Directory | **`apps/worker`** (required for all worker services) |
| Build Command | `corepack enable && corepack prepare pnpm@9.15.0 --activate && pnpm install && pnpm run build` (or use config from `apps/worker/railway.toml`) |
| Required env | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`), `TWITTERAPI_API_KEY` |

**Cron start commands (one-shot; each run should complete and exit, not stay Running):**

| Service | Start command (override per cron run) |
|---------|----------------------------------------|
| Daily (profiles) | `pnpm run sync:x:profiles:daily` |
| Weekly (tweets) | `pnpm run sync:x:tweets:weekly` |
| Queue drainer | `pnpm run run:jobs` or `node dist/run_analytics_jobs.js` |

Expected behaviour: each cron run **completes in seconds/minutes** and exits 0. If a worker service stays "Running" for a long time, it is likely running the wrong start command (e.g. API server from apps/api config).

---

## Railway queue drainer (required)

All scheduled jobs run via **Railway Cron Runs**, not Vercel Cron. The analytics queue is drained only by the **linkary-queue-drainer** service.

**Services:**

- **linkary-worker** (daily): runs `sync:x:profiles:daily` (X profile snapshots). Root: **apps/worker**.
- **linkary-worker-weekly**: runs `sync:x:tweets:weekly` (tweet ingestion into `x_tweets`). Root: **apps/worker**.
- **linkary-queue-drainer**: **only** service that processes `analytics_jobs` (run:jobs). Root: **apps/worker**. Must run on a schedule so that `queued` decreases and `done` increases.

**linkary-queue-drainer setup:**

| Setting | Value |
|--------|--------|
| Service name | `linkary-queue-drainer` |
| Root Directory | **`apps/worker`** |
| Start Command | `pnpm run run:jobs` or `node dist/run_analytics_jobs.js` |
| Schedule | Every **5 minutes** normally; every **2 minutes** while a backlog exists, then switch back to 5. |
| Required env | `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`), `TWITTERAPI_API_KEY` |

**Verification:**

- Call **GET /api/readiness** (no auth). When the drainer is working:
  - `checks.analyticsQueue.queued` decreases over time.
  - `checks.analyticsQueue.done` increases.
  - `checks.queueDrainer.ok` is `true` when there is no backlog, or when there is a backlog but a job completed in the last 30 minutes.
- If `queued` is high and not moving, or `queueDrainer.ok` is `false`, the drainer is not running or is failing.

**Failure modes and fixes:**

| Problem | Fix |
|--------|-----|
| `dist/run_analytics_jobs.js` missing | Add/verify a build step for the worker (e.g. `pnpm build` in `/apps/worker`) before the start command runs. |
| Env missing | Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`), and `TWITTERAPI_API_KEY` in the queue-drainer service and redeploy. |
| `queued` not decreasing | Cron not running or runs failing. Open the **Cron Run** logs for linkary-queue-drainer in Railway and fix errors (e.g. missing env, Twitter API rate limit). |

**Note:** `CRON_SECRET` is only for protecting **/api/cron/\*** routes (e.g. if you call them from Vercel Cron or an external scheduler). Railway cron workers do **not** use `CRON_SECRET`; they run the worker process directly.

---

## Analytics UI: why KPIs and charts can show 0

The analytics page (X) reads from:

- **KPI tiles** (Posts, Avg Likes, Engagement Rate, etc.): from **x_window_aggregates** (queue drainer backfill) or, if empty, **x_analytics_rollups** (weekly worker). If both are empty, values show 0. Ensure **weekly worker** has run after tweet sync (so `refreshXRollupsForProfile` runs) and/or **queue drainer** has processed `x_backfill_90d` jobs so `x_window_aggregates` has rows.
- **Follower Growth chart**: from **x_daily_snapshots** (worker). Followers are forward-filled so past days don’t show 0 when only today has a value; ensure daily worker and/or backfill writes snapshots.
- **Posting Cadence / Engagement Rate charts**: from **x_daily_snapshots** (`tweets_count`, `engagement_rate`/`likes_received`). Populated by the **queue drainer** when it runs `x_backfill_90d`. If these charts show “Sync from Integrations and run the backfill…”, run the drainer (or ensure backfill jobs have run) so `x_daily_snapshots` has daily rows with `tweets_count` and engagement data.

**Quick checks:** User has connected X and synced; weekly worker has run (rollups); queue drainer has run and processed backfill jobs (window aggregates + daily snapshots). After retweet cleanup, run `pnpm --filter worker run rebuild:x:rollups` once to repopulate rollups and top drivers.

---

## Verify readiness endpoint

1. **Call the readiness API** (no auth):

   ```bash
   curl -s https://your-domain.com/api/readiness
   ```

2. **Expected when healthy** (HTTP 200):

   ```json
   {
     "ok": true,
     "checks": {
       "serviceSupabase": { "ok": true, "detail": "service client created" },
       "rateLimitRpc": { "ok": true, "detail": "allowed" },
       "analyticsQueue": { "ok": true, "detail": "counts read", "queued": 0, "running": 0, "done": 5, "failed": 0 },
       "queueDrainer": { "ok": true, "detail": "no backlog" },
       "xTweets": { "ok": true, "xTweetsTotal": 42, "xTweetsLatestCreatedAt": "2026-02-22T12:00:00Z" },
       "cronSecretConfigured": { "ok": false, "detail": "CRON_SECRET is only required if you use /api/cron/* routes. Railway cron workers do not require CRON_SECRET." },
       "twitterApiConfigured": { "ok": true },
       "ethosConfigured": { "ok": true, "detail": "optional; ETHOS_CLIENT_ID has default" }
     }
   }
   ```

   When there is a backlog, `analyticsQueue` may include `"warning": "Backlog detected. Queue drainer should run every 2 to 5 minutes."` and `queueDrainer.ok` may be `false` if no job has completed in the last 30 minutes. If the queue is draining but `xTweets.xTweetsTotal` is 0 for more than 30 minutes, `xTweets.warning` will be set: "Worker is not ingesting tweets. Check weekly start command and job processor."

3. **When service key or RPC is missing** (HTTP 503):

   - `ok: false`, `code: "CONFIG"`, and the same `checks` object so you can see which dependency failed.
   - Fix: set `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`) in Vercel and ensure the `rate_limits` table and `consume_rate_limit` RPC exist (migration `20260222100000_rate_limits.sql`).

---

## Verify worker is draining analytics_jobs

1. **Readiness** (no auth) is the main daily ops check:

   - **GET /api/readiness** returns `checks.analyticsQueue` (queued, running, done, failed) and `checks.queueDrainer`.
   - When the Railway **linkary-queue-drainer** is running: `analyticsQueue.queued` decreases, `analyticsQueue.done` increases, and `queueDrainer.ok` stays true (or becomes true once a job completes within 30 minutes).
   - If `queued` is high and not moving, or `queueDrainer.ok` is false, the drainer is not running or failing — check Railway Cron Run logs for linkary-queue-drainer.

2. **Queue status** (optional; superadmin only; requires Bearer token):

   - Set `SUPERADMIN_EMAILS` in Vercel to include your login email. Call while logged in (browser) or with `Authorization: Bearer YOUR_JWT`:
   - `curl -s -H "Authorization: Bearer YOUR_JWT" https://your-domain.com/api/admin/queue-status`
   - Use this for extra detail (e.g. oldest queued, latest failure). For routine checks, **/api/readiness** is enough.

---

## Manually trigger cron (optional — only if using /api/cron/*)

If you use **Vercel Cron** or an external scheduler to hit **/api/cron/\*** routes, set `CRON_SECRET` in Vercel and send it in the request. **Railway cron workers do not use CRON_SECRET**; they run the worker binary directly.

**Example: trigger daily X analytics snapshot** (only if you call this route from a scheduler):

```bash
curl -X POST "https://your-domain.com/api/cron/x-analytics-daily" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

**Example: enqueue 90d backfill jobs** (only if you use this route; with Railway, jobs are enqueued by ensure-backfill and drained by linkary-queue-drainer):

```bash
curl -X POST "https://your-domain.com/api/cron/backfill-x-90d-batch" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

Replace `YOUR_CRON_SECRET` with the value of `CRON_SECRET` in Vercel. Never commit or log the secret.

---

## Analytics stuck "partial"

If the public page or dashboard shows analytics as "partial" or "fallback":

1. **Readiness**  
   - Confirm `serviceSupabase` and `rateLimitRpc` are ok.  
   - Confirm `twitterApiConfigured` is true if you use X analytics.

2. **Ensure-backfill**  
   - User (or you as that user) can retry: from the app, use the "Retry" action shown when analytics init fails (auth callback or in-app banner/toast).  
   - Or call with a valid user JWT:  
     `curl -X POST "https://your-domain.com/api/analytics/ensure-backfill" -H "Authorization: Bearer USER_JWT"`  
   - Rate limit: 10 requests per 10 minutes per user.

3. **Worker**  
   - Ensure the worker process is running and has `SUPABASE_SERVICE_ROLE_KEY` and `TWITTERAPI_API_KEY`.  
   - Check queue-status: if `queued` grows and never decreases, the worker is not running or is failing (check worker logs and `last_error` in queue-status).

3. **Queue drainer**  
   - Ensure **Railway linkary-queue-drainer** is running on schedule (every 2–5 min). If `queueDrainer.ok` is false in readiness, check Cron Run logs and env (see "Railway queue drainer (required)" above).

4. **/api/cron/\***  
   - Only relevant if you call these routes from Vercel or another scheduler. With Railway, the queue is drained by linkary-queue-drainer; ensure-backfill enqueues jobs from the app.

5. **No X handle**  
   - If the user has not connected X or the handle is missing, ensure-backfill returns `enqueued: false`, reason `no_x_handle`. Connect X in Integrations and try again.

---

## Internal ops page

- **URL:** `https://your-domain.com/ops` (route: `apps/web/src/app/(internal)/ops/page.tsx`).
- **Access:** Allowed when the user is authenticated **or** `OPS_ENABLED` is set (any non-empty value). If not allowed, the page redirects to `/login`.
- **Contents:** Links to `/api/readiness`, `/api/admin/queue-status` (for superadmins), and short instructions for brochure mode and owner preview. The page calls `GET /api/ops/check` (with Bearer token if logged in) to determine access; do not expose secrets on the page.
