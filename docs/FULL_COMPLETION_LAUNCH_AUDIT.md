# LINKARY – FULL COMPLETION & LAUNCH AUDIT

**Date:** 2025-02-20  
**Scope:** Entire codebase – production readiness for real user onboarding.  
**Rule:** Nothing may be "coming soon," placeholder, UI-only, or trust-based. Everything must be real, enforced, connected, and secure.

---

## 🔴 Critical Breakpoints (Must Fix Before Users)

1. **XScore is user-editable → reputation inflation**
   - `ProfileEditPage` and `updateMyProfile()` accept `xscore` (0–1000) from the client and persist it.
   - Any user can set `xscore` to 1000. Reputation index and "social power" use this value.
   - **Fix:** Remove xscore from profile edit; source only from Wallchain API or cron. If no API, do not show/store xscore until enforced server-side.

2. **Reviews: no creation path + no deal/party enforcement**
   - No API or UI inserts into `reviews`. Reviews are read-only in app (publicData, me-stats).
   - RLS `reviews_insert_reviewer` only checks `reviewer_profile_id = auth.uid()` (or org admin). It does **not** require:
     - `deal_id` set or deal status = completed
     - Reviewer/reviewee being parties to the same deal
     - One review per deal
   - **Risk:** When review creation is added, users can submit fake reviews (self-review, review farming) unless DB + API enforce deal linkage and completion.
   - **Fix:** Add DB constraint or trigger: review insert requires `deal_id` and deal.status = 'completed'; add UNIQUE(deal_id) or (deal_id, reviewer) so one review per deal per reviewer; enforce in API that reviewer is a party to the deal.

3. **analytics_snapshots: user upsert will fail (RLS)**
   - `/api/x-sync` uses the **user’s** Supabase client to `upsert` into `analytics_snapshots`.
   - `analytics_snapshots` has only a **SELECT** RLS policy; no INSERT/UPDATE for authenticated users. Comment in migration: "Service role / cron will INSERT."
   - **Result:** X sync will succeed for profile update but the snapshot upsert will fail with RLS for normal users.
   - **Fix:** Either use service-role client in x-sync for the snapshot upsert, or add an RLS policy: INSERT/UPDATE for `(owner_type = 'profile' AND owner_id = auth.uid())` (and align schema: x-sync currently writes `profile_id`; 20260225 migration added `owner_type`/`owner_id` – ensure one consistent schema and that new rows get owner_type/owner_id set).

4. **sync-session-x overwrites twitter_username**
   - Migration comment: "twitter_username … single source of truth; do not overwrite non-empty with arbitrary value."
   - `sync-session-x` route, when an existing profile exists, sets `updates.twitter_username = normalizedHandle` from OAuth every time (line 61).
   - **Risk:** If a user had a verified/hand-set handle and then signs in with a different X account (or OAuth returns wrong handle), we overwrite and can cause impersonation or confusion.
   - **Fix:** If `profiles.twitter_username` is already non-empty and differs from OAuth handle, do not overwrite; set `twitter_username_candidate` for review or show conflict UI.

5. **No UNIQUE on profiles.twitter_username**
   - Two profiles can have the same `twitter_username`. Resolver and public data could show wrong profile when resolving by X handle.
   - **Fix:** Add UNIQUE( LOWER(twitter_username) ) on profiles where twitter_username IS NOT NULL, or enforce single-owner in usernames/identity layer and keep twitter_username in sync with that.

6. **Reviews: no UPDATE/DELETE RLS**
   - Only SELECT and INSERT policies exist. If you need to allow reviewers to edit/delete within a time window, or support moderation, no policy exists.
   - Not blocking if reviews are intentionally immutable; document and add moderation path via service role or dedicated policy if needed.

---

## 🟠 Structural Incompletions

1. **Reviews flow is read-only**
   - DB and RLS support inserts; no app code or UI creates reviews. Deal creation → completion → bilateral review flow is not implemented end-to-end.
   - **Action:** Implement: create deal from job/application, mark completed, then allow each party to submit one review tied to that deal (with DB/API enforcement above).

2. **Signals are UI-only**
   - "Signals" in Analytics are derived in the client from KPI deltas (AnalyticsPage.tsx). No `signals` table; no server-side signal persistence or recalculation.
   - **Action:** Either define signals as a first-class backend model (table + worker) or document that "signals" are purely derived on read and not stored.

3. **Reputation index is computed on read**
   - `linkaryScore.ts` computes reputation from ethos, xscore, reviews, etc. No stored `reputation_index`; xscore is user-editable (see Critical #1).
   - **Action:** Once xscore is server-authoritative, consider caching reputation in DB for performance and consistency.

4. **Gigs = Jobs**
   - "Gigs" in copy and filters refer to `jobs` table. Jobs/applications/deals exist; no separate "gigs" table. Ensure all gig wording points to jobs and that job lifecycle (open → accepted → completed → paid) is enforced and visible in UI.

5. **Case studies: RLS present, UI may be split**
   - `case_studies` has RLS and `createCaseStudyForProfile`/`createCaseStudyForOrg` in lib. App.tsx (figma) has case study form; ensure the live app route (e.g. profile/edit or dashboard) uses the same lib and not mock data.

6. **analytics_snapshots schema split**
   - 20260220: `profile_id`, `platform`, `snapshot_date` (UNIQUE).
   - 20260225: same table extended with `owner_type`, `owner_id`, `window_days` for polymorphic (profile/org) and 30d window. x-sync and cron still write only `profile_id`, `platform`, `snapshot_date`. New rows may not have owner_type/owner_id set; publicData queries by owner_type/owner_id and may miss new snapshots.
   - **Action:** Unify: either have one writer path set both (profile_id + owner_type='profile', owner_id=profile_id) or have publicData fall back to profile_id for profiles.

7. **Ecosystem mapping tables have no RLS**
   - `org_relationships`, `org_ecosystem_categories`, `subscriptions`: no RLS policies found. Default is no RLS → full access for any role that can hit DB.
   - **Action:** Enable RLS and add policies (e.g. SELECT public where needed; INSERT/UPDATE/DELETE only for org admin or service role).

8. **professions INSERT policy is permissive**
   - `professions_insert_authenticated` allows any authenticated user to INSERT. Any user can create new profession rows.
   - **Action:** If acceptable for "user-added professions," keep but add rate limit or validation; otherwise restrict to certain roles or admin.

---

## 🟡 Security Vulnerabilities

1. **Client can set xscore** (see Critical #1) – trust-based; trivial to game.
2. **Review insert does not validate deal or reviewee** – when you add insert, enforce server-side: deal exists, deal completed, reviewer is party, reviewee is other party, one review per deal.
3. **conversations INSERT** – any authenticated user can create a conversation with arbitrary `participants` jsonb. They cannot send as another user (messages_insert_sender checks sender = auth.uid()), but they can create conversations that include others. Consider restricting to "caller must be in participants."
4. **applications** – no DELETE policy; applicants cannot withdraw via RLS. Add applications_delete_applicant if you want users to withdraw their own application.
5. **ethos_scores** – written by API (service role). No RLS on table; ensure only backend/API can write (no anon/authenticated policies = only service role in practice if RLS is enabled). Verify RLS is enabled and no policies grant write to anon/authenticated.
6. **CRON_SECRET** – if unset, cron routes return 401; document that cron must run with CRON_SECRET set in production.

---

## 🟣 Reputation Integrity Risks

1. **XScore user-editable** – primary integrity issue; see Critical #1.
2. **ETHOS** – from external API + cache; not user-editable. OK.
3. **twitter_username overwrite on OAuth** – see Critical #4; can confuse identity.
4. **Analytics snapshots** – written by cron/x-sync (and x-sync currently fails for snapshot due to RLS). No user-writable analytics; once RLS/insert is fixed, ensure only sync/cron write snapshots.
5. **Snapshots idempotency** – cron and x-sync use upsert on (profile_id, platform, snapshot_date) or (owner_type, owner_id, day). Duplicate runs overwrite same day; acceptable. Worker backfill is per-job; duplicate job runs could double-write window aggregates (upsert by unique key) – generally idempotent.
6. **Reputation deterministic** – only if inputs (xscore, ethos, reviews) are not user-spoofable. Currently xscore is not deterministic (user can change it).

---

## 🔵 Scalability Risks

1. **analytics_snapshots / x_daily_snapshots** – no partitioning. At 100k profiles × 90 days, row counts grow large; queries by profile/owner and date should use indexes (present). Plan partitioning by date or owner if growth exceeds single-table comfort.
2. **Worker processes one job at a time** – `run_analytics_jobs` takes one queued job, runs it, exits. Railway/cron must run it frequently enough to drain queue; at scale, consider multiple workers or batch processing.
3. **No rate limiting** – API routes (x-sync, ensure-backfill, ethos, xscore) have no rate limits. Add per-user or per-IP limits to avoid abuse and to respect third-party API quotas.
4. **me-stats and public entity** – multiple parallel Supabase calls per request; acceptable for now. Monitor latency; consider server-side aggregation or cached views for hot paths.

---

## 🟢 UX & Flow Inconsistencies

1. **Stub routes** – preferences, support, notifications, signOut render `StubPage` ("Coming soon" / "when auth is connected"). Either implement or remove from nav so nothing promises unimplemented features.
2. **Figma vs App Router** – Many flows live in `apps/web/src/figma/app/App.tsx` (client-side routing). Real routes under `app/` (e.g. `(public)/[username]`, `profile/edit`, `analytics`) delegate to `AppWithProviders` or thin wrappers. Ensure primary entry (e.g. `/` or `/dashboard`) and all linked actions use real backend and not mock data.
3. **Search** – GlobalSearch uses `MOCK_RESULTS`; no backend search. Either wire to Supabase full-text or search API or remove/gate search.
4. **VerificationCenterPage / VerificationInboxPage** – Mock data and TODO for accept/decline. Replace with real verification workflow or remove.
5. **DailyDropBanner, LandingPage** – Use mock profile cards. Replace with real featured profiles or remove.
6. **CreatorProfileDemo, BrandProfilePage, etc.** – Mix of mock and real; ensure public profile by username uses `publicData` and not hardcoded demo data.
7. **BillingPage, HostDashboard, LockedFeatureModal, EnhancedCalendarPage** – Explicit "placeholder" / "design only" billing and payment. Acceptable if monetization is later; remove or gate these from main nav until ready.
8. **WalletsSection** – "Connect wallet (coming soon)" – either implement or remove the CTA.
9. **YouTube/TikTok** – Multiple "Coming soon" for YouTube/TikTok analytics. Either remove from UI or implement; do not show as available.
10. **Sign out** – Stub says "Sign out will be available when auth is connected." If auth (e.g. Supabase + CDP) is connected, wire sign-out to auth.signOut() and remove stub.

---

## 🧱 Database Corrections Required

1. **analytics_snapshots**
   - Add RLS INSERT (and UPDATE if needed) for own profile: `(owner_type = 'profile' AND owner_id = auth.uid())` or, if table stays profile_id-only, `profile_id = auth.uid()`.
   - Unify schema: ensure one set of columns (either profile_id + snapshot_date or owner_type + owner_id + window_days) and that all writers and readers use the same shape.
2. **reviews**
   - Add CHECK or trigger: when `deal_id` is not null, require that deal exists and status = 'completed'.
   - Add UNIQUE(deal_id, reviewer_type, reviewer_profile_id) (and reviewer_org_id) to allow one review per deal per reviewer; or UNIQUE(deal_id) if exactly one review per deal total.
   - Optionally require deal_id NOT NULL for verified_deal = true.
3. **profiles**
   - Add UNIQUE on twitter_username (e.g. UNIQUE NULLS NOT DISTINCT or unique index on LOWER(twitter_username) WHERE twitter_username IS NOT NULL) after resolving duplicates.
4. **org_relationships, org_ecosystem_categories, subscriptions**
   - Enable RLS and add policies (read/write by org admin or service role as appropriate).

---

## 🔐 RLS Corrections Required

1. **analytics_snapshots** – INSERT (and UPDATE) for own profile/org as above.
2. **reviews** – When adding insert, enforce via CHECK/trigger that reviewer is party to deal and deal is completed; keep RLS as reviewer-only insert.
3. **applications** – Add DELETE for applicant: `applicant_type = 'profile' AND applicant_profile_id = auth.uid()` (and org member for org applicant).
4. **org_relationships, org_ecosystem_categories, subscriptions** – Add full RLS (enable + policies).
5. **ethos_scores** – Confirm RLS enabled and no write for anon/authenticated (service role only).

---

## 🧠 Architectural Weaknesses

1. **Dual schema for analytics** – Legacy profile_id + snapshot_date vs owner_type/owner_id/window_days. Consolidate and document one source of truth.
2. **No central feature/permission gate** – Monetization and "pro" features (e.g. subscriptions, tier) exist in schema and publicData tier; no single permission layer. When you add paywalls, centralize checks.
3. **Worker and cron both can write same data** – Daily cron (sync-x-profiles-daily) and worker (x_backfill_90d) both write profiles and snapshots. Cooldowns and job dedup reduce but do not eliminate overlap; ensure upserts are idempotent and keys are consistent.
4. **X sync uses user client for snapshot** – Fails under RLS; should use service client for snapshot write or add RLS (see Critical #3).

---

## 🚨 Exact Attack Scenarios (Step-by-Step Exploits)

1. **Reputation inflation**
   - Log in → Profile edit → Set XScore to 1000 → Save. Profile now shows maximum xscore and higher reputation index and social power in dashboard and public page.
2. **Fake reviews (when creation is added)**
   - Without deal enforcement: Create two accounts A and B. As A, insert review with reviewer_profile_id = A, reviewee_profile_id = B, rating = 5, verified_deal = true. RLS allows it (A is reviewer). No deal or completion check. B’s profile shows a fake 5-star.
3. **Impersonation / handle confusion**
   - User Alice has twitter_username "alice". Attacker connects OAuth with account that returns "alice" (or we overwrite): sync-session-x overwrites twitter_username. If usernames table and profile.username are also updated via claim_username_for_profile, Alice could lose handle or see wrong identity.
4. **Conversation spam**
   - Authenticated user creates many conversations with participants containing other users; no rate limit. Clutters list; consider rate limit and "caller in participants" check.

---

## 📊 Launch Readiness Score (0–100)

**Score: 42/100**

- **Breakdown:**  
  - Auth & profile (X connect, username claim): partially ready; sync-session-x overwrite and twitter_username uniqueness gaps.  
  - Analytics (X): backend and worker exist; x-sync snapshot write fails for users; schema split.  
  - Gigs/Jobs/Applications: DB and lib exist; UI may be partial; no review creation.  
  - Reviews: Read path only; no creation; no deal enforcement.  
  - Reputation: XScore user-editable → not launch-ready for trust.  
  - Case studies, professions, orgs: Structurally present; ecosystem/RLS and some UI gaps.  
  - UX: Stubs, mocks, and "coming soon" throughout; must be removed or implemented.

- **Verdict:** Do not onboard 500 real users until Critical items are fixed, reviews are deal-enforced and create path is implemented or hidden, and "coming soon" / placeholders are removed or replaced with real flows.

---

## 🛠 Exact Build Completion Roadmap (Prioritized)

### P0 – Blockers (before any real users)

1. Remove xscore from profile edit; source xscore only from API/cron or hide from product until then.
2. Fix analytics_snapshots: add RLS INSERT (and UPDATE) for own profile, or use service-role client in x-sync for snapshot upsert; align schema (profile_id vs owner_type/owner_id) so one writer/reader contract.
3. sync-session-x: do not overwrite non-empty twitter_username with OAuth handle; use candidate or conflict flow.
4. Add UNIQUE on profiles.twitter_username (or equivalent) and resolve any existing duplicates.
5. Remove or implement every "Coming soon" and stub route (sign out, preferences, support, notifications, connect wallet, YouTube/TikTok). Prefer: implement sign-out; remove or gate the rest until ready.

### P1 – Security & integrity

6. When adding review creation: enforce deal_id, deal completed, reviewer/reviewee are parties, one review per deal (DB + API). Add applications DELETE for applicant withdraw if desired.
7. Enable RLS on org_relationships, org_ecosystem_categories, subscriptions; add appropriate policies.
8. Optional: Restrict conversations INSERT so caller is in participants; add rate limiting to x-sync, ensure-backfill, and other public API routes.

### P2 – Completeness

9. Implement full review flow: deal creation from job/application → completion → bilateral review (UI + API + DB enforcement).
10. Replace all mock data in landing, search, verification, and profile demos with real data or remove features.
11. Unify analytics_snapshots schema and readers (publicData, api/analytics/x) to one model.
12. Document or implement "signals" as either stored or derived; ensure analytics dashboard uses real API only.

### P3 – Scale & polish

13. Rate limiting and monitoring for API and cron.
14. Plan partitioning or archiving for analytics tables at 10k+ profiles.
15. Central permission/feature gate for monetization and pro features.

---

*End of audit. Verify each finding against your current migrations and code; fix Critical and P0 before onboarding real users.*
