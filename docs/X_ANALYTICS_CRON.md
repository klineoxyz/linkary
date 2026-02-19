# X Analytics Cron & Ingestion

Cost-effective X analytics: **daily profile snapshots** and **weekly tweet ingestion** (max 50 tweets/user) via twitterapi.io. No sync on page load; UI reads from DB only.

## Security

- **Manual sync** (`POST /api/x-sync`): **self-only**, 24h cooldown. No arbitrary usernames from client.
- **Cron endpoints**: Protected by `CRON_SECRET` header. Only call from Railway cron or a secure runner.
- `TWITTERAPI_API_KEY` and `CRON_SECRET` are **server-only** (never exposed to the client).

## Step-by-step: Setting up cron env vars

Do this **where the cron runs** (e.g. Railway project that calls your Next.js app, or the same Vercel project that hosts the app).

### Step 1 — Get `TWITTERAPI_API_KEY`

1. Go to [twitterapi.io Dashboard](https://twitterapi.io/dashboard).
2. Sign in or create an account.
3. Open your project or API keys section.
4. Copy the **API Key** (sometimes labeled “X-API-Key” or “API Key”).
5. Add it as env var: **`TWITTERAPI_API_KEY`** = that value.  
   Used by the cron to call Get User Info and Last Tweets. Never expose this in the client.

---

### Step 2 — Create `CRON_SECRET` (you generate it)

**CRON_SECRET is not from a website.** You create it yourself. It’s a random string that only your cron job and your app know; the app checks that incoming cron requests send this value so random people can’t trigger the job.

1. Generate a long random string (e.g. 32+ characters). Examples:
   - **PowerShell:**  
     `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])`
   - **Node:**  
     `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
   - Or use a password generator and paste a long string.
2. Save that value somewhere safe (e.g. password manager).
3. Add it as env var where the cron runs: **`CRON_SECRET`** = that string.
4. When calling the cron (Railway cron, curl, or scheduler), send it in a header:
   - **`x-cron-secret: <your-CRON_SECRET>`**  
   - or **`Authorization: Bearer <your-CRON_SECRET>`**  
   The app rejects the request with 401 if the header is missing or doesn’t match.

---

### Step 3 — Get `SUPABASE_SERVICE_ROLE_KEY`

1. Open [Supabase Dashboard](https://supabase.com/dashboard) and select your project.
2. Go to **Settings** → **API** (or **Project Settings** → **API**).
3. Under “Project API keys” you’ll see:
   - **anon (public)** — safe for the browser (you already use this as `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
   - **service_role** — **secret**; bypasses Row Level Security (RLS).
4. Copy the **service_role** key (click “Reveal” if needed).
5. Add it **only** where the cron runs: **`SUPABASE_SERVICE_ROLE_KEY`** = that value.  
   Do **not** put it in client-side env or expose it in the browser. The cron uses it to insert into `analytics_snapshots`, `x_tweets`, `x_analytics_rollups`, and `x_top_drivers`.

---

### Step 4 — Ensure `NEXT_PUBLIC_SUPABASE_URL` is set

You usually have this already (e.g. `https://xxxxx.supabase.co`). The cron code needs it to talk to Supabase. If the cron runs in the same app (Vercel/Railway), the same env that runs the app is used — just ensure **`NEXT_PUBLIC_SUPABASE_URL`** is set there.

---

### Summary table

| Variable | Where to get it | Purpose |
|----------|------------------|---------|
| `TWITTERAPI_API_KEY` | [twitterapi.io Dashboard](https://twitterapi.io/dashboard) → API key | Calls Get User Info + Last Tweets |
| `CRON_SECRET` | **You generate it** (random string, see Step 2) | Protects cron endpoints; send in `x-cron-secret` or `Authorization: Bearer` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → service_role | Lets cron insert into snapshots/tweets/rollups (bypasses RLS) |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API (or existing app env) | Supabase project URL |

Set these in the environment **where the cron runs** (e.g. Railway env vars, or Vercel if the cron hits your Vercel app).

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
