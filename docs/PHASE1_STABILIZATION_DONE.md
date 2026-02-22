# Phase 1 Stabilization — Done

**Date:** 2025-02-22  
**Context:** [ARCHITECTURE_AUDIT_AND_COMPLETION_PLAN.md](./ARCHITECTURE_AUDIT_AND_COMPLETION_PLAN.md), [ANALYTICS_DEPENDENCY_GRAPH.md](./ANALYTICS_DEPENDENCY_GRAPH.md).

---

## Summary

Phase 1 fixes are implemented: org creation gate, twitter_username overwrite guard, analytics_initialized_at, removal of fake 90d analytics_snapshots writers, and analytics read path preferring worker tables with a `source` flag.

---

## A. Org creation gate (company only)

- **POST /api/orgs/create**  
  - Already enforced: reads `profiles.account_type` for `auth.uid()`; if not `'company'` returns **403** with `{ ok: false, code: 'ORG_COMPANY_REQUIRED', message: 'Only company accounts can create an organization.' }`.
- **RPC create_org_and_membership**  
  - **Migration:** `supabase/migrations/20260247000000_phase1_org_gate_and_analytics_initialized.sql`  
  - Adds check at start of RPC: `IF p_account_type IS DISTINCT FROM 'company' THEN RAISE EXCEPTION 'ORG_COMPANY_REQUIRED: ...'`.
- **Frontend**  
  - **CreateOrgModal** already shows CTA “Only company accounts can create an organization. Switch to a Company account in settings…” with links to `/onboarding` and `/settings` when the error message contains `ORG_COMPANY_REQUIRED` or “company accounts can create”.

---

## B. twitter_username overwrite guard + sync-handle

- **lib/profiles.ts — updateMyProfile**  
  - Guard in place: if current `profiles.twitter_username` is non-empty, incoming `twitter_username` is ignored unless it matches the current value (normalized). No replacing with a different handle via generic profile update.
- **POST /api/x/sync-handle**  
  - **File:** `apps/web/src/app/api/x/sync-handle/route.ts`  
  - Bearer required; resolves handle only from `social_accounts` (active X/twitter); updates `profiles.twitter_username` (and clears `twitter_username_candidate`) from that trusted source. No other profile fields changed.
- **UI**  
  - **IntegrationsPage:** X handle shown as read-only with “(read-only; sync from X to update)”. Added **“Sync handle”** button that calls `POST /api/x/sync-handle` and refetches profile/social state. Full **“Sync from X”** still calls `/api/x-sync` for full profile sync.

---

## C. analytics_initialized_at

- **Migration**  
  - `supabase/migrations/20260247000000_phase1_org_gate_and_analytics_initialized.sql`  
  - `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS analytics_initialized_at timestamptz;`  
  - Comment: set when 90-day X analytics backfill job completes.
- **Worker**  
  - **File:** `apps/worker/src/jobs/xBackfill90d.ts`  
  - After successfully writing `x_daily_snapshots` and `x_window_aggregates`, when `job.owner_type === 'profile'` and `job.owner_id` is set:  
  - `UPDATE profiles SET analytics_initialized_at = now(), updated_at = now() WHERE id = job.owner_id`.  
  - Idempotent (overwrites with current time).

---

## D. Fake 90d writers removed/repurposed

- **lib/backfill-x-90d.ts**  
  - **New:** `enqueueXBackfill90dJobs(service, options)` — enqueues `analytics_jobs` (job_type `x_backfill_90d`) only. Selects X-connected profiles (from `social_accounts`) that do not have a 90d `x_window_aggregates` row and do not have a recent queued/running job (within 2h). No writes to `analytics_snapshots`.  
  - **Deprecated:** `runBackfillX90d` — still in file but marked `@deprecated`; it wrote fake 90d (same snapshot repeated) to `analytics_snapshots`. Not used by any route anymore.
- **POST /api/cron/backfill-x-90d-batch**  
  - **File:** `apps/web/src/app/api/cron/backfill-x-90d-batch/route.ts`  
  - Now calls `enqueueXBackfill90dJobs(service, { limit: BATCH_SIZE, dryRun: false })` only. No snapshot writes. Response includes `enqueued` count.
- **POST /api/admin/backfill-x-90d**  
  - **File:** `apps/web/src/app/api/admin/backfill-x-90d/route.ts`  
  - Now calls `enqueueXBackfill90dJobs(service, { limit, dryRun })` only. Same auth (superadmin / X-Admin-Secret). Query `dryRun=1` and `limit=N` unchanged.
- **POST /api/cron/sync-x-profiles-daily**  
  - **File:** `apps/web/src/app/api/cron/sync-x-profiles-daily/route.ts`  
  - No longer writes `analytics_snapshots`. Writes **today only** to `x_daily_snapshots` (owner_type, owner_id, day, followers, engagement_rate, raw). Same idempotent upsert on `(owner_type, owner_id, day)`.
- **POST /api/x-sync**  
  - **File:** `apps/web/src/app/api/x-sync/route.ts`  
  - Removed the block that wrote `analytics_snapshots` (today). Still updates `profiles`, writes today to `x_daily_snapshots`, and enqueues `x_backfill_90d` job when needed.

**Deprecated / no longer used for 90d:**  
- `runBackfillX90d()` in `lib/backfill-x-90d.ts` — do not use for cron or admin; worker-only path builds real 90d via `x_daily_snapshots` + `x_window_aggregates`. It is the only code path that still writes to `analytics_snapshots` (legacy public snapshot store). It throws at runtime unless `process.env.ALLOW_DEPRECATED_BACKFILL === 'true'`, so it cannot be called accidentally.

---

## E. Analytics read path (prefer worker + source flag)

- **GET /api/analytics/x**  
  - **File:** `apps/web/src/app/api/analytics/x/route.ts`  
  - Already preferred `x_daily_snapshots` and `x_window_aggregates` for snapshots and rollup.  
  - **Added:** Response field `source: 'worker' | 'fallback'`.  
  - `source === 'worker'` when `rollupFromWindows != null` or `dailyRows.length > 0`; otherwise `source === 'fallback'` (legacy/analytics_snapshots).
- **GET /api/analytics/x/summary**  
  - **File:** `apps/web/src/app/api/analytics/x/summary/route.ts`  
  - **Added:** Response field `source: 'worker' | 'fallback'`.  
  - `source === 'worker'` when `hasAnyWindow || snapshotDays > 0`; otherwise `'fallback'`.

UI can show a banner when `source === 'fallback'` to indicate data is from legacy/fallback and not yet from worker backfill.

---

## Validation checklist

- Non-company users cannot create orgs (403 from API; RPC raises ORG_COMPANY_REQUIRED).
- Company users can create orgs and become owner.
- `profiles.twitter_username` cannot be overwritten with a different handle via generic profile edit (guard in `updateMyProfile`).
- Worker sets `profiles.analytics_initialized_at` after `x_backfill_90d` completes.
- No route writes fake 90d into `analytics_snapshots` (cron and admin only enqueue jobs; sync-x-profiles-daily and x-sync no longer write analytics_snapshots for this flow).
- GET /api/analytics/x and /api/analytics/x/summary still return data and prefer worker tables; `source` indicates worker vs fallback.
- Cron **x-analytics-daily** unchanged: still writes **today** to `x_daily_snapshots` and updates `profiles`.
- Cron **sync-x-profiles-daily** now writes today to `x_daily_snapshots` instead of `analytics_snapshots`.
- Wallet/CDP flows were not modified.

---

## Files changed (list)

- `supabase/migrations/20260247000000_phase1_org_gate_and_analytics_initialized.sql` (existing; already had analytics_initialized_at + RPC gate)
- `apps/worker/src/jobs/xBackfill90d.ts` — set `analytics_initialized_at` on success
- `apps/web/src/lib/backfill-x-90d.ts` — added `enqueueXBackfill90dJobs`, deprecated `runBackfillX90d`
- `apps/web/src/app/api/cron/backfill-x-90d-batch/route.ts` — enqueue only
- `apps/web/src/app/api/admin/backfill-x-90d/route.ts` — enqueue only
- `apps/web/src/app/api/cron/sync-x-profiles-daily/route.ts` — write `x_daily_snapshots` instead of `analytics_snapshots`
- `apps/web/src/app/api/x-sync/route.ts` — removed `analytics_snapshots` write
- `apps/web/src/app/api/analytics/x/route.ts` — added `source`
- `apps/web/src/app/api/analytics/x/summary/route.ts` — added `source`
- `apps/web/src/figma/app/components/IntegrationsPage.tsx` — handle read-only label, “Sync handle” button calling `/api/x/sync-handle`

No changes to wallet/CDP routes or login identity.
