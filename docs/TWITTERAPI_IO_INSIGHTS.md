# X Insights Cache (twitterapi.io)

Phase 4 adds a **provider-ready X insights cache** backed by DB tables, with a cron-friendly refresh pipeline. No UI gating or blur.

## What we cache

| Table | Content |
|-------|--------|
| `x_top_followers_cache` | Top followers by tier: `influencers`, `projects`, `funds` (JSON per profile). |
| `x_mentions_weekly_cache` | Mentions for a given week (`week_start` = Monday ISO date). |
| `x_account_feed_cache` | Account feed: `actions` and `newFollowers` arrays. |

All tables are **server-managed**: RLS is enabled with no policies, so only the **service role** can read/write. The public `/api/social/x/insights` endpoint reads via service role and returns a safe subset (no private storage URLs in avatars).

## Staleness rules

- **Top followers / Feed / Mentions**: cache is considered **stale after 24 hours**.
- If cache is missing or stale, the insights API returns empty arrays and sets `meta.cache` to `hit` | `miss` | `stale` per bucket.

Configurable in code: `CACHE_STALE_MS` in `apps/web/src/app/api/social/x/insights/route.ts` (default 24h).

## How to run refresh manually

1. **Single profile (by username or profile_id)**  
   ```bash
   curl -X POST "https://<WEB_APP_URL>/api/admin/social/x/refresh-insights" \
     -H "Content-Type: application/json" \
     -H "x-cron-secret: <CRON_SECRET>" \
     -d '{"username": "alice"}'
   ```
   Or with `profile_id`: `{"profile_id": "<uuid>"}`.

2. **Daily batch (worker)**  
   From the repo root:
   ```bash
   pnpm --filter worker run sync:x:insights:daily
   ```
   The worker calls the refresh endpoint for each eligible profile (batch 50).  
   **Eligible**: `x_connected = true` and `twitter_username` is not null.

## Environment

| Variable | Where | Purpose |
|----------|--------|--------|
| `TWITTERAPI_IO_KEY` | Web app (refresh lib) | twitterapi.io API key for fetching. If unset, refresh returns `200 { ok: true, skipped: true }` so worker/cron does not break. |
| `ADMIN_SECRET` or `CRON_SECRET` | Web app | Required to call `POST /api/admin/social/x/refresh-insights`. |
| `WEB_APP_URL` | Worker | Base URL of the web app (e.g. `https://linkary.xyz`). Used to call the refresh endpoint. |
| `CRON_SECRET` | Worker | Sent as `x-cron-secret` when calling the refresh endpoint. |
| `SUPABASE_SERVICE_ROLE_KEY` | Web app | Required to read/write cache tables (insights route and refresh lib). |

## Contracts

TypeScript interfaces and sanitize helpers live in **`apps/web/src/lib/socialInsightsContracts.ts`**:

- `TopFollowerItem`, `AccountFeedItem`, `MentionItem`
- `XTopFollowersCachePayload`, `XAccountFeedCachePayload`, `XMentionsCachePayload`
- `stripPrivateStorageUrlsFromAvatar()`, `normalizeUsername()`

All avatar fields returned by `/api/social/x/insights` are sanitized: private storage URLs are never returned.

## Note

No UI gating or blur has been added. Empty states remain when cache is empty or stale. Phase 5 will introduce a unified multi-provider (TikTok, YouTube) contract.
