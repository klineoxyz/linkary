# URL Routing and X Handle Audit

**Scope:** Production-grade audit of Linkary account identity, public slug (URL), and routing. No code changes, migrations, or refactors—findings and recommendations only.

**Audit date:** 2026-03-04

---

## 1) Canonical identity vs slug

### Canonical identity

- **Canonical identity** for a Linkary account is **`auth.users.id`** (Supabase Auth user ID). The application uses this consistently as the account owner.
- **Profile primary key:** `public.profiles.id` is set equal to `auth.users.id` (1:1). All ownership checks use `profiles.id` / `user.id` (e.g. `user.id === profileId` in the slug page, `auth.uid()` in RPCs).
- **Evidence:** Login and session are keyed by Supabase Auth; profile rows are created/updated by `user.id` in:
  - `apps/web/src/app/auth/callback/page.tsx` (session exchange, then `ensureProfileForSession(user.id)`, `saveTwitterIdentityFromOAuth(user.id, ...)`)
  - `apps/web/src/app/api/auth/post-login-bootstrap/route.ts` (profile insert/update `eq("id", user.id)`)
  - `apps/web/src/lib/resolveSlugServer.ts` (owner check: `profiles.eq("id", user.id)`)

**Conclusion:** Handle/slug changes do **not** affect login or account ownership. Identity is always `user_id` / `profiles.id`; only the public-facing slug (and related denormalized fields) change.

### Where the public slug is stored

- **Primary source of truth for the public URL slug:** `public.usernames` table (`username` column), with **`public.profiles.username`** as the denormalized copy for profiles. For orgs, `public.orgs.slug` is the denormalized copy.
- **References:**
  - `supabase/migrations/20260221000000_usernames_claim.sql`: “Source of truth: usernames table. profiles.username / orgs.slug are denormalized.”
  - `claim_username_for_profile` in the same migration: inserts/updates `usernames` and `UPDATE public.profiles SET username = normalized WHERE id = profile_id`.
  - Route resolution uses `profiles.username` and `profiles.twitter_username` (see below).

So: **Linkary public slug** = `profiles.username` (and usernames.username for profiles). `profiles.twitter_username` is the **X handle** (mutable); it is used for display and as an **alternate** resolver for `/[slug]` (so both `username` and `twitter_username` can resolve to the same profile).

### What the system stores

| Concept              | Stored where                         | Notes |
|----------------------|--------------------------------------|--------|
| **Stable X identity** | `profiles.twitter_user_id`           | From OAuth `identity_data.id` / `sub`. |
| **X handle (mutable)** | `profiles.twitter_username`, `social_accounts.username` | Updated when user syncs from X or re-connects. |
| **Linkary slug**     | `profiles.username`, `usernames.username` (owner_type=profile) | Denormalized from `usernames`; used for `/[slug]` and uniqueness. |
| **Proposed new handle** | `profiles.twitter_username_candidate` | Set when OAuth returns a different handle than current; user can accept via “Sync from X” or similar. |

- **DB columns (profiles):** `id`, `username`, `twitter_username`, `twitter_user_id`, `twitter_username_candidate`, `twitter_connected_at` (and trigger-derived `x_connected` in `supabase/migrations/20260237000000_profiles_x_connection_truth.sql`).
- **social_accounts:** `user_id`, `provider` (e.g. `"twitter"`), `provider_user_id`, `username` (current X handle from OAuth/link).

### How slug updates when the X handle changes

1. **When the user already has a handle:** Most flows do **not** overwrite `profiles.twitter_username` with a new one; they set **`twitter_username_candidate`** so the user can explicitly “Sync from X” to apply it.
   - **post-login-bootstrap** (`apps/web/src/app/api/auth/post-login-bootstrap/route.ts`): if `currentHandle && currentHandle !== handle` → sets `twitter_username_candidate`; only if `!currentHandle` sets `twitter_username`.
   - **integrations/x/claim** (`apps/web/src/app/api/integrations/x/claim/route.ts`): same pattern (lines 124–128, 171–176).
   - **ensure-x-connection** (`apps/web/src/app/api/auth/ensure-x-connection/route.ts`): same (lines 74–79).
   - **sync-session-x** (`apps/web/src/app/api/auth/sync-session-x/route.ts`): if stored handle differs from OAuth handle, sets `twitter_username_candidate`; only updates `twitter_username` when stored is empty or matches (lines 71–79).

2. **When the user applies the new handle:**  
   - **POST /api/x/sync-handle** (`apps/web/src/app/api/x/sync-handle/route.ts`): reads handle from `social_accounts` (X connection), updates `profiles.twitter_username` and clears `twitter_username_candidate`. It does **not** call `claim_username_for_profile`; so the **slug** (`profiles.username`) is only updated if another path (e.g. sync-session-x or post-login-bootstrap) calls the claim RPC with the new handle.
   - **sync-session-x**: when it updates `twitter_username` to the new handle, it also calls `claim_username_for_profile(normalizedHandle)` (line 86), which updates `usernames` and `profiles.username`.
   - **x-sync** (`apps/web/src/app/api/x-sync/route.ts`): fetches X API; can set `twitter_username` from API `userName` (with logic to keep existing handle in some cases); then calls `claim_username_for_profile(normalizedUsername)` (lines 153–157). So when x-sync updates the handle, the slug is updated too.

So: slug updates happen when code both updates `profiles.twitter_username` (or the user accepts the candidate) **and** calls `claim_username_for_profile(desired_username)`. Not every handle update path calls the claim RPC (e.g. **x/sync-handle** updates handle only; slug stays old unless something else claims the new handle).

---

## 2) First login claim flow

### Code path on first login / first X connect

1. **Auth callback (client)**  
   - **File:** `apps/web/src/app/auth/callback/page.tsx`  
   - After `exchangeCodeForSession(code)`, it calls:
     - `ensureProfileForSession(user.id)` (from `@/lib/profiles`)
     - `POST /api/auth/post-login-bootstrap` with Bearer token
     - For X identity: `saveTwitterIdentityFromOAuth(user.id, identity)` (same file, lines 155–164 and 252–258)
   - So first login runs **post-login-bootstrap** and (when X identity exists) **saveTwitterIdentityFromOAuth** in profiles.ts.

2. **Post-login-bootstrap (first login slug + DB)**  
   - **File:** `apps/web/src/app/api/auth/post-login-bootstrap/route.ts`  
   - **Function:** `POST` handler (no named function).  
   - **Inputs:** `user` from `supabase.auth.getUser(token)`; X identity from `user.identities` (provider `twitter`/`x`); `provider_user_id` and handle from `identity_data` (`id`/`sub`, `user_name`/`preferred_username`/`username`/`screen_name`/`nickname`).  
   - **DB writes:**
     - Insert profile if missing: `profiles.insert({ id: user.id, username: null, twitter_username: null, ... })`.
     - Upsert `social_accounts` (user_id, provider `"twitter"`, provider_user_id, username: handle, status, etc.).
     - Update `profiles`: `twitter_user_id`, `twitter_connected_at`; if no current handle → `twitter_username = handle`, else if handle changed → `twitter_username_candidate = handle`.
     - **Claim slug:** `await supabase.rpc("claim_username_for_profile", { desired_username: normalizedHandle })` (line 124).  
   - **Normalization:** `normalizedHandle = handle?.trim().toLowerCase().replace(/^@/, "").replace(/\s+/g, "-")` (line 121). So the slug is lowercased, @ stripped, spaces to hyphens.

3. **saveTwitterIdentityFromOAuth (client-side path)**  
   - **File:** `apps/web/src/lib/profiles.ts`  
   - **Function:** `saveTwitterIdentityFromOAuth(userId, identity)`.  
   - Updates `profiles` with `twitter_user_id`, `twitter_connected_at`, `twitter_username` (normalized), then calls `claimUsernameForProfile(normalizedHandle)` which invokes `claim_username_for_profile` RPC. So slug is also set/claimed from the client callback path when X identity exists.

4. **RPC: claim_username_for_profile**  
   - **File:** `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` (current version).  
   - **Input:** `desired_username text`; `profile_id := auth.uid()`.  
   - **Normalization:** `normalized := public.normalize_username(desired_username)` (SQL: lower, trim, strip leading `@`, replace non-alphanumeric with `-`, collapse hyphens).  
   - **DB writes:** Inserts/updates `usernames` (username, owner_type `'profile'`, owner_id, provider `'x'`, verified_at); `UPDATE public.profiles SET username = normalized, updated_at = now() WHERE id = profile_id`. Handles takeover of unverified placeholders and denormalized `profiles.username` / `orgs.slug` to avoid unique constraint violations.

### Summary table

| Step              | File / location                                      | Inputs                    | DB writes                                                                 | Slug normalized |
|-------------------|------------------------------------------------------|---------------------------|---------------------------------------------------------------------------|-----------------|
| Callback          | `apps/web/src/app/auth/callback/page.tsx`           | code, session             | (none; calls APIs)                                                        | —               |
| Post-login-bootstrap | `apps/web/src/app/api/auth/post-login-bootstrap/route.ts` | token, user.identities (X) | profiles insert/update, social_accounts upsert, claim_username_for_profile | Yes (lower, @ strip, spaces→-) |
| saveTwitterIdentityFromOAuth | `apps/web/src/lib/profiles.ts`              | userId, TwitterIdentity   | profiles update, claim_username_for_profile                               | Yes             |
| claim_username_for_profile | `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` | desired_username, auth.uid() | usernames insert/update, profiles.username update                        | Yes (normalize_username) |

---

## 3) Handle change flow

### When it runs

- **No dedicated cron/worker** updates `profiles.twitter_username` from X when the user changes their handle on X. The daily cron `sync-x-profiles-daily` (`apps/web/src/app/api/cron/sync-x-profiles-daily/route.ts`) only updates **followers_total**, **avg_engagement_rate**, **x_sync_status**, **x_last_profile_sync_at**, and **x_daily_snapshots**; it does **not** overwrite `twitter_username`.
- Handle changes are applied when:
  1. **User visits after re-auth (session refresh):** e.g. **sync-session-x** (`apps/web/src/app/api/auth/sync-session-x/route.ts`) is called (e.g. from frontend when opening Integrations or after login). It reads X identity from `extractTwitterIdentity(user)`, compares to stored `profiles.twitter_username`, and can set `twitter_username` or `twitter_username_candidate` and call `claim_username_for_profile`.
  2. **User clicks “Sync from X”:** **POST /api/x/sync-handle** (`apps/web/src/app/api/x/sync-handle/route.ts`) reads current handle from `social_accounts` and sets `profiles.twitter_username` (and clears `twitter_username_candidate`). It does **not** call the claim RPC, so the slug is unchanged unless another flow claims the new handle.
  3. **User triggers x-sync:** **GET/POST /api/x-sync** (`apps/web/src/app/api/x-sync/route.ts`) calls X API, can update `twitter_username` from API `userName`, then calls `claim_username_for_profile(normalizedUsername)`, so both handle and slug can change (with 24h cooldown and conflict handling).

### What it compares and updates

- **sync-session-x:** Compares `(existingProfile.twitter_username ?? "").trim().toLowerCase().replace(/^@/, "")` to `(normalizedHandle ?? "").toLowerCase().replace(/^@/, "")`. If empty → set `twitter_username`; if match → clear candidate; if different → set `twitter_username_candidate`. When it sets `twitter_username`, it also calls `claim_username_for_profile(normalizedHandle)`.
- **x/sync-handle:** No comparison to “old” handle; it overwrites `profiles.twitter_username` with the handle from `social_accounts` and sets `twitter_username_candidate = null`.
- **x-sync:** Compares `existingHandle` to `apiUserName` from X API; if they differ it can keep `existingHandle` (lines 117–121) or set `twitter_username` from API and then call `claim_username_for_profile`.

### Links/relationships

- Handle/slug updates only touch `profiles` (and `usernames` via RPC). There is no code that rewrites foreign keys or link tables (e.g. profile_links, case_studies, reviews) by slug; those reference `profile_id` (UUID). So **relationships are safe** with respect to handle/slug changes.

---

## 4) Route resolution for root URLs

### How Next.js resolves paths

- **Static routes** (one segment): e.g. `/dashboard`, `/xspaces`, `/calendar`, `/analytics` are served by **literal route files** under `apps/web/src/app/`:
  - `apps/web/src/app/dashboard/page.tsx`
  - `apps/web/src/app/xspaces/page.tsx`
  - `apps/web/src/app/calendar/page.tsx`
  - `apps/web/src/app/analytics/page.tsx`
  - Similarly: `login`, `onboarding`, `explore`, `terms`, `privacy-policy`, `profile`, `overview`, `market`, `messages`, `circles`, `verification`, `pricing`, `billing`, `plans`, `app`, `settings`, `test-supabase`, `home`, `leaderboards`, `creator`, `brand`, `agency`, `host`, `availability`, `monetization`, `monetization-flow`, `kol-lists`, `capital-partners`, `preferences`, `support`, `notifications`, `verification-inbox`, `showcase`, `connections`, `watchlist`, etc.
- **Dynamic “slug” route:** The **single-segment** public profile URL (e.g. `/muazxinthi`) is served by the **catch-all** dynamic route:
  - **Route file:** `apps/web/src/app/(public)/[username]/page.tsx`  
  - **Param:** `params.username` (first path segment). So `/muazxinthi` → `username === "muazxinthi"`.

### Middleware

- **File:** `apps/web/middleware.ts`  
  - Redirects **www.linkary.xyz → linkary.xyz** (308) so session cookies work.  
  - Redirects **/@username → /username** (301).  
  - No rewrite of reserved words to app routes; reserved handling is done inside the `[username]` page.

### reservedPaths.ts usage

- **File:** `apps/web/src/lib/reservedPaths.ts`  
  - Exports `RESERVED_PATHS` (Set of strings) and `isReservedPath(segment)` (checks `segment.toLowerCase()` against the set).
- **Usage (routing-time):** In `apps/web/src/app/(public)/[username]/page.tsx`:
  - In `generateMetadata`: if `!segment || isReservedPath(segmentLower)` → return generic `{ title: "Linkary" }` (lines 72–74).
  - In the page component: if `isReservedPath(segmentLower)` → return `<AppWithProviders />` (lines 174–175), i.e. render the app shell instead of a profile or claim page.
- So **reserved path checks are used only when the request has already been routed to the dynamic `[username]` page**. They are **not** used in middleware. For paths that have a **static** route (e.g. `/dashboard`), Next.js never invokes `(public)/[username]/page.tsx`; the static route wins. So:
  - **Routing-time:** Next.js chooses between static route vs `(public)/[username]` by file system. Reserved list is **not** used by the router.
  - **Validation-time:** When the segment is handled inside `(public)/[username]/page.tsx`, `isReservedPath(segmentLower)` prevents treating a reserved word as a username and shows the app shell instead.

The **claim RPC and onboarding claim-username API do not** check reserved paths; they only normalize and enforce uniqueness (see Collision section).

---

## 5) Collision behavior (by reading code)

### A) User changes X handle to a reserved app route (e.g. "dashboard", "api")

- **Claim/slug write:** `claim_username_for_profile` and `normalize_username` in SQL do **not** reject reserved strings. So a user can end up with `profiles.username = 'dashboard'` and a row in `usernames` for `'dashboard'` if they claim it (e.g. via post-login-bootstrap or sync-session-x with handle "dashboard").
- **At request time:** For a request to `/dashboard`, Next.js serves `app/dashboard/page.tsx`, **not** `(public)/[username]/page.tsx`. So the user with slug `dashboard` is **never** reached at `/dashboard`; the app dashboard page is shown.
- **Result:** The system does **not** block claiming a reserved slug in the DB. It does **not** override the app route. The user’s profile becomes **unreachable** at what would be their “canonical” URL (`/dashboard`). Effectively **broken page** for that slug (no redirect from `/dashboard` to the user). No fallback today.

**References:**  
- RPC: `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` (no reserved check).  
- Page: `apps/web/src/app/(public)/[username]/page.tsx` (reserved → AppWithProviders).  
- Route precedence: static `dashboard/page.tsx` over dynamic `(public)/[username]/page.tsx`.

### B) Two users attempt same X handle/slug (or one changes into another’s)

- **DB:**  
  - **profiles:** Unique index `unique_twitter_username` on `LOWER(TRIM(twitter_username))` where not null/empty (`supabase/migrations/20260231000001_twitter_username_unique.sql`). So two profiles cannot have the same `twitter_username`.  
  - **usernames:** `UNIQUE(username)` (`supabase/migrations/20260221000000_usernames_claim.sql`). So one slug per owner.
- **RPC:** `claim_username_for_profile` checks `usernames` (and denormalized profiles/orgs). If the normalized slug is taken by another **verified** profile/org, it raises `USERNAME_TAKEN_VERIFIED`. If taken by an unverified placeholder, it renames the placeholder to `test-*` / `test-org-*` and assigns the slug to the current user.
- **Result:** The system **blocks** double use of the same slug by two verified owners (returns error). It does **not** override the other user. No broken page; request either gets the correct profile or (for the claimant) an error. Fallback: unverified placeholder is bumped to `test-*`.

**References:**  
- `supabase/migrations/20260231000001_twitter_username_unique.sql`  
- `supabase/migrations/20260221000000_usernames_claim.sql` (UNIQUE(username))  
- `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` (takeover logic, USERNAME_TAKEN_VERIFIED)

### C) Org/project handle vs user handle (same namespace)

- **Namespace:** Profiles and orgs share the same **usernames** table; `owner_type` is `'profile'` or `'org'`. So one slug cannot be held by both a profile and an org.
- **claim_username_for_profile:** If the slug is taken by an org (verified or unverified per logic), the RPC either reassigns the org’s slug to `test-org-*` and gives the slug to the profile (unverified org), or raises `USERNAME_TAKEN_VERIFIED` (verified org).
- **Result:** Org and user **cannot** both have the same slug. First claimant wins; the other gets an error or is renamed to `test-*` if unverified. No override of a verified owner; no broken page.

**References:**  
- `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` (org branch).

### D) New reserved route added later (e.g. "/jobs") but existing user already has that slug

- **DB:** User can already have `profiles.username = 'jobs'` and a row in `usernames`.
- **Code change:** Adding `apps/web/src/app/jobs/page.tsx` makes Next.js serve `/jobs` with the new page. The dynamic route `(public)/[username]/page.tsx` is **never** hit for `/jobs`.
- **Result:** The system does **not** block the new route. The **app route overrides** the user: `/jobs` shows the new jobs page, not the profile. The user with slug `jobs` **loses** their public URL (broken link). No automatic redirect or fallback today.

**References:**  
- Next.js static route precedence over `(public)/[username]/page.tsx`.

---

## 6) Current safeguards inventory

| Safeguard | Location | What it does |
|-----------|----------|--------------|
| **usernames UNIQUE(username)** | `supabase/migrations/20260221000000_usernames_claim.sql` | One slug per owner in the shared namespace. |
| **profiles unique_twitter_username** | `supabase/migrations/20260231000001_twitter_username_unique.sql` | One X handle per profile (case-insensitive, trimmed). |
| **profiles_username_key** (denormalized uniqueness) | Referenced in `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` | RPC checks/updates denormalized `profiles.username` / `orgs.slug` to avoid duplicate key. |
| **Slug normalization (app)** | `apps/web/src/app/api/auth/post-login-bootstrap/route.ts` (line 121), `apps/web/src/lib/profiles.ts` (line 269), `apps/web/src/app/api/onboarding/claim-username/route.ts` (lines 33–36) | Trim, lowercase, strip `@`, spaces → `-`, hyphen trim. |
| **Slug normalization (DB)** | `public.normalize_username(raw)` in `supabase/migrations/20260221000000_usernames_claim.sql` | lower, trim, strip `@`, non-alphanumeric → `-`, collapse hyphens. |
| **Reserved path check (page only)** | `apps/web/src/lib/reservedPaths.ts`; `apps/web/src/app/(public)/[username]/page.tsx` (lines 73–74, 174–175) | When the request hits the dynamic slug page, reserved segment → app shell (AppWithProviders); not used in RPC or claim API. |
| **Claim RPC takeover rules** | `supabase/migrations/20260222000000_claim_username_handle_profiles_unique.sql` | Unverified profile/org loses slug (renamed to test-*); verified keeps slug, caller gets USERNAME_TAKEN_VERIFIED. |
| **@ redirect** | `apps/web/middleware.ts` (lines 29–36) | `/@username` → `/username` (301). |
| **www redirect** | `apps/web/middleware.ts` (lines 17–25) | www → apex (308) for cookie domain. |
| **No overwrite of non-empty twitter_username** | `apps/web/src/lib/profiles.ts` (lines 245–255), post-login-bootstrap, ensure-x-connection, sync-session-x | When profile already has a handle, many flows set `twitter_username_candidate` instead of overwriting, to avoid silent takeover. |
| **Redirect old slug → new slug** | — | **None.** There is no redirect from a previous slug to the current one when the handle/slug changes. |
| **Logging / observability for slug changes** | — | No dedicated logging or metrics for slug/handle changes in the audited paths. |

---

## 7) Risks and recommendations (no implementation)

### Top 5 risks

1. **Reserved slug allowed in DB, app route wins at request time**  
   A user can claim a reserved slug (e.g. "dashboard", "api"). The DB stores it, but the app serves the static route, so the user’s profile is unreachable at that URL. No validation at claim time and no redirect.

2. **New static routes can “steal” existing users’ slugs**  
   Adding a new first-segment route (e.g. `/jobs`) immediately shadows any existing profile with slug `jobs`. Those users lose their public link with no warning or redirect.

3. **Slug and handle can diverge**  
   `/api/x/sync-handle` updates `profiles.twitter_username` but does not call `claim_username_for_profile`, so `profiles.username` (and usernames table) can stay on the old slug while the displayed handle is new. Resolution allows both `username` and `twitter_username`, but the “canonical” copied link may still use the old slug if the UI shows the new handle.

4. **No redirect from old slug to new slug**  
   When a user’s slug changes (e.g. after handle change and claim), old links (e.g. linkary.xyz/oldhandle) hit the slug page; resolution is by current `username`/`twitter_username`, so the old slug shows “Claim” or 404. No 301 from old → new.

5. **Reserved list duplication and drift**  
   `RESERVED_PATHS` in `apps/web/src/lib/reservedPaths.ts` and the similar set in `apps/web/src/figma/app/App.tsx` (RESERVED_PATHS) can drift (e.g. "u", "connections", "watchlist" already differ). Claim path and DB do not use any reserved list, so adding a reserved word only in one place leaves gaps.

### Minimal safe fix options (high level)

- **Reserved slugs at claim time:** Before calling `claim_username_for_profile` (and ideally inside the RPC or a wrapper), reject or remap reserved segments using a single canonical list (e.g. from reservedPaths or DB). Optionally store reserved list in DB and have RPC check it so new routes can be reserved without app deploy.
- **New route checklist:** When adding a new first-segment route, check for existing profiles/orgs with that slug; either choose a different path, or add a redirect from the new path to the profile for those owners (or migrate them to a new slug).
- **Sync-handle also updates slug:** When `/api/x/sync-handle` sets `profiles.twitter_username`, call `claim_username_for_profile` for the new handle (after reserved check) so slug and handle stay in sync; handle USERNAME_TAKEN_VERIFIED and surface to user.
- **Redirect old → new slug:** Persist previous slugs (e.g. `usernames` history or `profile_slug_history`) and in middleware or slug page: if segment matches an old slug, 301 to the current slug. Requires defining “current” slug (e.g. profiles.username) and one place that performs the redirect.
- **Single source for reserved list:** Export one reserved set (e.g. from `reservedPaths.ts`) and use it in the app route map (App.tsx), slug page, and claim path (and optionally in RPC). Add a test or CI check that App.tsx reserved set is a superset of reservedPaths.

### Recommendation summary

- **Mutable X handles:** Keep identity on `user_id`/`profiles.id`; keep using `twitter_username_candidate` for “new handle” and explicit “Sync from X” or equivalent; ensure one path that applies the new handle also updates the slug (claim RPC) so handle and slug stay aligned; consider persisting old slugs for redirects.
- **Reserved routes:** Reject (or remap) reserved slugs at claim time using a single canonical list; align with actual static routes so no user can end up with an unreachable reserved slug.
- **Uniqueness:** Keep `usernames.UNIQUE(username)` and `unique_twitter_username`; keep the RPC takeover logic for unverified placeholders; add reserved-word check in the same claim path so uniqueness and reserved rules are enforced together.
- **Not breaking existing public links:** Introduce optional “previous slugs” and 301 from old slug to current slug; when adding new first-segment routes, check for existing owners of that slug and either avoid the route or redirect those owners.

---

## Fixes implemented (2026-03-04)

The following minimal safe fixes were implemented based on this audit:

1. **Single source for reserved paths**  
   `apps/web/src/lib/reservedPaths.ts` is the only source of truth. `App.tsx` imports `RESERVED_PATHS` from it. Added required paths: `auth`, `signup`, `favicon.ico`, `robots.txt`, `sitemap.xml`, `connections`, `watchlist`. Script: `apps/web/scripts/assertReservedPaths.ts`.

2. **Block reserved slugs at claim time**  
   New helper `apps/web/src/lib/slug/safeSlug.ts`: `safeSlug()`, `claimSafeSlug()`. All claim entry points use it: post-login-bootstrap, sync-session-x, x-sync, onboarding/claim-username, x/sync-handle, and `profiles.ts` (saveTwitterIdentityFromOAuth). Reserved or empty desired slug → fallback `{slug}-{stableSuffix(userId)}`; on USERNAME_TAKEN_VERIFIED, retry with suffix (max 5).

3. **Sync-handle aligns slug with handle**  
   `apps/web/src/app/api/x/sync-handle/route.ts`: after updating `profiles.twitter_username`, calls `claimSafeSlug`. On USERNAME_TAKEN_VERIFIED does not fail the sync; returns `ok` with `slug_claimed: false`, `reason: "USERNAME_TAKEN_VERIFIED"`.

4. **SEO: canonical and redirects**  
   - Canonical URL for profile page is always `https://linkary.xyz/{profiles.username}` (set in generateMetadata and used for alternates, openGraph.url, og image).
   - If segment matches `profiles.twitter_username` but not `profiles.username`, 301 (permanentRedirect) to `/{profiles.username}`.
   - Reserved segment renders app shell with `robots: { index: false, follow: false }`.

5. **Reserved route checklist and collision script**  
   `docs/RESERVED_ROUTES_CHECKLIST.md`: process for adding top-level routes. `apps/web/scripts/checkReservedCollisions.ts`: reads RESERVED_PATHS, queries usernames for matching slugs, exits 1 if collisions.

6. **Old slug redirect**  
   Migration `supabase/migrations/20260304000000_profile_slug_history.sql`: table `profile_slug_history(profile_id, old_slug, new_slug, changed_at)`; trigger on `profiles.username` update. In `(public)/[username]/page.tsx`, if segment matches no profile by username/twitter_username, lookup by `profile_slug_history.old_slug` and 301 to current `profiles.username`.

---

## QA checklist (post-implementation)

- [ ] **Reserved handle test:** Sign in with X handle that is a reserved word (e.g. "dashboard"). Expect Linkary slug to become `dashboard-xxxx` (or similar with stable suffix) and profile reachable at that URL.
- [ ] **Collision test:** Two users cannot claim the same slug; second gets USERNAME_TAKEN_VERIFIED or a suffixed slug. Sync-handle when handle is taken returns 200 with `slug_claimed: false`, `reason: "USERNAME_TAKEN_VERIFIED"`.
- [ ] **Alias redirect test:** Visit `/{twitter_username}` when it differs from `profiles.username`. Expect 301 to `/{profiles.username}`. Canonical in HTML/OG should be `/{profiles.username}`.
- [ ] **Canonical tag check:** View source on a profile page (and when accessed via twitter_username). Single canonical URL; no duplicate canonical for same profile.
- [ ] **Old slug redirect:** After changing slug (e.g. via claim or sync-handle), visit old slug URL. Expect 301 to new slug.
- [ ] **Reserved path noindex:** Visit a reserved first segment (e.g. `/dashboard`). If it hits the dynamic route (e.g. no static page), page has `robots: noindex,nofollow`.
- [ ] **assertReservedPaths:** Run `pnpm exec tsx apps/web/scripts/assertReservedPaths.ts` — exits 0. **checkReservedCollisions:** Run with DB env set — exits 0 when no collisions, 1 when reserved path is claimed.

---

*End of audit. Fixes implemented as above; no further code/schema changes in this doc.*
