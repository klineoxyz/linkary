# Linkary Production Reality Audit

Repo-grounded audit. No speculation. Every claim references file path, table, route, or migration.

---

## SECTION 1: Runtime Architecture Map

**Frontend (Next.js App Router)**

- Public page: `apps/web/src/app/(public)/[username]/page.tsx` — For slug: `getPublicDTOByUsername` → `dtoToEntityView` → `PublicOnePagerWrapper`. For UUID/wallet: `resolvePublicEntity` (entityResolver) → `entityToPublicDTO` → `dtoToEntityView` → `PublicOnePagerWrapper`. Optional `searchParams.view=brochure`.
- Auth callback: `apps/web/src/app/auth/callback/page.tsx` — Exchanges code for session; calls `ensureProfileForSession`, `saveTwitterIdentityFromOAuth`, `post-login-bootstrap`, `integrations/x/link/finish`, `ensure-backfill`.
- App shell: `apps/web/src/figma/app/App.tsx` — Client-side router; profile edit at `ProfileEditPage.tsx`; messages, jobs, org detail via client Supabase.

**API routes under /api**

- Auth/session: `api/auth/post-login-bootstrap`, `api/auth/sync-session-x`, `api/auth/ensure-social-x`, `api/auth/ensure-social-from-profile`, `api/auth/persist-social`, `api/auth/social-x`, `api/auth/ensure-x-connection`; `api/integrations/x/claim`, `api/integrations/x/link/finish`, `api/integrations/x/disconnect`.
- Onboarding: `api/onboarding/claim-username`, `api/onboarding/set-account-type`.
- Public: `api/public/profile/[username]` (cached DTO), `api/public/profile-owner/[username]` (no-store, owner), `api/public/ownership`, `api/public/layout`.
- Analytics: `api/analytics/init-status`, `api/analytics/ensure-backfill`, `api/analytics/backfill-90`, `api/analytics/x`, `api/analytics/x/summary`.
- Cron: `api/cron/x-analytics-daily`, `api/cron/sync-x-profiles-daily`, `api/cron/backfill-x-90d-batch`, `api/cron/sync-x-tweets-weekly` — all require `CRON_SECRET` (header or Bearer).
- X/sync: `api/x-sync` (twitterapi.io user info; needs `TWITTERAPI_API_KEY`), `api/x/sync-handle`.
- Reputation: `api/ethos/score` (Ethos API + ethos_scores cache), `api/xscore/score` (profiles.xscore read).
- Partners: `api/partners` (GET/POST), `api/partners/[id]` (PATCH/DELETE).
- Case studies: `api/case-studies/[id]` (PATCH).
- Orgs: `api/orgs/create`, `api/orgs/[orgId]/jobs`, `api/orgs/[orgId]/jobs/[jobId]`, `api/orgs/[orgId]/members`, `api/orgs/[orgId]/members/invite`, etc.
- Deals/reviews: `api/applications/[id]/accept`, `api/deals/[id]`, `api/deals/[id]/mark-accepted`, `api/deals/[id]/mark-delivered`, `api/reviews`.
- Admin: `api/admin/queue-status`, `api/admin/smoke`, `api/admin/backfill-x-90d` — superadmin or `ADMIN_BACKFILL_SECRET`.

**Supabase tables in user lifecycle**

- Auth: Supabase Auth (external). Profiles: `profiles` (id, username, published, twitter_username, etc.). Claim: `usernames` (20260221000000). Social: `social_accounts` (20260228000000, 20260240000000–20260245000000). Profile extension: `profile_socials`, `profile_media` (20260225000000). Partner: `partner_programs` (20260248000000). Proof: `case_studies`, `reviews`, `deals` (20260218000000, 20260232000000). Jobs: `jobs`, `applications` (20260218000000, 20260239000000). Messaging: `conversations`, `messages` (20260218000000). Analytics: `x_daily_snapshots`, `x_window_aggregates`, `analytics_jobs` (20260228000000). Rate limits: `rate_limits` (20260222100000).

**Worker (Railway)**

- Entry: `apps/worker/src/run_analytics_jobs.ts` — Polls `analytics_jobs` for status=queued, runs `runXBackfill90d`, updates status done/queued with backoff.
- Job impl: `apps/worker/src/jobs/xBackfill90d.ts` — Calls `getUserInfo`, `getRecentTweets` from `apps/worker/src/lib/twitterapi.ts` (twitterapi.io); writes `x_daily_snapshots`, `x_window_aggregates`.
- Sync: `apps/worker/src/sync_x_profiles_daily.ts`, `apps/worker/src/sync_x_tweets_weekly.ts` — Not verified in this pass for full flow; worker env: `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` or `SERVICE_ROLE_KEY`, `TWITTERAPI_API_KEY`.

**External APIs**

- twitterapi.io: Base `https://api.twitterapi.io`. Used in `apps/web/src/lib/x-analytics-server.ts` (fetchXUserInfo, fetchXUserTweets) and `apps/web/src/app/api/x-sync/route.ts`; worker `apps/worker/src/lib/twitterapi.ts` (getUserInfo, getRecentTweets). Key: `TWITTERAPI_API_KEY` (X-API-Key header).
- Ethos: `https://api.ethos.network/api/v2/score/userkey`. Called from `apps/web/src/app/api/ethos/score/route.ts`; result cached in `ethos_scores`. Optional `ETHOS_CLIENT_ID` (default linkary@1).
- XScore: No outbound API in repo. `api/xscore/score` reads `profiles.xscore` / org xscore from DB only. Abstraction in `lib/providers/xscoreProvider.ts`; Wallchain not integrated.

**Textual flow (existing in code)**

- User → Next.js `/auth/callback` → exchangeCodeForSession → `ensureProfileForSession` → `profiles` (insert/update) → `api/auth/post-login-bootstrap` → `api/integrations/x/link/finish` → `social_accounts` → `api/analytics/ensure-backfill` → enqueue `analytics_jobs` / write snapshots.
- Public page: User → `/[username]` → `getPublicDTOByUsername` or `resolvePublicEntity` → `public_profile_view` / `public_org_view` + `profile_socials`, `profile_media`, `partner_programs`, `case_studies`, `reviews` → `entityToPublicDTO` (allowlist, sanitizeUrl) → PublicOnePager.
- Owner preview: Logged-in owner → `api/public/profile-owner/[username]` (Bearer) → `getPublicEntityForOwner` (service client) → same DTO → no-store response.
- Analytics 90d: Cron `api/cron/backfill-x-90d-batch` → enqueue `analytics_jobs`; worker `run_analytics_jobs` → `runXBackfill90d` → twitterapi.io → `x_daily_snapshots`, `x_window_aggregates`.

---

## SECTION 2: User Lifecycle (Exact, Step-by-Step)

**1) X login**

- Route: Supabase Auth (OAuth) redirects to `apps/web/src/app/auth/callback/page.tsx` with `?code=`.
- Tables: `auth.users` (Supabase); after exchange, `profiles` via `ensureProfileForSession` (lib/profiles).
- Can fail: Exchange fails; no user id; `ensureProfileForSession` or DB error.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client); callback uses `NEXT_PUBLIC_SITE_URL` for redirect.
- RLS: profiles insert_own, update_own (20260217000000); select in 20260218000000 is published OR auth.uid()=id.

**2) Username claim**

- Route: `api/onboarding/claim-username` (POST). Uses RPC `claim_username_for_profile` (usernames + profiles).
- Tables: `usernames`, `profiles` (username set). Migrations: 20260221000000, 20260222000000.
- Can fail: Username taken, RPC error, validation.
- Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- RLS: usernames_select_public (true); claim is RPC (SECURITY DEFINER or service). Not verifiable from repo whether claim writes are RPC-only.

**3) Profile creation**

- Profile row created/updated in auth callback via `ensureProfileForSession` and in onboarding. Tables: `profiles`. Writes: profile_socials, profile_media via ProfileEditPage (Supabase client).
- Routes: callback; `api/auth/post-login-bootstrap`; profile edit saves via `updateMyProfile` and direct upserts to profile_socials, profile_media.
- Can fail: RLS (profile_id = auth.uid()), missing anon key.
- RLS: profiles insert_own, update_own; profile_socials_all_own, profile_media_all_own (20260225000000).

**4) Wallet creation**

- Tables: `wallets`, `wallet_identities`, `cdp_wallets`, `external_wallets` (migrations 20260218200000, 20260230100000, 20260246000000). Routes: `api/wallet/*`, `api/wallet/cdp/*`.
- Env: Supabase URL/keys; CDP/wallet flows may need extra env. Not fully traced here.
- RLS: wallets, wallet_identities, cdp_wallets, external_wallets have RLS (own or service-only).

**5) Social sync**

- Routes: `api/auth/persist-social`, `api/auth/ensure-social-x`, `api/integrations/x/link/finish`, `api/x/sync-handle`. Tables: `social_accounts` (provider, username, status, revoked_at).
- Can fail: Duplicate provider (409 from link/finish), service key missing for sync-handle.
- Env: `SUPABASE_SERVICE_ROLE_KEY` for link/finish and sync-handle (service client).
- RLS: social_accounts select/insert/update own (20260228000000, 20260242000000).

**6) Analytics ingestion**

- Cron: `api/cron/x-analytics-daily` (POST) — CRON_SECRET, TWITTERAPI_API_KEY; reads social_accounts, writes x_daily_snapshots. `api/cron/backfill-x-90d-batch` enqueues analytics_jobs.
- Worker: `run_analytics_jobs.ts` processes `x_backfill_90d`; `xBackfill90d.ts` uses twitterapi.io, writes x_daily_snapshots, x_window_aggregates.
- User-triggered: `api/analytics/ensure-backfill` (POST, Bearer) — rate limited; enqueues 90d job and/or writes today snapshot; needs serviceSupabase.
- Can fail: TWITTERAPI_API_KEY missing (503 on cron); rate limit from twitterapi.io (worker returns null from getUserInfo/getRecentTweets); worker job marked queued again with backoff.
- Env: CRON_SECRET, TWITTERAPI_API_KEY; worker: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY, TWITTERAPI_API_KEY.
- RLS: x_daily_snapshots, x_window_aggregates select own or public (20260228000000); analytics_jobs RLS (worker uses service role).

**7) Publish toggle**

- No dedicated API route; ProfileEditPage calls `updateMyProfile(me.id, { published: true/false })`. Table: `profiles`.
- Gating in UI: avatar, bio, at least one link (docs/PUBLIC_PROFILE_EDITING.md). Not enforced in DB.
- RLS: profiles_update_own (auth.uid() = id). Public read: public_profile_view only includes published = true (20260234000000).

**8) Public page render**

- Route: `apps/web/src/app/(public)/[username]/page.tsx`; data from `getPublicDTOByUsername` or `resolvePublicEntity`. API used by server: same logic; public GET `api/public/profile/[username]` returns DTO, 404 for not-found and unpublished (no enumeration).
- Tables/views: public_profile_view, public_org_view (20260234000000 — WHERE published = true); profile_socials, profile_media, partner_programs, case_studies, reviews; x_window_aggregates etc. for analytics.
- Can fail: View returns nothing for unpublished; DTO build throws (unhandled would 500). Rate limit on public profile: 120/60s per key (username+ip) when serviceSupabase available.
- Env: Service key optional for public route (unpublished check skipped if missing); rate limit uses serviceSupabase.

**9) Brochure mode**

- Same page with `searchParams.view === "brochure"`; prop `brochure` to PublicOnePagerWrapper/PublicOnePager. Hides owner bar and sticky CTA; adds "Copy brochure link" (full URL with ?view=brochure). No new API or table.

**10) Messaging**

- No REST API for conversations/messages. Client uses Supabase from `lib/messages.ts` (getOrCreateConversation, listConversationsForUser, listMessages, sendMessageAsProfile/AsOrg). Tables: `conversations`, `messages`.
- RLS: conversations_select_participant (participants contains auth.uid() or user's org); messages_select_conversation (conversation participants); messages_insert_sender (sender = auth.uid() or org admin). 20260218000000.

**11) Org creation**

- Route: `api/orgs/create` (POST). RPC `create_org_and_membership` (20260235000000, 20260247000000). Tables: `orgs`, `org_members`. Rate limit: 5/600s (partners route pattern; org create has rate limit in code).
- Env: Supabase URL, anon key, service key for RPC if used. RLS: orgs_insert_authed, org_members policies (20260235000000, 20260236000000).

**12) Job application**

- Apply via client (lib/jobs.ts applyToJobAsProfile/applyToJobAsOrg) or UI; `api/applications/[id]/accept` (POST) creates deal. Tables: `jobs`, `applications`, `deals`.
- RLS: applications_select_private (applicant or job org admin only — 20260239000000); applications_insert_applicant; deals_select_party, deals_insert_org_admin, deals_update_org_admin (20260218000000, 20260232000000).

**13) Deal + Review**

- Routes: `api/deals/[id]/mark-delivered`, `api/deals/[id]/mark-accepted`; `api/reviews` (POST). Tables: `deals`, `reviews`. Trigger `reviews_check_deal_and_parties` (20260232000000): review insert only if deal status = completed and parties match, no self-review.
- RLS: reviews_select_public (true); reviews_insert_reviewer (reviewer = auth.uid() or org admin). Deals: select party; update org admin or profile party (20260232000000).

---

## SECTION 3: Environment Variable Dependency Audit

| Env var | File(s) | Purpose | Breaks if missing | Runtime guard |
|--------|--------|--------|--------------------|---------------|
| NEXT_PUBLIC_SUPABASE_URL | Most API routes, x-analytics-server, worker supabase.ts | Supabase client | Auth/DB calls fail | Many routes use `!`; createServiceSupabase throws |
| NEXT_PUBLIC_SUPABASE_ANON_KEY | API routes (partners, case-studies, public layout, ownership, auth, onboarding, orgs, etc.) | Anon + Bearer client | 401 / client fail | Often `!`; no graceful message |
| SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY | x-analytics-server, profile-owner, ensure-backfill, init-status, backfill-90, x-sync, sync-handle, orgs create/invite, admin, worker | Service client, RPC, rate_limits | Service operations fail; worker exits | createServiceSupabase throws; worker getSupabaseAdmin throws |
| NEXT_PUBLIC_SITE_URL | auth/callback, ensure-backfill, OnboardingPage, LoginPage, IntegrationsPage | Redirect URL, base URL | Wrong redirect; ensure-backfill callback wrong | Fallback localhost:3000 or VERCEL_URL |
| NEXT_PUBLIC_APP_URL / VERCEL_URL | public [username] page (baseUrl), publicData (ethos fetch), og | Canonical / OG / ethos base | Wrong links or ethos self-call fails | Fallback linkary.xyz or VERCEL_URL |
| CRON_SECRET | api/cron/x-analytics-daily, backfill-x-90d-batch, sync-x-profiles-daily, sync-x-tweets-weekly | Cron auth | 401 on cron | Checked; 401 if missing or wrong |
| TWITTERAPI_API_KEY | api/x-sync, api/cron/x-analytics-daily, api/cron/sync-x-profiles-daily, backfill-x-90d (lib), worker twitterapi.ts | twitterapi.io | x-sync 503; cron 503; worker throws | x-sync returns 503 with message; cron returns 503 |
| ETHOS_CLIENT_ID | api/ethos/score | Ethos API header | Uses default linkary@1 | Optional |
| SUPERADMIN_EMAILS | api/analytics/ensure-backfill, api/admin/smoke, api/admin/queue-status | Superadmin check | Admin routes may deny or allow incorrectly | Used in isSuperadmin(); empty = no admin |
| ADMIN_BACKFILL_SECRET | api/admin/backfill-x-90d | Alternative admin backfill auth | Backfill only via superadmin | Optional |
| ADMIN_SECRET / CRON_SECRET | api/admin/social-accounts/normalize-x | Normalize X admin | Route auth | One of them required for that route |
| TEST_PROFILE_ID, TEST_ORG_ID | api/admin/smoke | Optional smoke test targets | Smoke uses null | Optional |
| DEBUG_X_CONNECTION_EMAILS | api/debug/x-connection | Production allowlist for debug route | Debug disabled in prod if empty | NODE_ENV=production check |
| SUPABASE_URL | worker lib/supabase.ts | Worker Supabase URL | Worker throws if neither SUPABASE_URL nor NEXT_PUBLIC_SUPABASE_URL | Throw with message |
| ALLOW_DEPRECATED_BACKFILL | lib/backfill-x-90d.ts | Backfill behavior | Deprecated path disabled unless true | Optional |
| NODE_ENV | api/og, api/public/profile, error.tsx, IntegrationsPage, debug/x-connection | Logging, debug, dev-only behavior | N/A | Standard |

Not listed exhaustively: every file that reads process.env; above covers critical paths. No single consolidated env doc found in repo.

---

## SECTION 4: RLS & Security Exposure Audit

- **profiles** (20260217000000, 20260218000000): SELECT `published = true OR auth.uid() = id`. INSERT own (auth.uid() = id). UPDATE own. No DELETE policy (default deny). Public access: only published rows for anon.
- **profile_socials** (20260225000000): SELECT profile_id = auth.uid() OR (published profile). ALL (INSERT/UPDATE/DELETE) profile_id = auth.uid(). Public: only for published profiles.
- **profile_media** (20260225000000): Same pattern as profile_socials. Public: only when profile published.
- **case_studies** (20260218000000): SELECT true (public). INSERT/UPDATE/DELETE owner (profile or org admin). Public: yes; any row visible. Risk: case study content is fully public.
- **partner_programs** (20260248000000): SELECT (owner published OR auth.uid() owner or is_org_admin). INSERT/UPDATE/DELETE owner or org admin. Public: only when owner (profile/org) is published.
- **reviews** (20260232000000): SELECT true. INSERT reviewer (profile or org admin); trigger enforces completed deal and parties. Public: yes. No UPDATE/DELETE policy in cited migrations (default deny or not used).
- **jobs** (20260218000000): SELECT true. INSERT/UPDATE org admin. Public: all jobs visible.
- **applications** (20260218000000, 20260239000000): SELECT was public; replaced by applications_select_private (applicant or job org admin only). INSERT applicant. UPDATE org admin or applicant withdraw. Public: no.
- **conversations** (20260218000000): SELECT participant only (participants contains auth.uid() or user's org). INSERT authed (any). No UPDATE/DELETE policy cited. Public: no.
- **messages** (20260218000000): SELECT only if in conversation participants. INSERT sender (profile or org admin). Public: no.
- **deals** (20260218000000, 20260232000000): SELECT profile or org member. INSERT/UPDATE org admin; UPDATE also profile party (mark delivered). Public: no.

**Summary**

- profiles: anon sees only published; owner sees own. Good.
- profile_socials, profile_media: public only when profile published. Good.
- case_studies, reviews: SELECT true — fully public. Intentional for public 1-pager.
- partner_programs: public only when owner published. Good.
- applications: locked to applicant + job org admin. Good.
- conversations, messages: participant-only. Good.
- jobs: public SELECT (jobs are listed). Acceptable if intended.
- Row-level condition gap: profiles have no DELETE policy (deny by default). Orgs DELETE not verified in scanned migrations.

---

## SECTION 5: Analytics & Worker Stability

**Cron routes**

- `api/cron/x-analytics-daily` (POST): CRON_SECRET; TWITTERAPI_API_KEY; iterates social_accounts (X connected), fetches twitterapi.io user info, upserts x_daily_snapshots; 400ms delay between users. On fetch failure: err += 1, continues. No exponential backoff per user.
- `api/cron/backfill-x-90d-batch`: CRON_SECRET; enqueues analytics_jobs (x_backfill_90d). Does not write snapshots itself.
- `api/cron/sync-x-profiles-daily`, `api/cron/sync-x-tweets-weekly`: CRON_SECRET; TWITTERAPI_API_KEY. Same pattern: fail per user, continue.

**Worker**

- `run_analytics_jobs.ts`: Fetches one queued job; marks running; runs runXBackfill90d; on success marks done; on failure marks queued, increments attempts, sets run_after with backoff (5, 15, 60 min). Logs to console. No retry limit in code (job can retry indefinitely).
- `xBackfill90d.ts`: getUserInfo, getRecentTweets (twitterapi.io). If null (rate limit or error), returns { ok: false, error }. Worker then requeues with backoff. Writes x_daily_snapshots, x_window_aggregates. Delay 200ms and 400ms between calls.

**If worker fails 24h**

- New 90d backfills not processed; queue grows. Existing x_window_aggregates unchanged. Public page still shows last computed aggregates. ensure-backfill and cron keep enqueueing; no automatic drain.

**If twitterapi.io rate limits**

- getUserInfo/getRecentTweets return null; job fails and is requeued with backoff. No explicit "rate limit" detection; any non-ok response treated as failure. After 3 attempts backoff is 60 min.

**If Ethos fails**

- api/ethos/score returns fail() with status 502/4xx. publicData and me-stats catch and use null score; no crash. Cached ethos_scores used when fresh.

**Exponential backoff**

- Worker: yes (5, 15, 60 min). Cron routes: no; fixed delay between users.

**Errors**

- Worker: result.error stored in analytics_jobs.last_error; console.error on fetch/mark errors. Cron: per-user errors increment err; no detailed logging in snippet. Many catch blocks swallow or log minimally.

**Partial states**

- x_daily_snapshots: today may be missing for some users if cron or worker failed. x_window_aggregates: may be stale. init-status and ensure-backfill check for presence; UI shows "partial" or "fallback" source. No automatic repair; user can re-trigger ensure-backfill (rate limited).

---

## SECTION 6: Public Page Integrity

**DTO allowlist**

- `apps/web/src/lib/publicProfileDTO.ts`: entityToPublicDTO maps only explicit fields; no raw spread of entity. Profile: display_name, username, bio, avatar_url, website, twitter_username, location, published, socials (allowlisted), caseStudies (id, title, description, proof_url, created_at), affiliates/ambassadors (name, website_url, logo_url, description, since_date, is_featured), headerMedia, ethosScore, xscore, linkaryPower, analytics, publicLayout. Org: analogous allowlist. No email, user_id, or internal ids except case_studies.id.

**sanitizeUrl**

- `apps/web/src/lib/sanitizeUrl.ts`: Allows only http/https; rejects javascript, data, file, vbscript, blob. Used in publicProfileDTO for avatar, website, socials, proof_url, logo_url, header_media_url, dexscreenerUrl; in case studies create (lib/caseStudies.ts); in partners API (route.ts). All URL outputs in DTO pass through sanitizeUrl or are set null.

**Owner preview**

- `api/public/profile-owner/[username]`: Bearer required; getPublicEntityForOwner(segment, userId, serviceSupabase); returns same DTO shape; Cache-Control no-store. Ownership: profile id = user or is_org_admin for org.

**Brochure mode**

- Query param view=brochure; no extra data; layout only. Same entity/DTO as normal.

**Cache headers**

- Public profile GET 200: s-maxage=60, stale-while-revalidate=300. 404: s-maxage=30, stale-while-revalidate=60. Vary: Accept-Encoding (no Authorization).

**Unpublished leak**

- getPublicDTOByUsername uses getPublicEntityByUsername which reads public_profile_view / public_org_view (20260234000000: WHERE published = true); entity not found for unpublished. If serviceSupabase present, unpublished check uses profiles table and returns { ok: false, unpublished: true }; API returns 404 with same body as not-found. Unauthenticated callers cannot distinguish not-found vs unpublished. DTO is never returned for unpublished in public route.

**Private fields**

- DTO has no email, user_id, or internal ids except case_studies.id. Allowlist enforced in entityToPublicDTO.

**Public profile rate limit**

- Yes: key `public_profile:${norm}:ip:${ip}`, limit 120, window 60s. When serviceSupabase unavailable, rate limit skipped (no rate_limits table call). So under no service key, enumeration is not rate limited by this mechanism.

**Username enumeration**

- 404 for not-found and unpublished; same response. Rate limit per username+ip when service key set. Without service key, many 404s can be requested without rate limit (only infra/Next.js limits).

---

## SECTION 7: Messaging Risk Assessment

**Supabase-only**

- Conversations and messages are read/written only via Supabase client from app (lib/messages.ts). RLS: conversations_select_participant (must be in participants); messages_select_conversation (must be participant); messages_insert_sender (must be sender). No REST API that could bypass RLS.

**Non-participant inferring existence**

- SELECT on conversations returns only rows where participants @> auth.uid() or user's org. Non-participant gets no rows for that conversation. They cannot list or read it. Existence could only be inferred if another channel leaked a conversation id and they tried to read messages (would get 0 rows or RLS deny). No public listing of conversation ids.

**Route bypassing RLS**

- Not verifiable from repo: all messaging access in app uses Supabase client with user session; no service-role read of conversations/messages for normal flows. So no route in the listed API routes bypasses RLS for messaging.

**Conclusion for messaging**

- Safe to ship as Supabase-only from an access-control perspective. No scenario found where a non-participant could read a conversation or messages. INSERT conversation allows any authed user (creates conversation); participants are set by app logic (apply flow or messages UI). If app always sets participants correctly, RLS then restricts read to those participants.

---

## SECTION 8: Onboarding Friction Points (Technical Only)

- **Callback redirect**: If NEXT_PUBLIC_SITE_URL is wrong, user is redirected to wrong host after X login. No runtime check.
- **Username claim race**: Two users claiming same username concurrently; RPC and unique constraint handle it (one fails). No application-level lock.
- **ensure-backfill after login**: Called with .catch(() => {}). If it fails (e.g. rate limit, 503), user is not informed; analytics may stay "partial" until next cron or manual retry.
- **Profile + social_accounts ordering**: post-login-bootstrap, link/finish, persist-social called in sequence; if one fails, profile may exist but social_accounts or profile_socials inconsistent. No single transactional "onboarding complete" flag.
- **Publish gating**: Only in UI. If someone updates profiles.published directly (e.g. SQL), profile can be public without avatar/bio/link. DB does not enforce.
- **Worker dependency**: If worker is down, 90d backfill never runs; init-status may show "partial" forever for new users until worker runs again.
- **Ethos cache**: First request for a handle hits Ethos API; if Ethos is down, score is null. No retry in code; next request after cache expiry tries again.
- **Assumed state**: ensureProfileForSession assumes profile row exists or can be inserted (id = auth.uid()). If RLS or trigger prevents insert, onboarding can fail without clear message.

---

## SECTION 9: Top 10 Technical Risks Before User Onboarding

1. **Missing service role key in production (Critical)**  
   If SUPABASE_SERVICE_ROLE_KEY (or SERVICE_ROLE_KEY) is unset, createServiceSupabase throws; public profile rate limiting is skipped; profile-owner endpoint returns 503; ensure-backfill and cron paths that need service client fail. Files: lib/x-analytics-server.ts, api/public/profile-owner, api/analytics/ensure-backfill, api/public/profile (rate limit), worker.

2. **Missing TWITTERAPI_API_KEY (High)**  
   Cron returns 503; x-sync returns 503; worker throws on getApiKey(). New users never get X analytics; 90d backfill never runs. Files: api/cron/x-analytics-daily, api/x-sync, worker lib/twitterapi.ts.

3. **Unpublished vs not-found (Low)**  
   Public API returns 404 for both; no enumeration. If service key is missing, unpublished check is skipped and unpublished profiles are still not returned (entity comes from public_profile_view which is published-only). So no leak; only rate limit is skipped when service key missing.

4. **Worker not running (High)**  
   analytics_jobs queue is never drained; 90d aggregates never computed; users stuck in "partial" or "fallback" source. No automatic recovery. File: apps/worker/src/run_analytics_jobs.ts.

5. **twitterapi.io rate limit (Medium)**  
   Worker and cron get null from API; job/cron iteration fails for that user; retried with backoff. No explicit handling of 429; all errors treated same. Many new users in short window could hit rate limits. Files: worker jobs/xBackfill90d, lib/twitterapi; api/cron/x-analytics-daily.

6. **Ethos API down (Low)**  
   ethos/score returns fail(); callers use null score; no crash. Reputation card shows — or cached value. File: api/ethos/score/route.ts.

7. **applications SELECT was public, now private (Mitigated)**  
   Migration 20260239000000 replaced applications_select_public with applications_select_private. So current state: applications are not public. Risk was historical.

8. **case_studies SELECT true (Low)**  
   All case studies are public. If a case study contained sensitive data, it would still be visible. Mitigation: allowlist in DTO (no raw body); proof_url sanitized. Business decision.

9. **NEXT_PUBLIC_SITE_URL wrong (Medium)**  
   Auth callback redirects to wrong origin; user may land on broken or phishing URL. No validation. File: app/auth/callback/page.tsx.

10. **Ensure-backfill errors swallowed (Medium)**  
    Call sites use .catch(() => {}). User sees success but analytics may never initialize. File: auth/callback (ensure-backfill fetch), other callers. No user-facing error.

---

## Conclusion: Is Linkary technically safe to onboard 100 real users today?

**No**, with the following reasoning.

- **Critical path**: Production must have SUPABASE_SERVICE_ROLE_KEY and TWITTERAPI_API_KEY set and the worker (or equivalent job runner) running. If any of these is missing or misconfigured, either core flows break (service client) or analytics never backfill (worker/twitterapi). The code assumes these are present; several failure modes result in silent or generic errors (e.g. ensure-backfill swallowed, worker job requeued indefinitely).
- **Operational readiness**: There is no single "health" check that verifies cron + worker + Ethos + rate limits. Without a runbook or verified env checklist, onboarding 100 users increases the chance of hitting twitterapi.io limits and partial states with no clear remediation path.
- **Safe to ship from a security perspective**: RLS and public DTO are in good shape; unpublished profiles do not leak; messaging is participant-only; applications are not public. The main risks are availability, configuration, and operational visibility rather than data exposure or privilege escalation.

**Recommendation**: Before onboarding 100 users, (1) confirm all required env vars in production (including CRON_SECRET for cron), (2) ensure the worker is running and processing analytics_jobs, (3) add a minimal health or readiness check that verifies service role and optionally twitterapi connectivity, and (4) surface ensure-backfill or analytics init failures to the user (e.g. toast or banner) instead of swallowing them. After that, the system is technically capable of handling 100 users from a security and data-integrity standpoint.
