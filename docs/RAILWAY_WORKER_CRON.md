# Railway worker cron – X analytics ingestion

The **worker** package runs as a one-off process on Railway (or locally) to sync X profile data and tweets. No public HTTP cron endpoints; no CRON_SECRET.

## Required env vars

Set these where the worker runs (Railway service or local):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS for writes) |
| `TWITTERAPI_API_KEY` | twitterapi.io API key (Get User Info + Last Tweets) |

## Eligible profiles

Scripts only process profiles where:

- `is_indexed = true`
- `twitter_username` is not null
- `twitter_connected_at` is not null

## Scripts

| Script | What it does |
|--------|----------------|
| **Daily** | For each eligible profile: fetch user info from twitterapi.io → update `profiles` (followers, display_name, bio, avatar, engagement proxy) and upsert `analytics_snapshots` for today. |
| **Weekly** | For each eligible profile: fetch up to 50 recent tweets → insert new rows into `x_tweets` → compute and upsert `x_analytics_rollups` and `x_top_drivers` → set `x_last_tweets_sync_at`. |

## Run locally

```bash
# From repo root
pnpm install
pnpm --filter linkary-worker build

# Daily (profile snapshots)
pnpm --filter linkary-worker sync:x:daily

# Weekly (tweets + rollups)
pnpm --filter linkary-worker sync:x:weekly
```

Or from `apps/worker`:

```bash
cd apps/worker
pnpm install
pnpm build
pnpm run sync:x:daily
pnpm run sync:x:weekly
```

Ensure `.env` or env vars in the shell have `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWITTERAPI_API_KEY`.

## Railway setup

1. **Create a worker service** in your Railway project (e.g. “linkary-worker”).
2. **Connect the same repo** and set root directory to the monorepo root (or set build/start for the worker).
3. **Set env vars** on the service: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWITTERAPI_API_KEY`.
4. **No long-running process** – the worker is invoked on a schedule as one-off commands.

### Option A: Cron job (scheduled one-off)

- In Railway, add a **Cron Job** (or use an external cron that triggers the run).
- **Daily** (e.g. 06:00 UTC):  
  `pnpm --filter linkary-worker build && pnpm --filter linkary-worker sync:x:daily`
- **Weekly** (e.g. Sunday 07:00 UTC):  
  `pnpm --filter linkary-worker build && pnpm --filter linkary-worker sync:x:weekly`

If Railway doesn’t support cron directly, use a **scheduler** service that runs a shell script which executes the above (or use GitHub Actions / external cron hitting a private endpoint if you add one later).

### Option B: Deploy worker as a service that runs one command and exits

- **Build command:** `pnpm install && pnpm --filter linkary-worker build`
- **Start command (daily):** `pnpm --filter linkary-worker sync:x:daily`  
  Then schedule this “service” to run once per day (Railway cron or external scheduler that starts the service with the daily command).
- For weekly, create a second “worker-weekly” service or the same service with a different start command run on a weekly schedule.

(Exact Railway UI names may vary; the idea is: run `sync:x:daily` and `sync:x:weekly` on a schedule with the env vars above.)

## Behaviour

- **Throttling:** Daily uses ~150 ms delay between profiles; weekly uses ~600 ms to respect twitterapi.io.
- **Errors:** Per-profile errors are logged; `x_sync_status` and `x_sync_error` are set on the profile, and the script continues. Exit code is 0 unless a fatal config error (e.g. missing env) or unhandled exception.
- **DB:** All writes use the Supabase service role client (no RLS). Tables used: `profiles`, `analytics_snapshots`, `x_tweets`, `x_analytics_rollups`, `x_top_drivers`.

## Verification checklist

1. **Env:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWITTERAPI_API_KEY` set where the worker runs.
2. **Local daily:** `pnpm --filter linkary-worker sync:x:daily` → logs “Daily sync done. Processed=N success=… errors=…”.
3. **Local weekly:** `pnpm --filter linkary-worker sync:x:weekly` → logs “Weekly sync done…” and “tweets_inserted=…”.
4. **DB:** After daily run, check `profiles.x_last_profile_sync_at` and `analytics_snapshots` for an eligible profile. After weekly run, check `x_tweets`, `x_analytics_rollups`, `x_top_drivers` for that profile.
5. **Railway:** Cron (or scheduler) runs daily and weekly commands; logs show processed/success/errors.
