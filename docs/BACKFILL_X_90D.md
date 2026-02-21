# X 90-day analytics backfill

Backfill last 90 days of `analytics_snapshots` for X-connected profiles. Uses **twitterapi.io** (current user info); one snapshot per day per profile. Idempotent: upsert by `(owner_type, owner_id, platform, day, window_days)`.

## Who gets backfilled

- Profiles with an **active** `social_accounts` row (`provider = 'x'`, `revoked_at` IS NULL, `status = 'connected'`), or
- Profiles with `x_connected = true` (legacy).

Handle is taken from `social_accounts.username` or `profiles.twitter_username`. Join key: `social_accounts.user_id` (no `owner_profile_id` or `profile_id`).

## How to run

### 1. Admin API (manual or script)

**Endpoint:** `POST /api/admin/backfill-x-90d`

**Auth (one of):**

- **Header:** `X-Admin-Secret: <ADMIN_BACKFILL_SECRET>`  
  Set `ADMIN_BACKFILL_SECRET` in env (e.g. same as `CRON_SECRET` or a dedicated secret).
- **Bearer + superadmin:**  
  `Authorization: Bearer <user access token>` and the user’s email must be in `superadmin_emails` or `SUPERADMIN_EMAILS` (comma-separated).

**Query:**

- `?dryRun=1` — Only list profiles that would be processed; no API calls, no DB writes.
- `?limit=N` — Max profiles per run (default 50, max 200).

**Example (dry run):**

```bash
curl -X POST "https://your-app.com/api/admin/backfill-x-90d?dryRun=1" \
  -H "X-Admin-Secret: YOUR_ADMIN_BACKFILL_SECRET"
```

**Example (run, 50 profiles max per request):**

```bash
curl -X POST "https://your-app.com/api/admin/backfill-x-90d" \
  -H "X-Admin-Secret: YOUR_ADMIN_BACKFILL_SECRET"
```

**Response:**

- `dryRun: true`: `{ ok, dryRun: true, wouldProcess, profileIds }`
- Normal: `{ ok, dryRun: false, processed, success, errors }`

### 2. Optional cron (nightly batch)

**Endpoint:** `POST /api/cron/backfill-x-90d-batch`

**Auth:** `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.

Processes a small batch per run (20 profiles). Schedule nightly; after enough runs, all X-connected profiles get 90 days of snapshots. Uses `CRON_SECRET` (no admin secret required).

**Example (Railway / cron):**

```bash
curl -X POST "https://your-app.com/api/cron/backfill-x-90d-batch" \
  -H "x-cron-secret: YOUR_CRON_SECRET"
```

## Env vars

| Variable | Required for | Description |
|----------|----------------|-------------|
| `SUPABASE_SERVICE_ROLE_KEY` | Admin + cron | Service role for listing profiles and upserting `analytics_snapshots`. |
| `TWITTERAPI_API_KEY` | Run (not dry run) | twitterapi.io API key. |
| `ADMIN_BACKFILL_SECRET` | Admin API (header auth) | Secret for `X-Admin-Secret` header. |
| `CRON_SECRET` | Cron route | Secret for cron trigger. |
| `SUPERADMIN_EMAILS` | Admin API (Bearer auth) | Comma-separated superadmin emails (optional). |

## Rate limiting and caps

- **Max profiles per run:** 50 (admin API and cron batch).
- **Concurrency:** 3 profiles at a time; 500 ms delay between batches.
- **Idempotent:** Re-running overwrites existing snapshot rows for the same (owner, platform, day, window_days).

## Monitoring

### Count snapshots per profile (last 90 days)

```sql
SELECT owner_id, COUNT(*) AS snapshot_count
FROM analytics_snapshots
WHERE owner_type = 'profile' AND platform = 'x' AND window_days = 1
  AND day >= (CURRENT_DATE - INTERVAL '90 days')
GROUP BY owner_id
ORDER BY snapshot_count DESC;
```

### Profiles that should be backfilled (X-connected, no recent snapshots)

```sql
-- Active social_accounts (X) without 90 days of snapshots
SELECT sa.user_id
FROM social_accounts sa
LEFT JOIN (
  SELECT owner_id, COUNT(*) AS cnt
  FROM analytics_snapshots
  WHERE owner_type = 'profile' AND platform = 'x' AND window_days = 1
    AND day >= (CURRENT_DATE - INTERVAL '90 days')
  GROUP BY owner_id
) s ON s.owner_id = sa.user_id
WHERE sa.provider = 'x' AND sa.revoked_at IS NULL AND sa.status = 'connected'
  AND (s.cnt IS NULL OR s.cnt < 90);
```

### Recent backfill activity

Check app logs for `POST /api/admin/backfill-x-90d` and `POST /api/cron/backfill-x-90d-batch` responses: `processed`, `success`, `errors`.

## Notes

- **Current snapshot only:** twitterapi.io user/info returns **current** follower counts. **Snapshots are synthetic for prior days when using user/info (current-only).** Backfill writes that same value for all 90 days as a reasonable proxy; true historical per-day data would require a different data source.
- **Engagement:** `engagement_rate_proxy` is computed from `statusesCount` and `favouritesCount` (same as x-sync) when available; otherwise 0.
