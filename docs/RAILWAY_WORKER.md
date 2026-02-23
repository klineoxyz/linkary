# Railway worker – X analytics ingestion

Background worker package for scheduled X (Twitter) analytics ingestion. **No HTTP server.** Pure CLI scripts that run and exit. Intended to run on Railway (or locally) as cron.

## Required env vars

Set these where the worker runs (Railway service or local):

| Variable | Purpose |
|----------|---------|
| `SUPABASE_URL` | Supabase project URL (e.g. `https://xxxxx.supabase.co`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (bypasses RLS for writes) |
| `TWITTERAPI_API_KEY` | twitterapi.io API key (Get User Info + Last Tweets) |

All are validated at runtime; the process exits with a clear error if any are missing.

## Run locally

From repo root:

```bash
pnpm install
pnpm --filter worker build

# Daily (profile snapshots)
pnpm --filter worker sync:x:daily

# Weekly (tweets)
pnpm --filter worker sync:x:weekly
```

From `apps/worker`:

```bash
cd apps/worker
pnpm install
pnpm build
pnpm run sync:x:daily
pnpm run sync:x:weekly
```

Ensure env vars are set (e.g. `.env` in `apps/worker` or export in the shell). The worker does not load `.env` itself; use `dotenv` or set vars before running.

## Scripts

| Script | What it does |
|--------|----------------|
| **sync:x:daily** | Loads eligible profiles (is_indexed, twitter_connected_at and twitter_username set, and x_last_profile_sync_at null or &gt;24h ago). For each: fetches user info from twitterapi.io → updates profiles (followers, display_name, bio, avatar, x_last_profile_sync_at, x_sync_status) → upserts `analytics_snapshots` for today. Logs: processed, ok, errors, skipped. |
| **sync:x:weekly** | Loads eligible profiles (same, and x_last_tweets_sync_at null or &gt;6 days ago). For each: fetches up to 50 recent tweets → inserts into `x_tweets` (upsert on profile_id,tweet_id, ignore duplicates) → updates profiles.x_last_tweets_sync_at. Logs: processed, ok, errors, tweets_inserted. |

If the `x_tweets` table is missing, the weekly script exits with a message to run the migration `supabase/migrations/20260220000000_x_analytics_ingestion.sql`.

**Note:** The cron runs for all profiles with X connected. To give users the best experience, analytics are collected from the day they connect and sync. Future: the cron could prioritize profiles that are recently logged in or were viewed by a super user in the Linkary ecosystem.

## Railway setup

1. Create a **new service** in your Railway project (e.g. “worker”).
2. Connect the same repo; set **root directory** to the monorepo root (the directory that contains `apps/worker` and `pnpm-workspace.yaml`).
3. Use the **root** `railway.toml` build command, or if setting a custom build command use: `corepack enable && corepack prepare pnpm@9.15.0 --activate && corepack run pnpm@9.15.0 install && corepack run pnpm@9.15.0 run build` (from repo root, add `--filter worker` before `run build`). Use `corepack run pnpm@9.15.0` so pnpm is invoked via corepack and does not rely on PATH.
4. Set **env vars** on the service: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TWITTERAPI_API_KEY`.
5. The worker does not run a long-lived process. Use **Railway Cron** (or an external scheduler) to run the scripts on a schedule.

### Cron examples

- **Daily** (e.g. 06:00 UTC):  
  `pnpm install && pnpm --filter worker build && pnpm --filter worker sync:x:daily`

- **Weekly** (e.g. Sunday 07:00 UTC):  
  `pnpm install && pnpm --filter worker build && pnpm --filter worker sync:x:weekly`

If your deploy already has `node_modules` and built artifacts, you can shorten to:

- Daily: `pnpm --filter worker sync:x:daily`
- Weekly: `pnpm --filter worker sync:x:weekly`

(Exact Railway UI for cron may vary; the idea is to run these commands on the desired schedule.)

## DB assumptions

- **profiles**: columns `is_indexed`, `twitter_username`, `twitter_connected_at`, `x_last_profile_sync_at`, `x_last_tweets_sync_at`, `x_sync_status`, `x_sync_error`, `followers_total`, `display_name`, `bio`, `avatar_url`, `avg_engagement_rate`, `updated_at`.
- **analytics_snapshots**: unique on `(profile_id, platform, snapshot_date)`; columns e.g. `platform`, `snapshot_date`, `followers_total`, `engagement_rate_proxy`.
- **x_tweets**: unique on `(profile_id, tweet_id)`; columns e.g. `tweet_id`, `tweeted_at`, `text`, `like_count`, `reply_count`, `repost_count`, `quote_count`, `raw`.

See migration `20260220000000_x_analytics_ingestion.sql` if these tables are missing.
