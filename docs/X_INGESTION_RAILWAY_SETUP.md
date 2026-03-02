# X Ingestion — Railway Setup Checklist

Railway is the **only** scheduler for X tweet ingestion. This doc makes it impossible to misconfigure without noticing.

---

## 1. Which Railway services need `TWITTERAPI_API_KEY`?

| Service / Cron run | Script | Needs key? |
|-------------------|--------|------------|
| **sync:x:tweets:daily** (or sync:x:tweets:weekly) | `pnpm run sync:x:tweets:daily` | **Yes** — tweet fetch + ingest |
| **sync:x:profiles:daily** | `pnpm run sync:x:profiles:daily` | **Yes** — user info + snapshot |
| **linkary-queue-drainer** (run:jobs) | `pnpm run run:jobs` | **Yes** — backfill jobs call provider |
| **x:provider:selftest** (Run now) | `pnpm run x:provider:selftest` | **Yes** — validates key |
| **x:ingest:healthcheck** (Run now) | `pnpm run x:ingest:healthcheck` | **Yes** — provider + one ingest |

**Set the key in Railway Variables** for the same project/environment that runs these commands. Use one of (first found wins):

- `TWITTERAPI_API_KEY`
- `TWITTERAPI_IO_KEY`
- `TWITTERAPI_KEY`
- `TWITTERAPI_TOKEN`

---

## 2. Expected successful log lines

If the key is present and valid, you should see:

**Provider (on first request):**
```text
[X_PROVIDER] key_source=TWITTERAPI_API_KEY present=true len=32 suffix=...a9FQ
[X_PROVIDER] auth_header_present=true auth_header_name=X-API-Key
```

**Selftest (Run now: `pnpm run x:provider:selftest`):**
```text
[X_PROVIDER] selftest key_source=TWITTERAPI_API_KEY present=true len=32 suffix=...a9FQ
[X_PROVIDER] selftest request base_url=https://api.twitterapi.io path=/twitter/user/info?userName=twitter
[X_PROVIDER] selftest response_status=200
[X_PROVIDER] selftest ok
```

**Ingestion cron (sync:x:tweets:daily):**
```text
[INGEST] starting X tweet sync (stale threshold=6h)
[INGEST] env: SUPABASE_URL=true SERVICE_ROLE=true TWITTERAPI=true
[INGEST] ...
[INGEST] done processed=... failures=0 tweets_total_upserted=...
```

**Ingest healthcheck (Run now: `pnpm run x:ingest:healthcheck`):**
```text
[X_INGEST_HEALTH] provider ok=true
[X_INGEST_HEALTH] tweets_fetched=... tweets_upserted=...
[X_INGEST_HEALTH] ok
```

---

## 3. If the key is missing

**Cron (sync:x:tweets:daily):**
```text
[INGEST] missing twitterapi key. Set TWITTERAPI_API_KEY (or TWITTERAPI_IO_KEY, TWITTERAPI_KEY, TWITTERAPI_TOKEN).
```
→ Exit code non-zero; run fails immediately.

**Selftest / healthcheck:**  
`key_present=false` or `provider fail status=401` → fix the variable in Railway and re-run.

---

## 4. Debug panel (analytics staleness)

After running the migration `20260290000000_profiles_x_last_tweets_sync_error.sql`, each profile has:

- **x_last_tweets_sync_at** — last successful ingest time
- **x_last_tweets_sync_error** — classified error: `auth_invalid` | `rate_limited` | `provider_down` | `unknown`
- **x_last_tweets_sync_error_at** — when that error occurred

In `/analytics?debug=1` you can show **last sync time** and **last sync error** so “stale analytics” is self-explaining.

---

## 5. Quick sanity check in Railway

1. Open the Railway service that runs the cron.
2. **Run now** → command: `pnpm run x:provider:selftest`
3. Check the log for:
   - `[X_PROVIDER] selftest key_source=... present=true`
   - `[X_PROVIDER] selftest response_status=200`
   - `[X_PROVIDER] selftest ok`

If you see `response_status=401` or `key_present=false`, the key is missing or wrong in **that** environment.
