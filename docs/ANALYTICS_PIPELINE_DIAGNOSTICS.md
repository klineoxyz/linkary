# X analytics pipeline — diagnostics (internal/support)

Use this when a profile has **followers populated but posts/impressions/engagement zero**, or when analytics UI does not update after sync.

**No PII in logs.** Use profile_id (UUID) only where needed for support.

---

## Pipeline stages (worker)

| Stage | Log prefix | Meaning |
|--------|------------|--------|
| fetch_start | `[X_TWEETS] stage=fetch_start profile_id=... handle=...` | About to call twitterapi.io for tweets. |
| fetch_done | `[X_TWEETS] stage=fetch_done profile_id=... fetched=N` | API returned N tweets. |
| dedupe | `[X_TWEETS] stage=dedupe profile_id=... rows_before=X rows_after=Y` | Only present if duplicates were removed (X > Y). |
| upsert_done | `[X_TWEETS] stage=upsert_done profile_id=... deduped=N upserted=N` | x_tweets upsert completed. |
| done | `[X_TWEETS] stage=done profile_id=... upserted=N` | ingestXTweets finished. |
| snapshots_done | `[X_BACKFILL_90D] stage=snapshots_done profile_id=... days=90` | x_daily_snapshots written. |
| aggregates_done | `[X_BACKFILL_90D] stage=aggregates_done profile_id=... windows=7,30,90` | x_window_aggregates written. |
| done (backfill) | `[X_BACKFILL_90D] stage=done profile_id=... upserted=N` | Full backfill succeeded. |

If a stage is missing in logs for a profile, the job failed before that stage.

---

## “Followers present but posts zero”

**Meaning:** Follower count (e.g. in x_daily_snapshots or profile) is set, but posts/impressions/engagement in the UI are zero.

**Likely cause:** Tweet ingestion failed or never ran, so `x_tweets` is empty or stale for that profile.

**Check:**

1. **Supabase → x_tweets:** Filter by `profile_id = <that profile UUID>`. If empty or very old, tweet ingestion failed or has not run.
2. **Railway logs:** Search for `profile_id=<uuid>` and `[X_TWEETS]`. Look for:
   - `stage=upsert_done` → tweets were written.
   - `upsert failed` or no `stage=upsert_done` → ingest failed (e.g. duplicate key before fix, or API error).
3. **Fix:** Ensure worker dedupe fix is deployed; re-run backfill or weekly sync for that profile.

---

## “x_tweets present but aggregates missing”

**Meaning:** `x_tweets` has rows for the profile but x_daily_snapshots or x_window_aggregates are empty or stale.

**Likely cause:** Backfill failed **after** ingestXTweets (e.g. snapshots or aggregates write failed).

**Check:**

1. **Supabase → x_daily_snapshots:** Filter `owner_type=profile`, `owner_id=<profile uuid>`. If empty, snapshot step failed.
2. **Supabase → x_window_aggregates:** Same owner_id. If empty, aggregates step failed.
3. **Railway logs:** Look for `stage=snapshots_done` and `stage=aggregates_done`. If you see `stage=upsert_done` but not `snapshots_done`, error is in snapshot loop (e.g. constraint or RLS). If you see `snapshots_failed` or `aggregates_failed`, log line includes `error=...`.

---

## “Aggregates present but UI still zero”

**Meaning:** DB has x_tweets and/or x_daily_snapshots / x_window_aggregates for the profile, but the analytics page shows zero.

**Likely cause:** API reads by **session user id** (owner_id / profile_id). If the viewer is not the profile owner, the app may be showing “own” analytics. Or window filter (7d/30d/90d) has no data in that range. Or cache/staleness.

**Check:**

1. **Who is viewing:** `/api/analytics/x` uses the **logged-in user’s id** for `owner_id` and `profile_id`. So the page shows **that user’s** analytics. For “other users” the product must use a different route or pass profile_id (if implemented).
2. **Window:** API filters by `tweeted_at >= windowStart` and `day >= windowStart`. If all tweets are older than the selected window, counts will be zero. Try 90d.
3. **Stale:** Force refresh; ensure no aggressive client cache.

---

## Data flow summary

- **twitterapi.io** → worker `getRecentTweets` / `getUserInfo`
- **Worker** → `ingestXTweets` → dedupe → upsert into **x_tweets**
- **Worker** (xBackfill90d) → same or second fetch → **x_daily_snapshots** (per day) → **x_window_aggregates** (7/30/90d)
- **apps/web** → GET `/api/analytics/x` → reads **x_daily_snapshots** (followers) + **x_tweets** (posts, engagement, impressions) by **session user id** → returns KPIs and chart series.

All metrics come from these stored tables; no live fetch from twitterapi.io on page load.
