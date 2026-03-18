# Linkary Platform Audit — A to Z (Production Readiness)

**Scope:** Full platform audit. No feature building, no refactors, no schema guessing. Only real code, schema, routes, migrations, workers, and APIs were inspected.

**Post-audit:** Pre-launch fix pack (A–D) applied — see **docs/PRE_LAUNCH_FIXES.md** (verified gigs in me-stats, invite notifications, OAuth redirect allowlist, analytics init error visibility).

---

## SECTION 1 — Identity & Auth

### 1) Login flow

- **X OAuth as single source of identity:** Confirmed. All login entry points use `signInWithOAuth({ provider: "x" })` (LoginPage, OnboardingPage, IntegrationsPage, OrgDetailPage connect-X, LinkProfilePanel). No `signInWithPassword` or `signUp` found in `apps/web/src`.
- **No alternate login bypass:** Confirmed. Auth callback (`apps/web/src/app/auth/callback/page.tsx`) only processes `code` from OAuth or existing session; session is established via `exchangeCodeForSession(code)` or `getSession()`. No email/password or magic-link path.
- **Duplicate profile prevention:** Confirmed. Unique index `unique_twitter_username` on `profiles (LOWER(TRIM(twitter_username)))` (migration `20260231000001_twitter_username_unique.sql`). `saveTwitterIdentityFromOAuth` updates profile then calls `claimUsernameForProfile` RPC; RPC enforces uniqueness and returns `USERNAME_TAKEN_VERIFIED` when handle is taken.
- **twitter_user_id stored and used:** Confirmed. Set in `saveTwitterIdentityFromOAuth` (`twitter_user_id: identity.id ?? identity.sub`). Trigger `profiles_set_x_connected` keeps `x_connected` in sync with `twitter_username`/`twitter_user_id` (migration `20260237000000_profiles_x_connection_truth.sql`). Used in analytics/social lookups (e.g. `twitter_user_id` in backfill/sync flows).

**Inconsistencies / gaps**

- Callback when **no code** (e.g. direct visit): uses `getSession()` and still runs `ensureProfileForSession`, `saveTwitterIdentityFromOAuth`, `persist-social`, `ensure-social-x`, `ensure-backfill`. That’s correct for “already logged in” but relies on client having a valid session; no inconsistency.
- **Validation:** Redirect URL for OAuth uses `NEXT_PUBLIC_SITE_URL` (or origin). Docs note wrong redirect risk if env is misconfigured; no server-side allowlist of redirect hosts in code.

### 2) Wallet

- **CDP wallet creation flow:** Confirmed. `GET/POST /api/wallet/cdp/ensure`: GET returns existing `cdp_wallet_address` from profile or `{ needsCreate: true }`. POST accepts client-provided `address` (client creates wallet via CDP SDK first), validates EVM format, checks no other profile has same address (via service client), then updates `profiles` and `cdp_wallets`. No server-side wallet creation; client creates, server persists.
- **No private keys in DB:** Confirmed. Only `cdp_wallet_address`, `cdp_wallet_chain`, `cdp_wallet_type`, `cdp_wallet_created_at`, `cdp_mfa_enabled` (and `cdp_wallets` table) are used; no key material stored.
- **Service role in wallet routes:** `POST /api/wallet/cdp/ensure` uses service client only after auth: `getUser(token)` first; service used to query other profiles’ `cdp_wallet_address` to enforce one-address-per-profile. Safe.

### 3) Onboarding

- **account_type logic:** Confirmed. `profiles.account_type` (`individual` | `company`) set via `POST /api/onboarding/set-account-type`. Migration `20260244000000_profiles_account_type.sql`; RPC `create_org_and_membership` checks `account_type = 'company'` (migration `20260247000000_phase1_org_gate_and_analytics_initialized.sql`).
- **Org creation gating:** Confirmed. `POST /api/orgs/create` reads `account_type` for `user.id`; if not `company`, returns 403 `ORG_COMPANY_REQUIRED`. RPC also enforces in DB.
- **onboarding_completed_at:** Set in OnboardingPage (claim username + set account type flows). post-login-bootstrap inserts profile with `onboarding_completed_at: null`. Redirect when `!profile?.onboarding_completed_at` is in figma App.tsx; main app router uses layout/pages that redirect to onboarding where appropriate (per docs).

**Bypass paths**

- None identified. Org creation requires both API check and RPC check.

---

## SECTION 2 — Reputation Engine

### 1) X ingestion pipeline

- **ingestXTweets, refreshXRollups, xBackfill90d, jobs:** Confirmed. Worker: `sync_x_tweets_weekly.ts` (ingestXTweets + refreshXRollupsForProfile). Jobs: `xBackfill90d.ts` (ingestXTweets then daily aggregates + window aggregates). Cron routes: `backfill-x-90d-batch`, `sync-x-tweets-weekly`, `x-analytics-daily`; ensure-backfill enqueues analytics_jobs.
- **Outlier suppression:** Applied in ingestXTweets (skips tweets that are outliers vs `followers_total`), in refreshXRollupsForProfile (filters `!isOutlierTweet`), and in xBackfill90d (same). API analytics/x exposes `has_outlier_day` for diagnostics; no automatic score suppression in formula.
- **Retweets excluded:** Confirmed. ingestXTweets skips `isRetweetText` (text starts with `RT @`). refreshXRollups filters `!isRetweetText(t.text)`. xBackfill90d loop skips `isRetweetText(t.text)`. Doc `X_ANALYTICS_RETWEETS_CLEANUP.md` and script `cleanup_x_tweets_retweets.sql` for one-time cleanup.

### 2) Analytics data integrity

- **Rollups, snapshots, window aggregates:** x_analytics_rollups from refreshXRollups; x_daily_snapshots and x_window_aggregates from xBackfill90d. API `/api/analytics/x` reads rollups, baseline, top drivers; init-status and job status used for 90d state.
- **7D/30D/90D:** Rollups use WINDOWS [7, 30, 90]; API serves same rollup data for time ranges.
- **Mock/demo data:** Figma app (LandingPage, App.tsx, etc.) uses demo objects; main app and API use DB (profiles, rollups, snapshots). No mock feeding production analytics API.

### 3) Scores

- **computeLinkaryPower / computeLinkaryInfluence:** Inputs defined in `linkaryScore.ts` (Ethos, XScore, followers, engagement, reviews, verifiedGigsCount, caseStudyDeltas, etc.). Used by me-stats, publicData, refreshOrgInfluence.
- **Verified gigs count:** Formula in linkaryScore (`verifiedGigsScore`). **Gap:** `GET /api/profile/me-stats` does **not** pass `verifiedGigsCount` (or `caseStudyDeltas`) to `computeLinkaryPower`, so verified gigs do not currently affect the returned score (per existing docs).
- **Ethos/XScore cache:** `ethos_scores` and `xscore_scores` tables; `refreshScores.ts` reads/writes cache and live Ethos API; XScore has no external API in repo, uses `profiles.xscore` and xscore_scores. refresh-scores API and post-login refresh trigger cache update.
- **Double-weighting / missing weight:** Weights are defined once in linkaryScore; no double-weighting found. Missing: verifiedGigsCount/caseStudyDeltas not wired in me-stats.

**Output**

- **Metric inconsistency:** Verified gigs and case study impact not applied in me-stats score.
- **Stale-cache risk:** Ethos/XScore cached with TTL/updated_at; refresh-scores and post-login refresh mitigate; no short TTL enforcement on read.

---

## SECTION 3 — Influence Graph

### 1) Connections

- **Mutual follow attestation:** Request requires `requester_follow_attested: true`; accept requires `recipient_followback_attested: true` (API validation in connections/request and connections/respond). Attestation is client-side checkbox; no API verification of actual X follow state.
- **RLS:** connections: SELECT if requester or recipient; INSERT only as requester (`requester_profile_id = auth.uid()`); UPDATE as requester or recipient. Prevents arbitrary acceptance by non-recipient.
- **Notifications:** connection_request on request; connection_accepted on accept (to requester).

### 2) Supporters

- **org_supporters RLS:** INSERT/DELETE only for own `profile_id`; SELECT public. All supporters are visible; no filter by profile visibility.
- **Private profiles in rollup:** Influence rollup (`refreshOrgInfluenceRollup`) counts all org_supporters for the org; it does **not** exclude private (unpublished) profiles. If product intent is “private profiles not counted,” that is not implemented.
- **Influence refresh:** enqueueInfluenceRefresh called after org create, supporter/ambassador/affiliate changes (e.g. orgs/create, support/unsupport, ambassadors/affiliates PATCH).

### 3) Rollups

- **Recursive subsidiary:** refreshOrgInfluenceRollup walks `parent_org_id` with `MAX_SUBSIDIARY_DEPTH = 5` and a `seen` set to avoid cycles. Child orgs loaded by `in("parent_org_id", childIds)`; subsidiary influence summed from org_influence_rollups.
- **Weights:** computeLinkaryInfluence uses verifiedReviewsCount, activeAmbassadorsCount, activeAffiliatesCount, supportersCount, subsidiariesInfluence; weights in linkaryScore.
- **Manipulation:** Rollup is recomputed from DB state; no user-editable “influence” field. Adding supporters/ambassadors/affiliates requires legitimate actions (support, invite/accept).

**Output**

- **Abuse:** Attestation is honor-based; no proof of X follow.
- **Performance:** Single recursive walk per org with bounded depth; one rollup upsert per refresh.
- **Missing:** Notification when ambassador/affiliate **invite** is sent (types `ambassador_invite` / `affiliate_invite` exist but no createNotification call on invite; only accept/remove notify). Supporters count includes all profiles; no “private not counted” in rollup.

---

## SECTION 4 — Jobs / Deals / Reviews

### 1) Jobs

- **Org-only creation:** Jobs created in org context; API and RLS restrict job creation to org admins/owners.
- **Application flow:** POST apply uses `user.id` from auth; applicant_profile_id = user.id. Job fetched via service; duplicate prevention (one pending/accepted per job per applicant) in DB. Cannot spoof another profile.
- **share_analytics_on_apply:** Profile’s `share_analytics_on_apply` and `share_cv_on_apply` read from DB in apply route; analytics snapshot and cv_file_path attached when true.

### 2) Deals

- **Lifecycle:** Deals have status (e.g. active/completed); `delivered_at`, `accepted_at`, `completed_at`. Trigger `deals_set_completed` sets `completed_at` and `status = 'completed'` when both delivered_at and accepted_at set (migration `20260232000000_reviews_deal_enforcement.sql`). mark-delivered and mark-accepted API routes update accordingly.
- **Review enforcement:** Trigger `reviews_check_deal_and_parties` rejects review insert unless deal status = completed and reviewer/reviewee are parties and not self.

### 3) CV

- **profile_documents RLS:** SELECT/INSERT/UPDATE/DELETE only where `profile_id = auth.uid()`.
- **CV download:** GET `/api/applications/[id]/cv-download` requires application.shared_cv and application.cv_file_path; verifies caller is org owner/admin for job’s org_id; returns signed URL via service storage (60s). No raw file_path or storage URL returned to client.
- **No storage URL leak:** cv-download returns only `{ url: signed.signedUrl }`; SignedMediaImage and isPrivateStorageUrl used for file_path display elsewhere.

**Output**

- No permission bypass or state machine flaw identified. Deal lifecycle and review trigger are consistent.

---

## SECTION 5 — Notifications

### 1) Coverage of major actions

| Action                    | Notification type              | Implemented |
|---------------------------|---------------------------------|-------------|
| Connection request        | connection_request             | Yes (connections/request) |
| Connection accepted       | connection_accepted            | Yes (connections/respond) |
| Application submitted     | application_submitted         | Yes (jobs/apply) |
| Application accepted      | application_accepted          | Yes (applications/accept) |
| Application rejected      | application_rejected          | Yes (applications/reject) |
| Deal delivered            | deal_delivered                | Yes (deals/mark-delivered) |
| Deal accepted/completed   | deal_accepted, deal_completed | Yes (deals/mark-accepted) |
| Ambassador accepted       | ambassador_invite_accepted   | Yes (ambassadors/[id]) |
| Ambassador removed        | ambassador_removed            | Yes |
| Affiliate accepted/removed| affiliate_invite_accepted, affiliate_removed | Yes (affiliates/[id]) |
| Speaker request           | speaker_request_created       | Yes (spaces/[id]/speaker-request) |
| Speaker approved/rejected | speaker_request_approved/rejected | Yes (speaker-requests/[id]/respond) |
| Ambassador invite (to invitee) | ambassador_invite        | **No** – type exists, no createNotification on invite |
| Affiliate invite (to invitee)   | affiliate_invite         | **No** – type exists, no createNotification on invite |

### 2) Duplicates

- Each action calls createNotification once with a specific type and entity_id; no duplicate creation observed in the same handler.

### 3) Pagination and mark-read

- GET `/api/notifications`: cursor-based (created_at), limit 1–50; returns nextCursor and unreadCount. unreadCount is a separate count query (two round-trips per page).
- mark-read: updates by ids; recipient_profile_id = user.id enforced.

### 4) N+1

- List endpoint: one query for page, one for count; no per-notification N+1.

**Output**

- **Missing:** Notifications to invitee when ambassador or affiliate invite is sent (invite creation path does not call createNotification for ambassador_invite / affiliate_invite).

---

## SECTION 6 — Media & Storage

- **file_path → signed URLs:** Private storage paths are resolved via GET `/api/media/signed-url?path=...` (auth required). Signed URL 60s; Cache-Control and Pragma no-cache. resolveEntityMediaUrls (server) uses createSignedUrlForPath; client uses SignedMediaImage which calls signed-url API.
- **No direct Supabase private URLs in client:** isPrivateStorageUrl used to avoid rendering private URLs; SignedMediaImage never uses raw file_path as img src; fallback placeholder on fetch failure.
- **Expiration:** 60s in signed-url and cv-download; SignedMediaImage cache 45s TTL, refresh when &lt;10s remaining.
- **Fallback:** SignedMediaImage shows placeholder on error after retry; no raw storage URL exposed.

**Output**

- No leak path identified. Edge case: if a legacy `logo_url`/`header_media_url` is a storage URL and isPrivateStorageUrl is not used in every render path, it could be rendered; current call sites (LandingPage, OrgDetailPage, DashboardPage, ProfileEditPage, PublicOnePager) use isPrivateStorageUrl or SignedMediaImage for file_path.

---

## SECTION 7 — Routing & App State

- **Main app:** Next.js App Router; middleware only normalizes `/@username` → `/{username}` (no auth redirect in middleware). Protected vs public is per-route (layout/pages and API auth).
- **ALLOWED_ROUTES / routeFromPathname / pathFromRoute:** Present in **figma** `App.tsx` for the **/app/*** shell. Routes not in the set redirect to Overview (historically caused broken deep links). **Include** `profileDeals`, `profileApplications`, `analyticsProfile` for in-shell deals, applications, and cross-user analytics. Standalone pages under `/profile/*` are separate Next routes.
- **Public routes:** e.g. `/[username]`, `/login`, `/auth/callback`. Protected routes require session (client/server checks).
- **Symmetry:** In figma, pathFromRoute and routeFromPathname are aligned; main app does not use the same route enum.

**Output**

- **Deep link:** Main app deep links by URL path; no central allowlist. Risk is low if all intended routes have pages. Figma app is separate (demo); its ALLOWED_ROUTES does not affect main app.

---

## SECTION 8 — Security & Service Role

### Routes using SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY)

- notifications.ts (createNotification)
- debug/x-connection, integrations/x/claim, analytics/ensure-backfill
- auth/sync-session-x, auth/persist-social
- deals/[id]/mark-delivered
- refreshOrgInfluence, x-analytics-server
- orgs/[orgId]/members/invite, orgs/[orgId]/affiliates/[id], orgs/[orgId]/ambassadors/[id]
- orgs/create
- applications/[id]/cv-download
- wallet/cdp/ensure (for cross-profile address check)
- analytics: backfill-90, x/rebuild, x/rebuild/force, x/job, init-status
- admin: backfill-x-90d, queue-status, smoke, social-accounts/normalize-x
- partners, partners/[id]
- public/profile-owner/[username]
- x-sync, x/sync-handle
- xscore/score (anon read of xscore; no service in that route – uses user client)
- jobs/[jobId]/apply (service for job/applications)
- readiness, health
- worker, supabase functions (auth-cdp-login)

### Auth before service

- All inspected API routes that use service role first validate session via `getUser(token)` or equivalent; service client is used after auth for cross-user or RLS-bypass operations (e.g. notifications insert, job/app application insert, cv-download signed URL, ensure-backfill enqueue).
- Admin/cron routes use CRON_SECRET or ADMIN_SECRET; not user Bearer.

### profile_id trust

- No endpoint was found that trusts a user-supplied profile_id to act as another user; actions use `user.id` from auth (e.g. applications, connections, notifications recipient).

### Mass-update endpoints

- No unbounded mass-update found. Updates are scoped by resource id and/or auth.uid(). Admin normalize-x updates rows by provider; backfill/cron process bounded jobs.

**Output**

- **High-risk:** None identified; service role is used for intended admin/cross-user operations after auth or secret.
- **Privilege escalation:** None identified; profile identity is from token, not body.

---

## SECTION 9 — Performance & Scaling

### Heavy queries

- **analytics_jobs:** Indexes on (status, run_after) and (owner_type, owner_id, job_type). Drainer filters by status and run_after.
- **x_tweets by profile_id:** Index idx_x_tweets_profile_tweeted_at (profile_id, tweeted_at DESC); unique (profile_id, tweet_id). refreshXRollups selects by profile_id and date range.
- **Search/filters:** Search and listing endpoints use indexed columns where present; no full-table scan observed in reviewed code.
- **Influence rollups:** refreshOrgInfluenceRollup: one org, supporters count, ambassadors/affiliates/reviews, recursive subsidiaries (depth 5); one upsert. Acceptable for single-org refresh.

### Indexes

- connections: requester, recipient, status.
- org_supporters: org_id, profile_id.
- org_influence_rollups: computed_at.
- x_tweets: profile_id + tweeted_at; unique (profile_id, tweet_id).
- analytics_jobs: status+run_after, owner_type+owner_id+job_type.
- profile_documents: profile_id, doc_type.
- notifications: recipient_profile_id (used in list/count).

### N+1 patterns

- Public one-pager / public data: resolveEntityMediaUrls resolves file_path to signed URLs in batch on server; no per-entity N+1 in that layer. Client SignedMediaImage fetches per image but is client-side and cached.
- Notifications GET: one list query + one count query; no N+1.
- Influence rollup: loop over subsidiary depth with one query per level; bounded by depth 5.

### Worker / memory

- Weekly sync processes profiles in batch (e.g. 100); ingestXTweets and refreshXRollups run per profile with MAX_TWEETS cap. xBackfill90d runs per job. No unbounded in-memory accumulation observed.

**Output**

- Consider index on notifications (recipient_profile_id, created_at DESC) for list + cursor if not present.
- Consider ensuring analytics_jobs drainer limits batch size to avoid long runs.

---

## SECTION 10 — Production Readiness Score

### Scores (1–10)

| Dimension              | Score | Notes |
|------------------------|-------|--------|
| **Stability**          | 7     | Auth and core flows are consistent; ensure-backfill and worker failures can be silent or partial; outlier/retweet logic applied consistently. |
| **Security**           | 8     | Service role gated; auth before privileged ops; no blind profile_id trust; storage uses signed URLs and private-URL detection. |
| **Scalability**        | 6     | Indexes in place for main tables; rollups and backfill are per-entity; single-org influence refresh is fine; high volume of jobs/tweets may need batch and rate limits. |
| **Product completeness** | 6   | Gaps: verified gigs/case study not in me-stats score; ambassador/affiliate invite notifications to invitee missing; supporters count does not exclude private profiles in rollup (if required). |

### Top 5 critical risks

1. **Analytics init failure silent to user** – ensure-backfill failures can show “analytics_failed” with retry; some callers use .catch(() => {}), so backend errors may not be visible.
2. **Redirect URL for OAuth** – Depends on NEXT_PUBLIC_SITE_URL; wrong value can redirect users to wrong host (docmented in REALITY_AUDIT_PROD_STATE).
3. **Verified gigs not in score** – me-stats does not pass verifiedGigsCount/caseStudyDeltas to computeLinkaryPower, so score is incomplete.
4. **Invitee not notified on ambassador/affiliate invite** – Invitee has no in-app notification when invited; only accept/remove notify.
5. **Supporters count in influence** – All supporters counted; if product requires “private profiles not counted,” rollup does not implement it.

### Top 5 improvements before launch

1. Wire verifiedGigsCount (and optionally caseStudyDeltas) into GET /api/profile/me-stats for computeLinkaryPower.
2. Add createNotification(..., "ambassador_invite" | "affiliate_invite") when org sends ambassador/affiliate invite (if invitee should be notified).
3. Validate or allowlist OAuth redirect URL server-side (or document strict env requirements).
4. Surface ensure-backfill failures in UI or logging so analytics init issues are visible.
5. If product requires it: exclude unpublished profiles from org_supporters count in influence rollup (or document that all supporters count).

### Features still demo-only

- Figma app (LandingPage, App.tsx, OrgDetailPage, DashboardPage, etc.) uses demo data objects and figma-specific routing; main app and API use real DB and auth.
- Some figma components (e.g. CreateCircleFlow, demo pricing/feature lists) are not wired to live APIs.
- Public one-pager and main app routes (e.g. /[username], /profile/edit, /dashboard) are production-oriented; figma remains demo.

---

**End of audit.** All findings are based on actual code and migrations in the repository as of the audit date.
