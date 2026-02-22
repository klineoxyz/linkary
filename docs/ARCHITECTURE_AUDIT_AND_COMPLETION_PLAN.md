# Linkary — Full Product Architecture Audit & Completion Plan

**Date:** 2025-02-22  
**Scope:** Identity, Orgs, Analytics, Case Studies/Gigs (Jobs/Deals/Reviews), Reputation, Production Hardening, 90-Day Backfill Design.

---

# PART 1 — SYSTEM AUDIT

## A. Identity & Auth Audit

### What exists
- **Single auth entry point:** Supabase Auth; X OAuth only (provider normalized to `twitter` in `social_accounts`).
- **Profile creation:** No DB trigger on `auth.users`. Profile is created in `POST /api/auth/post-login-bootstrap` with `id: user.id` → **profiles.id = auth.uid()** is enforced by app and by RLS `profiles_insert_own` (WITH CHECK (auth.uid() = id)).
- **CDP:** Wallet is linked post-login; `cdp_wallets.user_id` = auth.uid(); no CDP auth as identity — CDP is wallet-only.
- **social_accounts:** `user_id` = auth.uid(); RLS select/insert/update only where `user_id = auth.uid()`.
- **Uniqueness:** `idx_social_accounts_one_active_x_per_user` (user_id, provider); `idx_social_accounts_one_x_per_provider_user` (provider, provider_user_id) → one X account per Linkary user, one Linkary user per X account.

### Identity risks
1. **Profile row may not exist** if user never hits post-login-bootstrap (e.g. API-only or custom client). Mitigation: ensure all clients call post-login-bootstrap after first sign-in.
2. **Email lookup in org invite** uses service role to resolve email → profile.id; acceptable for invite flow only; no leak of service key to client.

### Confirmed safe flows
- Login → post-login-bootstrap → profile insert with id = user.id; social_accounts upsert for X.
- RLS enforces profiles.id = auth.uid() on INSERT/UPDATE.
- social_accounts uniqueness prevents same X on two accounts and two X connections per user.

### Required cleanups
- None critical. Optional: add a DB trigger on `auth.users` INSERT to create a minimal profile row so profile always exists even if bootstrap is skipped (then bootstrap becomes upsert-only).

---

## B. Org System Audit

### Tables
- **orgs:** id, slug, name, tagline, website, twitter_username, logo_url, org_type, parent_org_id, created_by, owner_profile_id, published, is_x_verified, x_account_username, x_account_user_id, x_connected_at, updated_at. Constraint: `published` only true when `is_x_verified = true`.
- **org_members:** id, org_id, user_id, role ('owner','admin','member'), created_at. UNIQUE(org_id, user_id). Trigger: at least one owner (org_members_ensure_last_owner).

### RLS (current)
- **orgs:** SELECT all; INSERT authed; UPDATE if owner_profile_id = auth.uid() OR is_org_admin(org_id, auth.uid()).
- **org_members:** SELECT own rows; INSERT if is_org_admin(org_id, auth.uid()); UPDATE/DELETE own row or admin.

### API
- `POST /api/orgs/create` → RPC `create_org_and_membership`. **Does not check account_type = 'company'.**
- `POST /api/orgs/[orgId]/members/invite` → body `{ username?, email? }`; resolves to user id (username via anon client, email via service role); inserts org_members with role `admin`. Only org owner/admin (is_org_admin) can call; RLS enforces.
- Orgs jobs: POST/GET/PATCH/DELETE under `/api/orgs/[orgId]/jobs`; member list GET/PATCH/DELETE under `/api/orgs/[orgId]/members`.

### Permission matrix (intended vs actual)
| Action              | Intended        | Actual |
|---------------------|-----------------|--------|
| Create org          | account_type=company | **Any authed user** (missing check) |
| Org owner           | Auto admin       | Yes (owner_profile_id + role owner) |
| Multiple admins     | Yes              | Yes (org_members.role = admin) |
| Invite by username  | Yes              | Yes |
| Invite by email     | Yes              | Yes (service role lookup) |
| Edit org            | Owner/admin      | Yes (RLS) |
| Add members         | Owner/admin      | Yes (RLS) |
| Post jobs           | Owner/admin      | Yes (jobs_insert_org_admin) |

### Required fixes
1. **Enforce account_type = 'company' for org creation:** In `POST /api/orgs/create`, before calling RPC, read profile.account_type; if not `'company'`, return 403 with clear message. Optionally also enforce in RPC for defense in depth.
2. **Invite role:** Currently hardcodes role `admin`. Consider allowing body `role?: 'admin' | 'member'` (default admin) and validate role in ('admin','member') — never allow inviting as 'owner' via API.

### Missing constraints
- None critical. Optional: CHECK on org_members that org.owner_profile_id has exactly one member with role 'owner'.

### Suggested indexes
- Already present: idx_orgs_owner_profile_id, idx_orgs_is_x_verified, idx_orgs_published, org_members (org_id, user_id) unique.

---

## C. Analytics System Audit

### Tables in use
- **x_daily_snapshots:** (owner_type, owner_id, day) UNIQUE; columns: followers, engagement_rate, tweets_count, likes_received, etc. Used by cron daily, ensure-backfill, and **worker** backfill.
- **x_window_aggregates:** (owner_type, owner_id, window_days, as_of) UNIQUE; 7/30/90 day windows; followers_start/end/delta, avg_engagement_rate, posts_count, etc. **Worker** computes from x_daily_snapshots.
- **analytics_jobs:** Queue for x_backfill_90d; status queued|running|done|failed; run_after, attempts, last_error, payload (username, user_id).
- **analytics_snapshots** (unified): (owner_type, owner_id, platform, day, window_days) UNIQUE; metrics JSONB. Used by **lib/backfill-x-90d.ts** (cron backfill-x-90d-batch) only — **not** by worker or ensure-backfill.

### What happens when a new user connects X?
1. OAuth callback / persist-social / post-login-bootstrap → social_accounts + profile updated.
2. ensure-backfill (GET/POST) or persist-social/sync-session-x: writes **today** to `x_daily_snapshots`, checks `x_window_aggregates` for 90d; if no 90d row, inserts into `analytics_jobs` (job_type: x_backfill_90d).
3. **Worker** (run_analytics_jobs) picks job, runs xBackfill90d: fetches tweets (twitterapi.io), fills **x_daily_snapshots** per day, then computes **x_window_aggregates** for 7/30/90. So **real 90-day backfill is worker-only**; UI/API read from x_daily_snapshots + x_window_aggregates.

### Does it backfill?
- **Yes**, via queue: ensure-backfill (or persist-social) enqueues x_backfill_90d; worker processes and fills x_daily_snapshots + x_window_aggregates.
- **Gap:** No `profiles.analytics_initialized_at` set when backfill completes; no single source of truth "this profile has 90d data."

### Inconsistency / danger
- **Cron route** `POST /api/cron/backfill-x-90d-batch` uses `runBackfillX90d` from `lib/backfill-x-90d.ts`, which writes to **analytics_snapshots** (not x_daily_snapshots) and fills 90 days with **current** snapshot only (no historical per-day data). So:
  - Worker path: correct (x_daily_snapshots + x_window_aggregates, real history).
  - Cron backfill-x-90d-batch path: wrong table and wrong semantics (duplicated current state in analytics_snapshots). Recommend: **remove or repurpose** cron backfill-x-90d-batch so it does not duplicate this logic; 90d backfill should be **only** via analytics_jobs + worker.

### Snapshot schema (canonical: x_daily_snapshots)
- Idempotent: upsert on (owner_type, owner_id, day). Good.
- Delta: stored in x_window_aggregates (followers_delta, etc.), not computed live. Good.
- Signal generation: worker computes aggregates from snapshots; no separate signal table yet (signals can be derived from x_window_aggregates or future table).

### ensure-backfill route
- Writes today to x_daily_snapshots; checks x_window_aggregates for 90d; if missing, inserts analytics_jobs. Idempotent (job dedup by 2h window). Good.
- Uses social_accounts for handle; falls back to profile.twitter_username / twitter_username_candidate. Good.

### Rate limit / error handling
- No rate limiting on API routes. twitterapi.io limits apply externally; worker has DELAY_MS. Cron protected by CRON_SECRET.
- Error handling: ensure-backfill returns JSON with reason; worker marks job failed and backoff. No standardized error response shape across all API routes.

### Design for POST /api/analytics/backfill-90
- **Option A (recommended):** Do not add a new public route. Keep flow: ensure-backfill (or persist-social) enqueues job; worker runs 90d backfill. Add `POST /api/analytics/backfill-90` only if you need a **user-triggered** "start my 90d backfill" that enqueues one job for current user (idempotent, same as ensure-backfill when 90d missing).
- **Option B:** Add route that enqueues job and returns job id; same as current ensure-backfill behavior when 90d is missing.

### Suggested indexes
- x_daily_snapshots: (owner_type, owner_id, day DESC) — exists.
- x_window_aggregates: (owner_type, owner_id, window_days) — exists.
- analytics_jobs: (status, run_after), (owner_type, owner_id, job_type) — exist.

### Race condition risks
- Two requests enqueue same profile: ensure-backfill checks "recent job in queued/running in last 2h" → reduces duplicate jobs. Worker processes one job at a time. Safe.
- Worker and cron both writing: cron x-analytics-daily writes **today** to x_daily_snapshots; worker writes many days. Upsert by (owner_type, owner_id, day) avoids conflicts.

---

## D. Case Studies + Gigs (Jobs/Deals/Reviews) Audit

### Terminology
- **Gigs** in UI = **jobs** (org posts) + **applications** + **deals** (agreement between profile and org). No separate `gigs` table.

### Job lifecycle (jobs table)
- status: open | accepted | completed | paid. No "draft" or "assigned" in schema. So lifecycle is: open → (application accepted) → accepted → completed → paid.

### Deal lifecycle (deals table)
- status: active | completed | disputed. delivered_at, accepted_at, completed_at. Trigger sets completed_at and status = completed when both delivered_at and accepted_at set. Only participants can update (profile sets delivered_at; org admin sets accepted_at).

### Reviews
- deal_id NOT NULL; one review per deal per reviewer (unique on deal_id, reviewer_type, reviewer_profile_id, reviewer_org_id). Trigger: reviews only for completed deals; reviewer/reviewee must be parties; no self-review; verified_deal set true on insert.

### Case studies
- case_studies: owner_type, owner_profile_id | owner_org_id, title, description, proof_url, metrics. **No deal_id or job_id.** So "case study references gig" is **not** implemented.

### Answers to edge cases
- **Can user review twice?** No — unique index one review per deal per reviewer.
- **Can review be left without gig?** No — deal_id NOT NULL; trigger requires completed deal and parties.
- **Can gig be marked completed by one side only?** Deal: creator sets delivered_at; org sets accepted_at. Both required for completed_at (trigger). So bilateral. Job status is separate (open/accepted/completed/paid); application accept flow updates job; deal completion does not auto-update job status — consider aligning job.status with deal lifecycle if desired.

### Required DB constraints
- Already: reviews deal_id NOT NULL, unique per deal per reviewer, trigger for completed deal + parties.
- Missing: case_studies.deal_id (optional FK) to link case study to a deal/gig for "verified collaboration" and correlation with analytics.

### Flow diagram (concise)
- Org (owner/admin) posts job (open) → Creator/agency applies → Org accepts application → Deal created (active) → Creator marks delivered → Org marks accepted → Deal completed → Either party can leave one review (reviewer = one party, reviewee = other). Case study today is standalone (no FK to deal/job).

---

## E. Reputation Index Audit

### How it is computed
- **me-stats** and **linkaryScore.ts:** `reputationIndex` in API = `Math.round(score100)` from `computeLinkaryPower()`. So 0–100 score.
- **computeLinkaryPower:** 20% Ethos, 20% XScore, 15% reviews, 15% engagement, 10% follower authority, 10% verified gigs, 10% case impact. Inputs: ethosScore, xscore, followers, engagementRate, verifiedReviewsCount, ratingAvg, verifiedGigsCount, caseStudyDeltas. me-stats does **not** pass verifiedGigsCount or caseStudyDeltas yet.

### Stored?
- Not stored. Computed on read in me-stats and wherever Linkary Power is needed. xscore is stored (profiles.xscore, orgs.xscore); ETHOS from API/cache.

### Recalculated?
- Every request that calls computeLinkaryPower (e.g. GET /api/profile/me-stats). Deterministic given inputs.

### v1 formula (current)
- Already a clear formula in linkaryScore.ts. For true "reputation index" v1: keep using score100 (0–100) as reputationIndex; optionally persist to profiles.reputation_index (or similar) in a nightly job so reads are cheaper and consistent across endpoints. Not required for launch.

### Proposal v1 (simple, safe)
- Leave formula as-is. Ensure me-stats supplies verifiedReviewsCount and ratingAvg from reviews (done). Optionally add verifiedGigsCount (count of completed deals for profile) and caseStudyDeltas (from case studies if/when linked to deals). Then reputationIndex = round(score100). No DB column required for MVP.

---

## F. Production Hardening

### Bearer verification
- All authenticated API routes checked: they use `Authorization: Bearer <token>` and `supabase.auth.getUser(token)`. No route found that skips auth for sensitive actions. Cron routes use CRON_SECRET.

### Service role key
- Used server-side only (ensure-backfill, cron, invite email lookup, claim, sync-session-x, persist-social, x-sync, admin routes, wallet ensure). Not exposed to client. Env vars: SUPABASE_SERVICE_ROLE_KEY / SERVICE_ROLE_KEY.

### Client-side direct writes
- Client uses Supabase with anon key + RLS. No bypass; RLS enforces ownership. Service role used only in API routes and worker.

### Profile updates / twitter_username
- **Risk:** `updateMyProfile` in profiles.ts only blocks overwriting non-empty twitter_username when the **new** value is empty string. It does **not** block overwriting with a different handle (e.g. client sends twitter_username: "other"). So non-empty twitter_username can be overwritten by a malicious or buggy client. **Fix:** If row has non-empty twitter_username, ignore incoming twitter_username unless it equals current (or only allow clear from X flow via dedicated endpoint).

### Wallet address as email
- No code found that stores wallet address in profiles.email. Email is from auth or user-editable in settings.

### Rate limiting
- **Missing** on API routes. Recommend: add rate limiting (e.g. per-IP or per-user) on auth, invite, and analytics endpoints.

### Error responses
- Not standardized. Some return `{ error: string }`, some `{ ok: false, code, message }`. Recommend: standardize JSON error shape (e.g. code, message, requestId) and use consistent status codes.

### Security summary
- **Risks:** (1) twitter_username overwrite in profile update; (2) no rate limiting; (3) org creation not restricted to account_type = 'company'.
- **Guards:** Bearer on sensitive routes; service role server-only; RLS on tables.

---

# PART 2 — COMPLETION PLAN

## Phase 1 — Stabilization (2 weeks)
- Enforce **account_type = 'company'** on org creation (API + optionally RPC).
- **90-day analytics:** Unify on worker + x_daily_snapshots + x_window_aggregates; remove or fix cron backfill-x-90d-batch so it does not write to analytics_snapshots with fake 90d; add profiles.analytics_initialized_at set by worker when 90d job completes.
- **Reputation formula v1:** Keep linkaryScore; optionally add verifiedGigsCount and caseStudyDeltas to me-stats inputs; no DB column for index required.
- **Snapshot indexes:** Already present for x_daily_snapshots and x_window_aggregates.
- **RLS audit:** Done in Part 1; no critical gaps; org creation gate is application-level.
- **Remove dead routes:** Consider deprecating or repurposing POST /api/cron/backfill-x-90d-batch (or make it only enqueue jobs, not write analytics_snapshots).
- **Profile update:** Harden twitter_username (do not overwrite non-empty with a different value).

## Phase 2 — Trust Infrastructure
- **Case study ↔ deal:** Add case_studies.deal_id (nullable FK to deals) and optionally job_id; allow linking case study to a completed deal.
- **Verified collaboration flag:** Already have reviews.verified_deal; can surface "verified collaboration" on profile/org when review exists for completed deal.
- **Review anti-spam:** Already one review per deal per reviewer; consider rate limit on review creation (e.g. max N per day per user).
- **Admin dashboard:** Moderation for abuse (flag reviews, hide orgs, etc.) — not present in repo; add as separate scope.

## Phase 3 — Scale Readiness
- **Background job queue:** Already have analytics_jobs + worker; ensure Railway (or other) runs worker on schedule (e.g. every 5–10 min).
- **Rate limit handling:** Add middleware or per-route limits for auth, invite, analytics, and public search.
- **Backfill batching:** Worker already processes one job at a time; can increase batch size of job polling or run multiple workers.
- **Monitoring endpoints:** Add GET /api/health and optional GET /api/admin/queue (protected) for job queue depth and failures.

---

# PART 3 — 90-DAY ANALYTICS BACKFILL DESIGN

### When user connects X
1. **Immediately:** Persist social_accounts + profile mirror (existing). Call ensure-backfill (or equivalent) so **today** is written to x_daily_snapshots and, if no 90d data, **enqueue** one analytics_job (x_backfill_90d) with payload { username, user_id }.
2. **Worker** (run_analytics_jobs): Pick job; fetch **current** user info (followers) and **recent tweets** (e.g. last 600) from twitterapi.io; group by day; for each day upsert x_daily_snapshots (owner_type=profile, owner_id, day, followers for today, tweets_count, likes_received, etc.); then compute 7d/30d/90d windows from x_daily_snapshots and upsert x_window_aggregates (followers_start, followers_end, followers_delta, avg_engagement_rate, posts_count, etc.).
3. **Mark initialized:** When worker marks job status = done, update profiles.analytics_initialized_at = now() for that profile (owner_id). Requires new column and worker change.

### Idempotency and resume
- **Idempotent:** Upserts on (owner_type, owner_id, day) for x_daily_snapshots and (owner_type, owner_id, window_days, as_of) for x_window_aggregates. Re-running same job overwrites same rows; safe.
- **Resume:** If job fails, it is re-queued with backoff (run_after). Next run processes same job again; upserts overwrite partial data. No separate "resume from day X" required for v1.
- **No double insert:** Unique constraints prevent duplicate rows; job dedup in ensure-backfill (same profile, job in queued/running in last 2h) prevents duplicate jobs.

### Table modifications
- **profiles:** ADD COLUMN analytics_initialized_at timestamptz DEFAULT NULL. Set by worker when x_backfill_90d job completes successfully.
- **analytics_jobs:** Optional payload.updated_at or completed_at for observability; not required for idempotency.

### New route design
- **POST /api/analytics/backfill-90** (optional): Authenticated; enqueues x_backfill_90d for current user if not already enqueued/completed (same logic as ensure-backfill when 90d missing). Returns { enqueued: boolean, jobId?: string }. Keeps single code path (ensure-backfill or this) for enqueue.

### Worker cron design
- Run `run_analytics_jobs` every 5–10 minutes (e.g. Railway cron or process). It: fetch one queued job (status=queued, run_after <= now()); mark running; run xBackfill90d; on success mark done and set profiles.analytics_initialized_at for owner_id; on failure re-queue with backoff. One job per run is sufficient; can run multiple workers if needed.

### Follower history
- twitterapi.io may not expose historical follower counts per day. Current design: use **current** followers for "today" and optionally backfill past days with null followers (only tweet metrics per day). So 90d **delta** is only meaningful when at least two snapshots have followers (e.g. today and a previous run); for brand-new users, delta appears after next day's cron (x-analytics-daily) or a second run. Document this for product.

---

# PART 4 — OUTPUT FORMAT

## 1. What is correct
- Single auth entry (Supabase X OAuth); profiles.id = auth.uid() enforced by RLS and bootstrap.
- social_accounts canonical for X; uniqueness one-X-per-user and one-user-per-X.
- CDP wallet post-login only; no CDP auth.
- Org RLS: owner_profile_id + is_org_admin; org_members insert by admin; invite by username/email implemented.
- Jobs/deals/reviews: deal_id required for reviews; one review per deal per reviewer; trigger enforces completed deal and parties; bilateral completion (delivered_at + accepted_at).
- Analytics: x_daily_snapshots + x_window_aggregates + analytics_jobs + worker backfill; ensure-backfill enqueues 90d job and writes today; idempotent upserts.
- Reputation: deterministic formula in linkaryScore; me-stats returns reputationIndex (score100); xscore/ETHOS stored or fetched.
- Bearer used on authenticated routes; service role server-side only; RLS on tables.
- Profile update strips xscore; comment says do not overwrite non-empty twitter_username (implementation incomplete — see below).

## 2. What is missing
- **Org creation:** Check account_type = 'company' before allowing create.
- **profiles.analytics_initialized_at:** Not present; worker should set when 90d backfill completes.
- **Case study ↔ gig:** No deal_id/job_id on case_studies.
- **Rate limiting** on API.
- **Standardized error response** shape.
- **Optional POST /api/analytics/backfill-90** for explicit user-triggered backfill (or rely only on ensure-backfill).
- me-stats: verifiedGigsCount and caseStudyDeltas not passed to computeLinkaryPower yet (optional).

## 3. What is dangerous
- **Profile twitter_username:** updateMyProfile allows overwriting non-empty twitter_username with a different value (only blocks set to ""). Fix: ignore incoming twitter_username when current is non-empty, unless explicitly syncing from X.
- **Cron backfill-x-90d-batch** writes to analytics_snapshots with duplicate current-state data for 90 days; wrong table and misleading. Disable or repurpose; 90d backfill should be worker-only (x_daily_snapshots + x_window_aggregates).
- **No rate limiting:** Auth and invite endpoints are abusable; add limits.

## 4. What to build next (prioritized)
1. **Harden profile update** — do not overwrite non-empty twitter_username with another handle.
2. **Org creation gate** — require account_type = 'company' in POST /api/orgs/create (and optionally in RPC).
3. **profiles.analytics_initialized_at** — migration + worker sets it when x_backfill_90d job completes.
4. **Unify 90d backfill** — remove or change cron backfill-x-90d-batch so it does not write to analytics_snapshots; rely on worker only.
5. **Rate limiting** — add to auth, invite, and optionally analytics/search routes.
6. **Case study deal_id** — migration add nullable deal_id to case_studies; UI/API to link case study to deal.
7. **Error response standard** — e.g. { code, message } and consistent status codes.
8. **Health/monitoring** — GET /api/health; optional admin queue status.

## 5. Exact DB migrations required
- **Migration 1:** `ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS analytics_initialized_at timestamptz DEFAULT NULL;` + comment.
- **Migration 2:** `ALTER TABLE public.case_studies ADD COLUMN IF NOT EXISTS deal_id uuid REFERENCES public.deals(id) ON DELETE SET NULL;` + index + comment (optional; Phase 2).
- No migration required for org creation gate (app-level check). Optional: RPC create_org_and_membership could check (SELECT account_type FROM profiles WHERE id = auth.uid()) = 'company' and raise if not.

## 6. Exact API routes to add
- **POST /api/analytics/backfill-90** (optional): Auth required; if no 90d window and no recent job for profile, insert analytics_jobs; return { enqueued, jobId? }. Reuse ensure-backfill logic or call shared helper.
- **GET /api/health:** Return 200 + { status: 'ok', ts } (and optionally queue depth if service role available).
- **GET /api/admin/queue** (optional): Superadmin only; return count of queued/failed jobs and last errors.

## 7. Exact frontend adjustments needed
- **Org creation:** Before calling POST /api/orgs/create, ensure user has completed onboarding and account_type is 'company'; if not, show "Set up company account to create an org" and redirect to onboarding/settings to set account type.
- **Profile settings:** Do not send twitter_username from profile edit form when it is "read-only" (synced from X); or send only when explicitly "Sync from X" so backend never overwrites with arbitrary value.
- **Analytics:** After X connect, show "Building your 90-day history…" until profiles.analytics_initialized_at is set or x_window_aggregates has 90d row; then show charts. Optional: "Request 90-day backfill" button that calls POST /api/analytics/backfill-90 or ensure-backfill.
- **Case studies (Phase 2):** When creating/editing case study, optional "Link to completed deal" dropdown (deals where profile/org is party and status = completed).

---

**Summary:** Identity and RLS are in good shape. The largest gaps are (1) 90-day backfill consistency (worker vs cron and analytics_initialized_at), (2) org creation restricted to company accounts, (3) profile twitter_username overwrite protection, and (4) rate limiting and error standardization. Implementing the 90-day flow with a single path (worker + x_daily_snapshots + x_window_aggregates) and marking profiles when done will make new creators see real history and deltas quickly.
