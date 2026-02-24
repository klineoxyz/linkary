# Linkary — Full Product Audit

**Date:** 2025-02-22  
**Scope:** Identity, Reputation, Influence Graph, Opportunity Layer, X Intelligence, Search & Discovery, Inbox/Notifications, Scoring & Anti-Gaming.  
**Method:** Codebase and schema inspection only. No refactors; no feature builds.

---

## SECTION 1: Identity Layer

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | X login as primary identity | ✅ Fully working | Supabase OAuth provider `x`. Login: `LoginPage.tsx`, `OnboardingPage.tsx` → `signInWithOAuth({ provider: 'x' })`. Callback: `apps/web/src/app/auth/callback/page.tsx` → `saveTwitterIdentityFromOAuth`, `ensureProfileForSession`, `sync-session-x`, optional `ensure-backfill`. Tables: `profiles` (twitter_username, twitter_user_id, twitter_connected_at, twitter_username_candidate). APIs: `api/auth/sync-session-x`, `api/auth/persist-social`, `lib/profiles.ts`. |
| 2 | Prevention of duplicate profiles per X handle | ✅ Fully working | Unique constraint: `supabase/migrations/20260231000001_twitter_username_unique.sql`. In `sync-session-x`, if another profile has same normalized handle, current profile gets `twitter_username_candidate` and response `twitterUsernameConflict`; no second profile gets the handle. |
| 3 | CDP wallet auto-creation on signup | 🟡 Partially implemented | Wallet is **not** created at signup. Created on first use when user visits Wallet and calls `POST /api/wallet/cdp/ensure` (e.g. from `WalletShell.tsx`). Tables: `cdp_wallets`, `profiles.cdp_wallet_address`. |
| 4 | Wallet stored securely (no private key in DB) | ✅ Fully working | Only `wallet_address` and recovery-related fields stored. No private key column in migrations or code. `supabase/migrations/20260246000000_cdp_wallets_table.sql`, `apps/web/src/lib/wallet-cdp-status.ts`. |
| 5 | Profile editing (skills, roles, bio, etc) | ✅ Fully working | Fields: display_name, email, bio, website, location, published; header media (`profile_media`); social URLs (`profile_socials`); professions/roles via `profile_professions` + `professions`. No separate "skills" table; roles = professions. APIs: `updateMyProfile` in `lib/profiles.ts`; `getProfileProfessions` / `setProfileProfessions` in `lib/profileProfessions.ts`. UI: `ProfileEditPage.tsx`, `RolesSkillsPage.tsx`. |
| 6 | Case studies CRUD | ✅ Fully working | Table: `case_studies` (owner_type, owner_profile_id | owner_org_id, title, description, proof_url, metrics). API: `PATCH/GET api/case-studies/[id]`. UI: ProfileEditPage (modal + list), OrgDetailPage "Case Studies" tab, PublicOnePager, `CaseStudyCard.tsx`. `lib/caseStudies.ts`. |
| 7 | PDF upload (CV) | 🔴 Not implemented | No table, API, or UI. Docs (e.g. `PLATFORM_AUDIT_V1.md`, `FEATURE_MATRIX_V1.md`) state CV upload is missing/deferred. |
| 8 | Public 1 pager route | ✅ Fully working | Route: `/[username]` (and by slug/UUID/wallet). Page: `apps/web/src/app/(public)/[username]/page.tsx`; optional `?view=brochure`. Component: `PublicOnePager.tsx`, `PublicOnePagerWrapper.tsx`. |
| 9 | Privacy control for analytics visibility | ✅ Fully working | Column: `profiles.analytics_visibility` ('public' \| 'private'). Migration: `20260234000000_public_views_privacy.sql`. UI: PrivacyDataPage "Public analytics" toggle → `updateMyProfile(..., { analytics_visibility })`. |
| 10 | Individual vs Company onboarding logic | ✅ Fully working | `profiles.account_type` ('individual' \| 'company'). Set via `POST /api/onboarding/set-account-type`. Company required for org creation (RPC/API gate). OnboardingPage.tsx step 2; redirect when `!profile?.onboarding_completed_at` in App.tsx. |
| 11 | Admin assignment for company accounts | ✅ Fully working | Table: `org_members` (org_id, user_id, role: owner \| admin \| member). Trigger: `org_members_ensure_last_owner`. APIs: `GET/POST api/orgs/[orgId]/members`, `PATCH/DELETE api/orgs/[orgId]/members/[userId]`, `POST api/orgs/[orgId]/transfer-owner`, `POST api/orgs/[orgId]/members/invite`. UI: OrgDetailPage Members tab (role change, transfer ownership). |

---

## SECTION 2: Reputation Engine

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | X analytics ingestion pipeline | ✅ Fully working | Workers: `apps/worker/src/lib/ingestXTweets.ts`, `sync_x_tweets_weekly.ts`, `jobs/xBackfill90d.ts`. twitterapi.io via `apps/worker/src/lib/twitterapi.ts`. Tables: `x_tweets` (upsert), `x_daily_snapshots`, `x_window_aggregates`, `analytics_jobs`. Retweets excluded in ingest and rollups. |
| 2 | Snapshot storage | ✅ Fully working | `x_daily_snapshots` (per profile/day). Written by daily cron, x-sync route, and xBackfill90d. Also legacy `analytics_snapshots` in some migrations. |
| 3 | Rollup calculations | ✅ Fully working | `x_analytics_rollups`, `x_top_drivers`. Filled by `apps/worker/src/lib/refreshXRollups.ts` from `x_tweets`. Engagement uses like_count + reply_count + repost_count (quote_count excluded). |
| 4 | Outlier protection | 🟡 Partially implemented | In `api/analytics/x/route.ts`: `diagnostics.has_outlier_day` when a single day exceeds LIKES_OUTLIER (2000) or REPOSTS_OUTLIER (500). UI: outlier warning banner and dev-only diagnostics panel. No automatic suppression or score adjustment. |
| 5 | Social score calculation | ✅ Fully working | Single composite "Linkary" score. `apps/web/src/lib/linkaryScore.ts`: `computeLinkaryPower` (individual 0–1000), `computeLinkaryInfluence` (org). Weights: Ethos, XScore, reviews, engagement, follower authority, verified gigs, case impact. No separate "social score" table; `profiles.xscore`, `orgs.xscore`, `ethos_scores` cache. |
| 6 | Collaboration score calculation | 🟡 Partially implemented | Collaboration is folded into Linkary Power (reviews, verified gigs). No dedicated "collaboration score" table or named metric. |
| 7 | Influence multiplier calculation | 🟡 Partially implemented | `computeLinkaryInfluence` for orgs; no separate "influence multiplier" table or named field. |
| 8 | Reviews system | ✅ Fully working | Table: `reviews` (deal_id, reviewer_type, reviewer_profile_id \| reviewer_org_id, reviewee_*, rating, body, title, verified_deal). One review per deal per reviewer. Trigger: deal must be completed and parties valid. API: `POST /api/reviews`. UI: DealDetailPage, PublicOnePager, me-stats. |
| 9 | Verified gig linkage to score | 🟡 Partially implemented | `computeLinkaryPower` includes `verifiedGigsScore(verifiedGigsCount)` (10% weight). `GET /api/profile/me-stats` does **not** pass `verifiedGigsCount` (or `caseStudyDeltas`) to `computeLinkaryPower`, so verified gigs do not currently affect the returned score. Formula exists; data not wired. |

---

## SECTION 3: Influence Graph

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | Connections between individuals | ✅ Fully working | Table: `connections` (requester_profile_id, recipient_profile_id, status: pending \| accepted \| declined \| blocked). Migration: `20260249000000_connections_and_org_follows.sql`. APIs: `GET /api/connections/list`, `GET /api/connections/status`, `POST /api/connections/request`, `POST /api/connections/respond`, `POST /api/connections/cancel`. UI: ViewerActionsBar (connect/accept/decline on public profile). |
| 2 | Ambassador relationships | ✅ Fully working | Via `partner_programs` (program_type 'ambassador') and `org_ambassadors` (org_id, profile_id, status: invited \| active \| removed). Max 10 orgs per profile (trigger). APIs: `GET/POST /api/partners`, `PATCH/DELETE /api/partners/[id]`. UI: ProfileEditPage (Partners), OrgDetailPage (Ambassadors tab), invite by handle. |
| 3 | Affiliate relationships | ✅ Fully working | Via `partner_programs` (program_type 'affiliate') and `org_affiliations` (org_id, profile_id, status; max 1 org per profile). Same APIs and OrgDetailPage (Affiliates). |
| 4 | Supporter relationships | 🔴 Not implemented | No "supporters" table or concept in codebase. |
| 5 | Subsidiaries for orgs | ✅ Fully working | Table: `org_relationships` (rel_type = 'SUBSIDIARY', parent_org_id, child_org_id). Used in `publicData.ts` for org public entity (subsidiary list). |
| 6 | Influence roll-up logic | 🔴 Not implemented | No graph traversal or recursive roll-up from connections/affiliates/subsidiaries. Linkary Power/Influence computed from profile/org + reviews + X + deals in `linkaryScore.ts`, not from connection/subsidiary graph. |

---

## SECTION 4: Opportunity Layer

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | Gigs (Campaigns) | ✅ Fully working | Implemented as `jobs` table (org_id, type, title, budget, duration, tags, status). Type: 'job' \| 'sprint'. No separate "gigs" or "campaigns" table. APIs: `GET/POST /api/orgs/[orgId]/jobs`, `GET/PATCH/DELETE /api/orgs/[orgId]/jobs/[jobId]`. |
| 2 | Sprint types | ✅ Fully working | `jobs.type = 'sprint'` vs 'job'. Create job UI: type selector in OrgDetailPage. |
| 3 | Job postings | ✅ Fully working | Same `jobs` table; list via `listJobs()` in `lib/jobs.ts` and org jobs API. |
| 4 | Application system | ✅ Fully working | Table: `applications` (job_id, applicant_profile_id \| applicant_org_id, status, message). RLS: applicant or job org admin. Status: pending, accepted, rejected, withdrawn. APIs: accept via `POST /api/applications/[id]/accept` (creates deal, sets application status accepted, job status accepted). |
| 5 | Auto-sharing of analytics on apply | 🔴 Not implemented | PrivacyDataPage has "Share analytics when applying to opportunities" toggle; it is **local state only** (toggleAnalyticsSetting for shareOnApplications only updates React state). No DB column, no API persistence, no apply-time sharing of analytics. |
| 6 | Invite system | 🟡 Partially implemented | Org members: `POST /api/orgs/[orgId]/members/invite`. Affiliate/ambassador: `inviteAffiliateByHandle`, `inviteAmbassadorByHandle` in `lib/orgs.ts`. No generic "campaign invite" or "gig invite" table. |
| 7 | Status workflow (applied, accepted, completed) | ✅ Fully working | Applications: pending → accepted (via accept API). Deals: active → creator sets delivered_at → org sets accepted_at → trigger sets completed_at and status = 'completed'. Job status: open \| accepted \| completed \| paid. APIs: `api/deals/[id]/mark-delivered`, `api/deals/[id]/mark-accepted`. Trigger: `deals_set_completed` in `20260232000000_reviews_deal_enforcement.sql`. |

---

## SECTION 5: X Intelligence

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | XSpaces tab | 🟡 Partially implemented | No real X Spaces API. HostDashboard and DashboardPage use demo/local arrays for "X Space" events. PublicOnePager can show `spaces_count` from analytics when present; worker does not populate spaces. No dedicated XSpaces tab backed by real Space API. |
| 2 | Space scheduling logic | 🔴 Not implemented | Not found. HostDashboard/EnhancedCalendarPage are design/placeholder only. |
| 3 | Overlap detection | 🔴 Not implemented | Not found. |
| 4 | Engagement driver insights | ✅ Fully working | "Top drivers" from `x_top_drivers` (refreshXRollups), shown in AnalyticsPage (engagement rate, link to tweet). |
| 5 | Circle analytics | 🔴 Not implemented | CirclesOverviewPage, CircleDetailPage, KOLListsPage use demo/local data; no backend "circle analytics" or circle-scoped metrics. |

---

## SECTION 6: Search & Discovery

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | Global search | ✅ Fully working | `GET /api/search?q=...&filter=all|people|projects|agencies`. Queries `public_profile_view` and `public_org_view`; ranked (starts-with then contains). UI: GlobalSearch in App (topbar), debounce (min 2 chars). No dedicated /search page. |
| 2 | Filter by skills | 🔴 Not implemented | Search API has only `filter=all|people|projects|agencies`. No skills filter. |
| 3 | Filter by follower range | 🔴 Not implemented | Not in search API. |
| 4 | Filter by engagement | 🔴 Not implemented | Not in search API. |
| 5 | Filter by ecosystem | 🔴 Not implemented | Not in search API. Explore in App uses local/demo lists and minEthos/minXscore in UI; not applied to `/api/search`. |
| 6 | Public profile indexability | 🟡 Partially implemented | Public profile page sets `robots: published ? undefined : { index: false, follow: false }` in `(public)/[username]/page.tsx`. SEO component: `SEO.tsx`. No sitemap or sitemap.xml/robots.txt in repo. |

---

## SECTION 7: Inbox / Notifications

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | Connection requests | ✅ Fully working | Via `connections` table (status pending/accepted/declined). List: `GET /api/connections/list`. UI: ViewerActionsBar, connections list in App. |
| 2 | Campaign invites | 🔴 Not implemented | No campaign-specific invite table or flow. |
| 3 | Ambassador invites | ✅ Fully working | Org invites via `inviteAmbassadorByHandle`; status in `org_ambassadors`. OrgDetailPage "Invite Ambassador". |
| 4 | Affiliate proposals | ✅ Fully working | Org invites via `inviteAffiliateByHandle`; status in `org_affiliations`. OrgDetailPage "Invite Affiliate". |
| 5 | Speaker requests | 🔴 Not implemented | No `speaker_requests` table or API. HostDashboard "Speaker Requests" tab and EnhancedCalendarPage use demo/placeholder data only. |
| 6 | Notification system (real-time or polling) | 🔴 Not implemented | No `notifications` table. No notification service or polling. Supabase realtime in lockfile only; no notification subscription in app. "notifications" in reserved paths; docs say removed from nav/stub. |

---

## SECTION 8: Scoring & Anti-Gaming

| # | Item | Status | Details |
|---|------|--------|--------|
| 1 | Engagement anomaly detection | 🟡 Partially implemented | X analytics: `has_outlier_day` when a single day exceeds like/repost thresholds in `api/analytics/x/route.ts`. Used for warning and dev diagnostics only; no automatic suppression or anomaly pipeline. |
| 2 | Fake spike detection | 🔴 Not implemented | No dedicated fake-spike or anomaly detection beyond the single-day outlier flag. |
| 3 | Clean account badge | 🔴 Not implemented | Not found in codebase. |
| 4 | Suspicious activity logs | 🔴 Not implemented | No table or feature found. |

---

## FULLY IMPLEMENTED (summary)

- **Identity:** X login as primary identity, duplicate profile prevention per X handle, wallet storage (no private key), profile editing (bio, roles via professions), case studies CRUD, public 1-pager route, analytics privacy toggle, individual/company onboarding, org admin assignment.
- **Reputation:** X analytics ingestion, snapshot storage, rollup calculations, Linkary score (Power/Influence), reviews system.
- **Influence:** Connections (individual), ambassadors (partner_programs + org_ambassadors), affiliates (org_affiliations), org subsidiaries (org_relationships).
- **Opportunity:** Jobs (gigs/sprints), job postings, applications, deal workflow (applied → accepted → delivered → completed).
- **Search:** Global search (people/projects/agencies).
- **Inbox:** Connection requests, ambassador/affiliate invites (org-level).

**Files (key):**  
Auth: `auth/callback/page.tsx`, `api/auth/sync-session-x`, `api/auth/persist-social`, `lib/profiles.ts`, `LoginPage.tsx`, `OnboardingPage.tsx`.  
Profiles: `ProfileEditPage.tsx`, `RolesSkillsPage.tsx`, `lib/profileProfessions.ts`.  
Case studies: `api/case-studies/[id]`, `lib/caseStudies.ts`, `PublicOnePager.tsx`, `CaseStudyCard.tsx`.  
Public: `(public)/[username]/page.tsx`, `PublicOnePagerWrapper.tsx`.  
Privacy: `PrivacyDataPage.tsx`, `20260234000000_public_views_privacy.sql`.  
Org/admin: `api/orgs/[orgId]/members/*`, `api/orgs/[orgId]/transfer-owner`, `OrgDetailPage.tsx`.  
Analytics: `worker/lib/ingestXTweets.ts`, `worker/lib/refreshXRollups.ts`, `worker/sync_x_tweets_weekly.ts`, `worker/jobs/xBackfill90d.ts`, `api/analytics/x`, `AnalyticsPage.tsx`.  
Scores: `lib/linkaryScore.ts`, `api/profile/me-stats`, `api/ethos/score`, `api/xscore/score`.  
Reviews: `api/reviews`, `reviews` table, `DealDetailPage.tsx`.  
Connections: `api/connections/*`, `connections` table, `ViewerActionsBar.tsx`.  
Partners: `api/partners/*`, `partner_programs`, `org_affiliations`, `org_ambassadors`.  
Jobs: `api/orgs/[orgId]/jobs/*`, `jobs`, `applications`, `deals`, `lib/jobs.ts`.  
Search: `api/search`, `GlobalSearch.tsx`.

---

## PARTIALLY IMPLEMENTED (summary)

- **CDP wallet on signup:** Creation on first use (Wallet page), not at signup.
- **Outlier protection:** `has_outlier_day` and dev diagnostics only; no automatic score suppression.
- **Social/collaboration/influence:** All folded into Linkary Power/Influence; no separate tables or named metrics.
- **Verified gig → score:** Formula in `linkaryScore.ts`; `me-stats` does not pass `verifiedGigsCount` (or caseStudyDeltas).
- **Share analytics on apply:** Toggle exists in PrivacyDataPage; state is local only, not persisted, not used on apply.
- **Invite system:** Org and affiliate/ambassador invites only; no campaign/gig invites.
- **XSpaces:** UI placeholders + optional `spaces_count` on 1-pager; no real X Spaces API.
- **Engagement drivers:** Top drivers from `x_top_drivers` implemented; no "circle analytics."
- **Search filters:** Only type (people/projects/agencies); no skills, follower range, engagement, ecosystem.
- **Public indexability:** robots per page; no sitemap.
- **Anomaly/outlier:** Single-day outlier flag only; no full anomaly/fake-spike pipeline.

---

## NOT IMPLEMENTED (summary)

- **Identity:** PDF upload (CV) — no table, API, or UI.
- **Influence:** Supporters (no table/concept); influence roll-up from graph (no traversal/aggregation).
- **Opportunity:** Auto-sharing of analytics on apply (no persistence or apply-time behavior).
- **X Intelligence:** Space scheduling, overlap detection, circle analytics (backend).
- **Search:** Filters by skills, follower range, engagement, ecosystem.
- **Inbox:** Campaign invites, speaker requests (backend), notification system (no notifications table or realtime/polling).
- **Anti-gaming:** Fake spike detection, clean account badge, suspicious activity logs.

---

## SCHEMA-ONLY / UI-ONLY

- **Schema only:** `spaces_count` (or similar) in analytics snapshot/aggregates — worker does not populate; UI can show if present.
- **UI only:** "Share analytics when applying to opportunities" and "Allow verified case study analytics" toggles in PrivacyDataPage — no DB columns; shareOnApplications/caseStudyAnalytics only in React state.  
- **UI only:** XSpaces/Speaker requests in HostDashboard/EnhancedCalendarPage — demo/placeholder data.  
- **UI only:** Circle analytics (CirclesOverviewPage, etc.) — demo/local data.

---

## ARCHITECTURAL RISKS

1. **Service role usage:** Many API routes use `SUPABASE_SERVICE_ROLE_KEY` (sync-session-x, persist-social, ensure-backfill, x-sync, analytics rebuild/job, readiness, xscore, profile-owner, partners, orgs, wallet/cdp/ensure, admin, debug). Must ensure auth is validated before using service client and that owner_id/profile_id is never taken from client.
2. **Payload consistency:** `analytics_jobs.payload` standardized to include `profile_id`; drainer uses `owner_id` as source of truth. Inconsistent payloads in legacy enqueue paths could cause wrong profile processing.
3. **Verified gig → score:** Score formula expects `verifiedGigsCount`; me-stats does not supply it, so verified gigs do not affect displayed score (data integrity gap).
4. **Share-on-apply:** Toggle exists in UI but has no persistence or apply-time behavior; users may expect it to work.
5. **No notifications table:** Inbox/notifications cannot be built without schema and backend.
6. **Influence roll-up:** No graph-based roll-up; org/personal influence is not derived from connections/subsidiaries.

---

## TECH DEBT

1. **Duplicate / scattered enqueue logic:** Multiple places enqueue `x_backfill_90d`: ensure-backfill, backfill-90, x-sync, persist-social, sync-session-x, rebuild, force rebuild. Payload (profile_id) standardized but code paths are many; ensure all set `payload.profile_id`.
2. **Hardcoded constants:** LIKES_OUTLIER = 2000, REPOSTS_OUTLIER = 500 in `api/analytics/x/route.ts`; no env or config.
3. **Missing validation:** Some API routes assume valid UUIDs or existing FKs; not all validate before DB calls.
4. **Missing indexes:** Not fully audited; high-traffic queries (e.g. analytics_jobs by status, x_tweets by profile_id + day) should be checked.
5. **PrivacyDataPage toggles:** `shareOnApplications` and `caseStudyAnalytics` only update local state; no persistence. Either add columns and wire save or remove/relabel to avoid confusion.
6. **Feature flags:** Only mentioned in docs (NO_MOCK_DATA_POLICY, LAUNCH_READINESS_AUDIT); no feature-flag system in code.

---

## MIGRATIONS REFERENCE (tables)

- **Core:** profiles, usernames, orgs, org_members, org_affiliations, org_ambassadors, org_metrics, org_relationships, org_ecosystem_categories.  
- **Identity/social:** social_accounts, profile_socials, profile_media, org_media, wallet_identities, cdp_wallets, cdp_recovery_enrollment_state, external_wallets, wallet_handles.  
- **Marketplace:** jobs, applications, deals, reviews, case_studies, conversations, messages.  
- **Analytics:** x_tweets, x_daily_snapshots, x_window_aggregates, x_analytics_rollups, x_top_drivers, analytics_snapshots, analytics_jobs, profile_analytics_baseline, ethos_scores.  
- **Other:** connections, org_follows, partner_programs, professions, profile_professions, rate_limits, superadmin_emails, subscriptions.

---

*End of audit. All claims trace to files, tables, or migrations listed above.*
