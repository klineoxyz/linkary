# REP: avg_engagement_per_post backfill and pipeline

## Commands (run from repo root)

```bash
# 1) Diagnose: see profile counts, rollup/tweet row counts, sample data
pnpm run diagnose-engagement

# 2) Backfill profiles.avg_engagement_per_post (only where NULL)
pnpm run backfill-engagement

# 3) Recalculate REP so it uses the new engagement signal
pnpm run backfill-rep
```

## Pipeline (automatic)

After each rollup run in `x-analytics-server.ts` (`computeAndUpsertRollups`):

- When **posts_30d > 0**: `profiles.avg_engagement_per_post` is set from rollup (engagementScoreSum / posts).
- When **posts_30d === 0**: existing `avg_engagement_per_post` is **not** overwritten.
- One log line per update: `[ENG_ROLLUP] profile_id=... avg_engagement_per_post=... posts_30d=... source=rollup`

## Acceptance tests (after backfill)

1. **Supabase SQL:**
   ```sql
   select count(*) total, count(avg_engagement_per_post) with_engagement
   from public.profiles;
   ```
   `with_engagement` must be > 0.

2. **Top engagement:**
   ```sql
   select id, followers_total, avg_engagement_per_post
   from public.profiles
   order by avg_engagement_per_post desc nulls last
   limit 20;
   ```
   Should show non-null numbers.

3. REP values should change for some profiles after backfill (engagement signal now present).
