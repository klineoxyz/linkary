# X Analytics Cron & Ingestion

Cost-effective X analytics: **daily profile snapshots** and **weekly tweet ingestion** (max 50 tweets/user) via twitterapi.io. No sync on page load; UI reads from DB only.

## Security

- **Manual sync** (`POST /api/x-sync`): **self-only**, 24h cooldown. No arbitrary usernames from client.
- **Cron endpoints**: Protected by `CRON_SECRET` header. Only call from Railway cron or a secure runner.
- `TWITTERAPI_API_KEY` and `CRON_SECRET` are **server-only** (never exposed to the client).

## Env vars (server / cron)

| Variable | Where | Purpose |
|----------|--------|---------|
| `TWITTERAPI_API_KEY` | Vercel / Railway | twitterapi.io API key (Get User Info + Last Tweets) |
| `CRON_SECRET` | Railway (or wherever cron runs) | Secret header to authorize cron POSTs |
| `SUPABASE_SERVICE_ROLE_KEY` | Railway / Vercel (cron only) | Bypass RLS for inserting snapshots, tweets, rollups |
| `NEXT_PUBLIC_SUPABASE_URL` | Already set | Supabase project URL |

Set in Vercel: `TWITTERAPI_API_KEY`, `CRON_SECRET` (if cron hits Vercel).  
Set in Railway: `TWITTERAPI_API_KEY`, `CRON_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL` (and optionally `NEXT_PUBLIC_SUPABASE_ANON_KEY` if needed).

## Endpoints

### Manual sync (user-facing)

- **POST (or GET) `/api/x-sync`**  
  - Auth: `Authorization: Bearer <access_token>`.  
  - Syncs **only the current user’s** profile (Get User Info), inserts today’s row into `analytics_snapshots`, does **not** fetch tweets.  
  - **24h cooldown**: if `x_last_profile_sync_at` is within the last 24 hours, returns `{ ok: true, skipped: true, lastSyncedAt }` without calling twitterapi.io.  
  - Response: `{ ok: true, lastSyncedAt? }` or `{ ok: true, skipped: true, lastSyncedAt }` or error.

### Cron (internal only)

- **POST `/api/cron/sync-x-profiles-daily`**  
  - Header: `x-cron-secret: <CRON_SECRET>` or `Authorization: Bearer <CRON_SECRET>`.  
  - Loads profiles with `is_indexed = true` and non-empty `twitter_username` (batch 100).  
  - For each: Get User Info → update `profiles` (followers, engagement proxy) and upsert `analytics_snapshots` for today.  
  - Small delay between requests to respect QPS.

- **POST `/api/cron/sync-x-tweets-weekly`**  
  - Same auth as above.  
  - Same profile batch.  
  - For each: fetch up to **50** most recent tweets (twitterapi.io Last Tweets), insert new rows into `x_tweets`, then compute and upsert `x_analytics_rollups` and `x_top_drivers` (30D).

## Scheduling (e.g. Railway)

- **Daily**: e.g. `0 6 * * *` → `POST https://your-app.railway.app/api/cron/sync-x-profiles-daily` with `x-cron-secret: $CRON_SECRET`.
- **Weekly**: e.g. `0 7 * * 0` → `POST https://your-app.railway.app/api/cron/sync-x-tweets-weekly` with same header.

## Verification checklist

1. **Connect X**  
   Settings → Integrations → Connect X. Profile gets `twitter_username`, `twitter_connected_at`.

2. **Manual self-sync once**  
   Click “Sync from X” on Integrations. Should run (no cooldown yet), then show “Last synced” and 24h cooldown on next click.

3. **Run daily cron locally**  
   `curl -X POST http://localhost:3000/api/cron/sync-x-profiles-daily -H "x-cron-secret: YOUR_CRON_SECRET"`.  
   Check `profiles.x_last_profile_sync_at` and `analytics_snapshots` for your profile.

4. **Run weekly cron locally**  
   `curl -X POST http://localhost:3000/api/cron/sync-x-tweets-weekly -H "x-cron-secret: YOUR_CRON_SECRET"`.  
   Check `x_tweets`, `x_analytics_rollups`, `x_top_drivers` for your profile.

5. **Analytics without calling twitterapi.io from browser**  
   Open Analytics (or tab with AnalyticsTabContent). In Network tab, confirm **no** requests to `twitterapi.io`. Data should load from your app (e.g. `/api/analytics/x` → Supabase).

## DB tables

- **profiles**: `is_indexed`, `x_last_profile_sync_at`, `x_last_tweets_sync_at`, `x_sync_status`, `x_sync_error`, plus existing `twitter_username`, `followers_total`, `avg_engagement_rate`.
- **analytics_snapshots**: one row per (profile, platform, date) for deltas.
- **x_tweets**: one row per (profile, tweet_id); used for rollups and top drivers.
- **x_analytics_rollups**: one row per profile (posts_7d/30d/90d, avg_likes, avg_replies, engagement_rate, reach_proxy).
- **x_top_drivers**: top 10 tweets per profile for 30D window by engagement score.

See migration `20260220000000_x_analytics_ingestion.sql`.
