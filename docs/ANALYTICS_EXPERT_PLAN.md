# Analytics Page Finalization: Expert Plan

One-pass execution by role. No guessing; prove data existence before UI changes.

---

## Expert roles and responsibilities

### Staff Frontend Engineer (React/Next, charts, performance, UX)
- **Checks:** Empty state conditions (do not hide when points exist); chart min height/scroll for 90D weekly; Key Signals/KPI/Details hierarchy; no global CSS; `data-page="analytics"` scoping; tabular-nums and spacing.
- **Deliverables:** Fix any UI that treats zero-filled or weekly-aggregated series as "missing"; ensure 90D charts render weekly buckets without horizontal scroll where possible.

### Staff Backend/Data Engineer (Postgres, aggregation, correctness)
- **Checks:** Tables `x_daily_snapshots`, `x_tweets`, `x_window_aggregates`; window boundaries (7/30/90d inclusive of today); weekly aggregation correctness (totals preserved, ER weighted by posts); API returns chart_points for the requested window; no unintended filtering by owner_id/profile_id.
- **Deliverables:** DB audit script with exact SQL/counts; confirm API returns correct lengths and dates when DB has data; if API is wrong, minimal safe fix + test or SQL proof.

### Product Analytics Engineer (metrics, deltas, bucketing, signals)
- **Checks:** Metric definitions (ER, reach, posts, active days); delta only when prior period exists; 7D daily / 30D daily / 90D weekly bucketing; Key Signals computed from real data (no filler); coverage labels (X/90d) match bucket type.
- **Deliverables:** Forced conclusion (DB/API/UI) after Phase 1; signal bullets only when computable; KPI "0" for posts when zero, "—" for per-post when no posts.

### Senior UX Designer (hierarchy, spacing, premium patterns)
- **Checks:** Key Signals first, then KPIs, then Trends, then Details; equal-width window pills; chart titles aligned; coverage and "Weekly"/"Daily" labels clear; no long dashes in copy; compact sticky header.
- **Deliverables:** Layout order and spacing; copy and label consistency.

### QA Engineer (repro, edge cases, regression)
- **Checks:** 7D/30D/90D switch shows correct bucket type and point counts; no "not enough data" when DB has data; no fake deltas; no console errors; no changes outside analytics; manual QA checklist.
- **Deliverables:** PR summary, root cause statement, QA checklist, before/after verification steps.

---

## Order of execution

1. **Phase 1A – DB audit**  
   Add `scripts/auditAnalyticsData.ts`; run for a known profile_id; record snapshot counts (7/30/90d), min/max date in 90d, tweet count 90d, window_aggregates existence. Document exact SQL used (or equivalent in script).

2. **Phase 1B – API audit**  
   Call `/api/analytics/x?window=7d|30d|90d&debug=1`; confirm debug payload has chart_points lengths, first/last date, non-zero counts, KPI rollup. Add server-side **conclusion** field: one of "DB has 90D data and API returns it, UI is hiding it because X" | "DB has 90D data but API is not returning it because Y" | "DB does not have 90D data because Z". No other answer.

3. **Phase 2 – If data missing**  
   Document: (2A) why missing (worker/cron/retention/rate-limit); (2B) backfill plan (script or job, rate limit, idempotency, progress); (2C) keep fresh (cron/worker schedule). Implement only if Phase 1 concludes DB does not have 90D.

4. **Phase 3 – If data exists, fix UI**  
   (3A) Empty states: do not treat zero-filled or weekly series as missing; coverage from window dates; (3B) Bucketing: 7D daily, 30D daily compact, 90D weekly (~13 bars); labels "Weekly" for 90D.

5. **Phase 4 – Signal-first polish**  
   Key Signals (4–6 bullets, numbers only), KPIs truthful, Trends readable, Details with "Posts in window" and sort by ER. Then PR summary + QA checklist.

---

## Success criteria (must all pass)

- Switching 7D/30D/90D shows correct bucket type and correct point counts.
- If DB has 90D data, UI displays it; no "not enough data" contradiction.
- If DB does not have 90D, deliverables include backfill plan and script/job to populate it.
- Signals are real insights (numbers), not generic text.
- 90D charts are weekly and readable inside the card.
- No regressions outside analytics; no console errors.
- PR summary includes root cause statement, SQL or audit script output, QA checklist.
