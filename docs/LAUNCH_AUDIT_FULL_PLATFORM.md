# Linkary – Full Platform Launch Readiness Audit

**Date:** 2026-02-27  
**Scope:** Entire Linkary platform (apps/web, apps/worker, Supabase). Evidence-based; no new features or refactors.

---

-------------------------------------------------------------
## 0) EXECUTIVE SUMMARY (1 page)
-------------------------------------------------------------

**Current launch readiness status:** **Almost** (not Ready; not Not ready).

- Core flows (auth, public profile, collab requests, verified reviews, REP, X analytics) are implemented and backed by DB + API. Gaps are mostly hardening, clarity, and a few security/env checks.
- **Top 10 blockers (bulleted):**
  1. **CV route uses `public_profile_view` then service role for `profiles`/`profile_documents`** — Correct today (view gates published; path traversal blocked). Confirm no anon SELECT on `profiles` for CV path and that `public_profile_preview_view` is not granted to anon (confirmed in migration: REVOKE anon/authenticated/PUBLIC; GRANT service_role).
  2. **Profiles RLS** — Public SELECT is `published = true OR auth.uid() = id` (migration `20260218000000_mvp_orgs_reputation_marketplace.sql`). Confirm prod matches; anon cannot read unpublished profiles.
  3. **Case studies RLS** — `case_studies_select_public` is `USING (true)`; anyone can read all rows. App filters by `is_public`; consider tightening to only rows where owner is published or row is public (P1).
  4. **Cron / worker** — Tweet ingestion and rollups depend on either Next.js cron routes (CRON_SECRET) or Railway running worker scripts. `apps/worker/src/index.ts` is empty; cron lives in `apps/web/src/app/api/cron/`. Document and verify Railway cron schedule and env (CRON_SECRET, TWITTERAPI_API_KEY).
  5. **Dual review systems** — `reviews` (legacy, verified_deal) and `collab_reviews` (post-done collab). Public page merges both; create flow only writes `collab_reviews`. No bug but worth one source of truth for “verified” long-term (P2).
  6. **Readiness/smoke** — `/api/readiness` and `/api/admin/smoke` exist; ensure deploy env sets SUPABASE_SERVICE_ROLE_KEY, optional CRON_SECRET, SUPERADMIN_EMAILS for smoke.
  7. **test-supabase route** — Old audit flagged locking in prod; confirm `test-supabase` is reserved path or returns 404 in production (reserved in `lib/reservedPaths.ts`; route may still exist).
  8. **Error tracking** — No Sentry (or equivalent) in codebase; launch will lack server/client error capture (P1).
  9. **Env validation** — No startup Zod (or similar) for required env; missing keys can cause runtime failures (P1).
  10. **Onboarding/empty states** — No audit of empty states and post-signup onboarding clarity; recommend quick pass (P1).

**Recommended launch scope (closed beta MVP):**

- **In scope:** Public profile one-pager (`/[username]`), private `/profile` dashboard with Public preview iframe, collab requests (create/list/update to done), verified reviews (collab_reviews + legacy reviews on public page), REP (score + breakdown modal + admin backfill/recompute), X tweet ingestion + rollups via cron/worker, CV download (published only, signed URL), rate limiting (RPC), readiness + admin smoke.
- **Out of scope for beta:** Full discovery/search, email notifications, moderation/reporting/blocking, CDP wallet flows (optional; gate behind CDP routes only).

---

-------------------------------------------------------------
## 1) INVENTORY: WHAT EXISTS TODAY (CONFIRMED)
-------------------------------------------------------------

### A) Core infra + stability

| Item | Proof |
|------|--------|
| **Client error boundary** | `apps/web/src/app/ClientErrorBoundary.tsx` — getDerivedStateFromError, componentDidCatch, logs pathname/userAgent/stack (dev-safe). |
| **Public page error boundary** | `apps/web/src/app/(public)/[username]/error.tsx` — error + reset; user-facing “Something went wrong” + Try again / Go home. |
| **CDP route gating** | `apps/web/src/app/CdpProviderGate.tsx` — CDP (Coinbase) mounted only on wallet routes; other routes never load CDP. `AppWithProviders.tsx` comment confirms. |
| **CDP 401 handling** | `apps/web/src/app/CdpErrorBoundary.tsx` — Clears persisted state on 401/refresh failure. |
| **Rate limiting** | `supabase/migrations/20260222100000_rate_limits.sql` — `rate_limits` table + `consume_rate_limit(key, limit, window_seconds)` RPC. Used by readiness and collab-request notify. |
| **Readiness** | `apps/web/src/app/api/readiness/route.ts` — GET checks service Supabase, rate limit RPC, analytics_jobs, queue drainer, x_tweets; never leaks secrets. |
| **Admin smoke** | `apps/web/src/app/api/admin/smoke/route.ts` — Bearer JWT + superadmin (DB + env); checks analytics_jobs, x_window_aggregates, rate_limit_rpc. |
| **Deploy/runtime config** | Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (or `SERVICE_ROLE_KEY`), `CRON_SECRET` (optional for cron routes), `TWITTERAPI_API_KEY`, `NEXT_PUBLIC_APP_URL`. Examples: `apps/web/.env.local`, `apps/worker/.env.example`. |

### B) Auth + identity

| Item | Proof |
|------|--------|
| **Supabase Auth** | Used throughout; callback and profile creation: `apps/web/src/app/auth/callback/page.tsx` (username claim, USERNAME_TAKEN_VERIFIED message). |
| **Profile creation + onboarding** | Auth callback creates/updates profile; username reserved list and validation in `apps/web/src/lib/reservedPaths.ts` (`RESERVED_PATHS`), `isReservedPath()` used in `(public)/[username]/page.tsx`. |
| **Tables** | `auth.users` (Supabase); `public.profiles` (id = auth.uid()), `superadmin_emails`. |

### C) Public profile one-pager (`/[username]`)

| Item | Proof |
|------|--------|
| **Layout order / hidden / presets** | `apps/web/src/lib/publicLayoutPresets.ts` — `SECTION_KEYS`, `LEFT_COLUMN_KEYS`, `RIGHT_COLUMN_KEYS`, `PresetName`, `PRESET_DEFAULT_ORDER` (classic, spotlight, showcase, compact). |
| **Sections implemented** | Hero, header_media, header, socials, proof, trust_strip, action_bar, starter_block, featured, token, team, gigs, relations, roles, skills, achievements, case_studies, links, cv, partner_programs, reviews, completed_collabs — all in SECTION_KEYS and rendered via `PublicProfileContent` / `PublicOnePager`. |
| **Key files** | `apps/web/src/app/(public)/[username]/page.tsx` (server component; resolve by slug/wallet; fetches displayView, collab_reviews, reviews, case_studies, etc.). `PublicProfileContent.tsx`, `PublicOnePagerWrapper.tsx`, `PublicOnePager.tsx` in same dir and `components/public/PublicOnePager.tsx`. |
| **Views** | `public_profile_view` (published only) — `supabase/migrations/20260283100000_public_views_rep_score.sql`; `public_profile_preview_view` (service_role only, no anon) — same migration. |

### D) Private `/profile` dashboard

| Item | Proof |
|------|--------|
| **Tabs + Public preview iframe** | Profile dashboard has tabs; “Public preview” shows iframe of `/[username]` (docs: `docs/PROFILE_MAPPING_MATRIX.md`). |
| **Editing surface** | ProfileEditPage / builder; section order and visibility apply to public page only; not all builder fields are mirrored on dashboard (e.g. hero, preset) — intentional per matrix. |
| **Key files** | App.tsx routing, profile routes under `apps/web/src/app/`; Public preview tab documented in PROFILE_MAPPING_MATRIX. |

### E) Collab requests (Work → Requests)

| Item | Proof |
|------|--------|
| **DB schema** | `supabase/migrations/20260275000000_collab_requests.sql` — id, created_at, requester_profile_id, target_profile_id, message, category, budget_text, status (new/accepted/archived); RLS: insert requester, select/update requester or target. |
| **Anti-spam + done** | `supabase/migrations/20260280000000_collab_requests_anti_spam_done.sql` — status includes `done`; unique index one open request per pair (`WHERE status = 'new'`); index for cooldown. |
| **Cooldown** | `apps/web/src/app/api/collab-requests/route.ts` — 24h cooldown after last request between same pair; one open request per pair check. |
| **UI** | Collab request list/detail and update (status to done) wired via API routes under `apps/web/src/app/api/collab-requests/` (create, update, list by user). |

### F) Verified reviews

| Item | Proof |
|------|--------|
| **collab_reviews** | `supabase/migrations/20260282000000_collab_reviews.sql` — id, collab_request_id, reviewer_profile_id, target_profile_id, rating 1–5, text; one per collab per reviewer; RLS: SELECT public if target published or participant; INSERT only when request status = done and user is participant. |
| **UI create** | `apps/web/src/app/api/reviews/create/route.ts` — POST with collab_request_id, rating, text; validates request done and caller is requester or target; inserts into `collab_reviews`; triggers REP recompute. |
| **Public display** | `apps/web/src/app/(public)/[username]/page.tsx` — fetches both `reviews` (verified_deal true) and `collab_reviews`; merges; collab items get `verified_deal: true`, legacy `verified_deal: false`. `PublicOnePager.tsx` shows “verified reviews” and list. |
| **Verified vs unverified** | Collab-sourced reviews rendered with verified_deal true; legacy reviews with verified_deal false. Badge logic in payload/dto. |

### G) REP system

| Item | Proof |
|------|--------|
| **rep_score column** | `supabase/migrations/20260283000000_profiles_rep_score.sql` (assumed; rep_score on profiles). Exposed on `public_profile_view` in `20260283100000_public_views_rep_score.sql`. |
| **computeRep / recomputeRepForProfiles** | `apps/web/src/lib/repScore.ts` — `computeRep(profileId, supabase, { write })`, `recomputeRepForProfiles(ids, supabase)`. |
| **Mutation hooks** | REP recompute after: reviews create (`api/reviews/create/route.ts`), profile relations (`api/profile/relations/route.ts`, `profile/relations/[id]/route.ts`), case-studies update (`api/case-studies/[id]/route.ts`), collab-requests update (`api/collab-requests/update/route.ts`). |
| **Engagement sourcing** | `profiles.avg_engagement_per_post`; backfill: `apps/web/scripts/backfillAvgEngagementPerPost.ts`; rollups: `computeAndUpsertRollups` in x-analytics-server; docs: `docs/REP_ENGAGEMENT_BACKFILL.md`. |
| **Breakdown modal** | `apps/web/src/components/rep/RepBreakdownModal.tsx` — tiers/labels; `computeRep(..., { write: false })` for display. Public breakdown: `apps/web/src/app/api/public/rep/breakdown/route.ts`; authenticated: `api/rep/breakdown/route.ts`. |
| **Admin + QA** | `apps/web/src/app/api/admin/rep/backfill/route.ts`, `admin/rep/recompute-all/route.ts`, `admin/engagement/recompute-all/route.ts`; scripts: `apps/web/scripts/qaRep.ts`, `backfillRep.ts`, `verifyRepMonotonic.ts`, `diagnoseEngagementSources.ts`. Root `package.json`: `qa:rep`, `backfill-rep`, `diagnose-engagement`, `backfill-engagement`. |

### H) Analytics ingestion (X)

| Item | Proof |
|------|--------|
| **Tweet ingestion** | Tables: `x_tweets` (migration `20260220000000_x_analytics_ingestion.sql`); rollups/aggregates. |
| **Rollups** | `x_analytics_rollups`, `x_window_aggregates`; `computeAndUpsertRollups` in `apps/web/src/lib/x-analytics-server.ts`; worker: `apps/worker/src/lib/refreshXRollups.ts`, `ingestXTweets.ts`. |
| **Cron / workers** | Next.js: `apps/web/src/app/api/cron/sync-x-tweets-weekly/route.ts` (CRON_SECRET, TWITTERAPI_API_KEY; fetches tweets, insert, rollups). Other cron routes under `api/cron/`. Worker package: `apps/worker/src/index.ts` is empty; scripts: `sync_x_tweets_weekly.ts`, `sync_x_profiles_daily.ts`, `run_analytics_jobs.ts`, etc. Readiness mentions “Railway linkary-queue-drainer” and “sync-x:daily / sync-x:weekly”. |
| **Where / how often** | Cron: weekly tweet sync via POST to Next.js route (or Railway hitting same). Queue drainer: run `run_analytics_jobs` (e.g. every 2–5 min) per readiness. |

---

-------------------------------------------------------------
## 2) INVENTORY: PARTIAL / RISKY AREAS
-------------------------------------------------------------

| Risk | Description | Mitigation |
|------|-------------|------------|
| **Env dependency** | Missing SUPABASE_SERVICE_ROLE_KEY, CRON_SECRET, or TWITTERAPI_API_KEY causes 503 or auth failure. | Add env validation at startup (Zod); document in launch checklist. |
| **RLS: case_studies** | `case_studies_select_public` is USING (true); all rows readable. | App filters is_public; for launch acceptable; consider policy that restricts to (is_public = true AND (owner profile published OR owner org published)). |
| **RLS: profile_relations** | `profile_relations_public_read` USING (is_public = true) — any anon can read all public relations. | Intentional; no change for beta. |
| **Public exposure (CV)** | CV route: uses `public_profile_view` (published only) then service role for profiles + profile_documents; `file_path` checked for `..`. Signed URL 60s. | Correct; confirm no anon SELECT on profiles for that path; preview view not granted to anon. |
| **Public exposure (views)** | `public_profile_preview_view` — REVOKE anon/authenticated/PUBLIC; GRANT service_role in `20260283100000`. | Confirm in prod. |
| **Performance** | Public profile page does many parallel fetches (reviews, collab_reviews, case_studies, links, etc.). | Acceptable for beta; add caching (e.g. s-maxage on API) or ISR later. |
| **Background jobs** | Queue drainer and weekly sync depend on Railway/cron; if not run, x_tweets and rollups stall. | Document cron schedule; readiness warns on backlog; run `pnpm run qa:rep` and backfill scripts post-deploy. |
| **Dual review tables** | `reviews` (legacy) and `collab_reviews`; create only writes collab_reviews; public page merges both. | No immediate bug; long-term consider single “verified” source. |

---

-------------------------------------------------------------
## 3) MISSING FOR CLOSED BETA LAUNCH (MVP GAP LIST)
-------------------------------------------------------------

| Priority | Item | Why it matters | Suggested location |
|----------|------|----------------|---------------------|
| P0 | Confirm prod RLS matches migrations (profiles, collab_requests, collab_reviews) | Wrong RLS can expose private data or block valid flows. | Supabase Dashboard / `pg_policies`; doc in launch checklist. |
| P0 | Ensure test-supabase not reachable in prod (404 or redirect) | Old audit: avoid leaking internal test page. | `apps/web/src/app/test-supabase/` — return notFound() when NODE_ENV === 'production' or remove route. |
| P1 | Env validation at startup | Prevents obscure 503/500 from missing keys. | `apps/web/src` — small module that validates NEXT_PUBLIC_SUPABASE_*, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) and fails fast. |
| P1 | Error tracking (e.g. Sentry) | Launch needs client and server error capture. | apps/web: ClientErrorBoundary + API route error handler; optional worker. |
| P1 | Onboarding / empty states pass | New users need clear first steps and empty states. | Dashboard components and first-login flow (e.g. post-auth redirect to onboarding or profile completion). |
| P1 | Moderation/abuse: document or add report/block | Even closed beta can get abuse. | Either document “report via support” or add minimal report/block (table + API + hide from public). |
| P2 | Email notifications (optional) | Collab request creation is rate-limited and can email target; optional for beta. | Already referenced in collab-requests route; ensure Resend (or similar) env and behavior documented. |
| P2 | Basic search/discovery | Not required for closed beta. | N/A. |
| P2 | Mobile QA | Ensure public profile and /profile work on mobile. | Manual QA; no new file. |

---

-------------------------------------------------------------
## 4) SECURITY + PRIVACY AUDIT
-------------------------------------------------------------

- **Public views gating:** `public_profile_view` — WHERE published = true AND username IS NOT NULL AND username <> ''. `public_profile_preview_view` — no published filter; REVOKE anon/authenticated/PUBLIC; GRANT service_role. Gating correct.
- **CV download route:** `apps/web/src/app/api/public/cv/[username]/route.ts` — (1) Resolves profile via `public_profile_view` (published only), (2) reads profiles.cv_document_id and profile_documents with service role, (3) rejects if file_path contains `..`, (4) creates short-lived signed URL (60s), redirect. Correct for “published only, no path traversal, signed URL.”
- **Service role usage:** Service role used in CV route, readiness, admin smoke, cron, REP compute, backfill scripts. Not exposed to client; only server-side. Review: ensure SUPABASE_SERVICE_ROLE_KEY never in client bundle (confirm no import in client components).
- **RLS coverage:**
  - **profiles:** SELECT published = true OR auth.uid() = id; INSERT/UPDATE own. ✓
  - **collab_requests:** Insert requester; select/update requester or target. ✓
  - **collab_reviews:** Select if target published or participant; insert when request done and participant. ✓
  - **case_studies:** SELECT (true); INSERT/UPDATE/DELETE owner (profile or org admin). ✓ (consider tightening SELECT for privacy.)
  - **profile_relations:** All for source owner; SELECT is_public for rest. ✓
  - **connections:** Select/insert/update requester or recipient. ✓

**Flagged:** case_studies SELECT (true) allows reading all rows; app relies on is_public filter. Optional: restrict SELECT to rows where (is_public = true) or owner is current user / org member.

---

-------------------------------------------------------------
## 5) LAUNCH CHECKLIST (STEP BY STEP)
-------------------------------------------------------------

1. **Migrations**
   - Run `npx supabase db push` (or apply all under `supabase/migrations/`) and confirm no errors.
   - Confirm applied: `20260275000000_collab_requests.sql`, `20260280000000_collab_requests_anti_spam_done.sql`, `20260282000000_collab_reviews.sql`, `20260283100000_public_views_rep_score.sql`, `20260222100000_rate_limits.sql`, `20260234000000_public_views_privacy.sql`, `20260218000000_mvp_orgs_reputation_marketplace.sql`.

2. **Scripts**
   - `pnpm run qa:rep` — REP consistency checks.
   - Optional: `pnpm run backfill-engagement`, `pnpm run backfill-rep` after tweet/rollup data exists.

3. **Smoke tests**
   - GET `/api/readiness` — ok true when service role and rate limit RPC work.
   - GET `/api/admin/smoke` with Bearer <superadmin JWT> — diagnostics ok (set SUPERADMIN_EMAILS or superadmin_emails in DB).

4. **Deployment env**
   - **Vercel (web):** NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY), NEXT_PUBLIC_APP_URL, CRON_SECRET (if using Vercel cron → cron routes).
   - **Railway (worker/cron):** Same Supabase keys; TWITTERAPI_API_KEY; CRON_SECRET if worker calls Next.js cron; schedule cron for weekly tweet sync and queue drainer (run_analytics_jobs) every 2–5 min.
   - **Supabase:** RLS enabled; policies match migrations; no anon/authenticated on public_profile_preview_view.

5. **Monitoring / logging**
   - Confirm readiness and smoke endpoints used by health checks.
   - Add error tracking (Sentry or similar) for client and API (P1).

---

-------------------------------------------------------------
## 6) PRIORITIZED PUNCH LIST (THE ONLY NEXT WORK)
-------------------------------------------------------------

### P0 — Must fix before beta

| Task | Files / tables | Test to confirm done |
|------|----------------|-----------------------|
| Verify prod RLS for profiles, collab_requests, collab_reviews | Supabase Dashboard, `pg_policies` | Run SELECT as anon for unpublished profile → no row; as target/requester collab_requests visible. |
| Lock or remove test-supabase in prod | `apps/web/src/app/test-supabase/*` | In prod build, open /test-supabase → 404 or redirect. |
| Confirm public_profile_preview_view not granted to anon | DB: `information_schema.table_privileges` or Supabase UI | anon cannot SELECT public_profile_preview_view. |

### P1 — Should fix

| Task | Files / tables | Test to confirm done |
|------|----------------|-----------------------|
| Env validation at web startup | New or existing `apps/web/src/lib/env.ts` (or config) | Omit SUPABASE_SERVICE_ROLE_KEY → app fails fast with clear message. |
| Add error tracking (Sentry) | ClientErrorBoundary, API error handler | Trigger client error → event in Sentry; same for API 500. |
| Onboarding / empty states pass | Dashboard, first-login flow | New user sees clear CTA and empty states not blank. |
| Document or add report/block | Docs or `report_*` table + API | Either doc “report via support” or report flow works. |

### P2 — Later

| Task | Files / tables | Test to confirm done |
|------|----------------|-----------------------|
| Tighten case_studies RLS SELECT | `supabase/migrations/` new migration | anon sees only is_public rows (or owner published). |
| Single “verified reviews” source (optional) | `collab_reviews` + possibly deprecate legacy `reviews` for profile | Public page and REP use one table for verified. |
| Email notifications (optional) | Collab-request notify path | Env set; target receives email when request created (if in scope). |

---

**End of audit.** All claims above are tied to file paths, routes, or migrations cited in section 1.

---

## Appendix: Mock data removal (launch hardening)

**Date:** Post-audit hardening.

| Location | What was mock | Change |
|----------|----------------|--------|
| **Overview page (App.tsx)** | Stats cards (2,847 creators, 1,284 projects, etc.); Featured Events; AI Matched Opportunities | Already fixed earlier: stats from `/api/overview/stats`, Featured Events replaced with Get started block, AI block uses `demo.marketplace.interestedProjects` (empty array in demo). |
| **CirclesOverviewPage** | `statsData`: totalCircles 6, verifiedMembers 68, totalReach 4.37M, avgPowerScore 598 | Replaced with zeros + `isBeta: true`; display shows "—" for reach and avg power when 0; added line "Circle analytics in beta. Stats will appear when available." |
| **Explore / Featured Creators & Projects** | `demo.explore.individuals`, `demo.explore.projects` | Already empty arrays; UI shows "Search for creators and projects" empty state. |
| **Blog tab** | `demo.blog.posts` | Already empty array; UI shows "No posts yet." |
| **Leaderboards** | `demo.leaderboards.topCreators`, `demo.leaderboards.topProjects` | Already empty arrays; UI shows "Coming soon." |
| **AI Matched Opportunities (Overview)** | `demo.marketplace.interestedProjects` | Final demo object has `interestedProjects: []`; block never renders. |
