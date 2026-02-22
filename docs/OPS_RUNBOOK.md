# Ops runbook

How to debug and fix common production issues.

---

## “Analytics is empty” / “Charts don’t load”

### 1. Check init status for the user

- User should call `GET /api/analytics/init-status` (with Bearer). Response: `initialized`, `has90dAggregate`, `snapshotDays`, `job: { status, last_error }`.
- If `initialized` is false and `job.status` is `failed`, show “Retry backfill” in UI; user can hit `POST /api/analytics/backfill-90` to re-enqueue.

### 2. Check queue and worker

- **GET /api/admin/queue-status** (superadmin): see `queued`, `running`, `failed`, `doneLast24h`, `oldestQueuedAt`, `latestFailure`.
- If `queued` is high and not decreasing, the **worker is not running**. Run the job processor every 5–10 min (e.g. `pnpm --filter worker run run:jobs`).
- If `failed` is growing, inspect `latestFailure.last_error`. Common causes: missing/invalid `TWITTERAPI_API_KEY`, rate limit from twitterapi.io, or DB error.

### 3. Check data for one profile

- With service role, query `x_daily_snapshots` and `x_window_aggregates` for that user’s `owner_id` (profile id). If both are empty, backfill never succeeded for that profile.
- Ensure the profile has an X connection: `social_accounts` has a row for that user with provider `x` or `twitter` and `username` set.

### 4. Re-enqueue backfill safely

- **Per user:** User can click “Retry backfill” in Analytics (calls `POST /api/analytics/backfill-90`). Rate limited (3 / 30 min per user).
- **Bulk (superadmin):** `POST /api/admin/backfill-x-90d?limit=50` with admin auth or `x-admin-secret`. This only **enqueues** jobs; the worker must be running to process them.
- Do **not** set `ALLOW_DEPRECATED_BACKFILL=true` unless you intentionally want the old fake 90d writer (not recommended).

---

## Interpreting queue-status output

| Field | Meaning |
|-------|---------|
| `queued` | Jobs waiting to run. Should drain if worker runs regularly. |
| `running` | Currently executing. Usually 0 or 1. |
| `failed` | Jobs that ended in failure. Check `latestFailure.last_error`. |
| `doneLast24h` | Successfully completed in last 24h. |
| `oldestQueuedAt` | Age of oldest queued job. If very old, worker was down. |
| `latestFailure` | Last failed job’s `id`, `owner_id`, `last_error`, `updated_at`. |

**worker_hint:** Run the worker command every 5–10 minutes (cron or scheduler).

---

## Common failure modes

| Symptom | Likely cause | Action |
|---------|----------------|--------|
| 429 on API calls | Rate limit (per user or IP) | Wait for `resetAt` or increase limits in code/DB. |
| Health returns `db: "error"` | DB unreachable or wrong service key | Check Supabase project and `SUPABASE_SERVICE_ROLE_KEY`. |
| Backfill job stays queued | Worker not running | Schedule worker to run every 5–10 min. |
| Backfill job fails with API error | twitterapi.io key or rate limit | Check `TWITTERAPI_API_KEY`; respect rate limits. |
| “Only company accounts can create an organization” | Org gate working as intended | User must switch to company account to create orgs. |
| Org “must have at least one owner” | Trigger preventing removal of last owner | Add another owner via transfer-ownership first, or add member as admin then transfer. |

---

## Admin and cron endpoints

- **Cron routes** require `CRON_SECRET` (header or Bearer). Do not expose in client.
- **Admin routes** (`/api/admin/*`) require superadmin (email in `superadmin_emails` or `SUPERADMIN_EMAILS`) or, where supported, `x-admin-secret` / `ADMIN_BACKFILL_SECRET`.
- **Smoke:** `GET /api/admin/smoke` is superadmin-only; use for CI with a dedicated token stored as a secret.
