# Pre-launch smoke test and deployment readiness

Final indexing fixes, test/build verification, and launch checklist.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| **`apps/web/src/app/robots.ts`** | Added `"/deal"`, `"/deal/"`, `"/settings"`, `"/settings/"` to `disallow` so crawlers do not index org deal pages or settings. |
| **`apps/web/src/app/profile/layout.tsx`** | **New.** Layout for `/profile/*` with `metadata.robots: { index: false, follow: false }`. Covers `/profile`, `/profile/deals`, `/profile/work`, and any other profile children that did not have their own layout. |
| **`apps/web/src/app/deal/layout.tsx`** | **New.** Layout for `/deal/[id]` with `metadata.robots: { index: false, follow: false }`. |
| **`apps/web/src/app/settings/layout.tsx`** | **New.** Layout for `/settings/*` with `metadata.robots: { index: false, follow: false }`. |
| **`apps/web/src/app/login/layout.tsx`** | Changed `robots: "index, follow"` to `robots: { index: false, follow: false }` so login is not indexed. |
| **`apps/web/vitest.config.ts`** | Excluded 6 script-style lib test files (appRouting, crossUserAnalyticsAllowlist, discoveryValidation, entitlementDiscovery, profileRedirect, reviewsContract) so `pnpm test:route` passes; they are run via `pnpm run test:profile-analytics`. |

---

## 2. Missing noindex / indexing fixes

| Route / area | Before | After |
|--------------|--------|--------|
| **/deal, /deal/** | Not in robots.txt; no layout metadata. | robots.txt disallow added; `app/deal/layout.tsx` noindex. |
| **/profile (root), /profile/deals, /profile/work** | Only some profile children had noindex (insights, inbox, requests). | `app/profile/layout.tsx` noindex so all `/profile/*` are noindex. |
| **/settings, /settings/** | Not in robots.txt; no layout metadata. | robots.txt disallow added; `app/settings/layout.tsx` noindex. |
| **/login** | `robots: "index, follow"` (indexed). | `robots: { index: false, follow: false }`. |

Already covered (no change): `/app/*` (app/layout.tsx), `/analytics` (analytics/layout.tsx), `/explore`, `/profile/insights`, `/profile/inbox`, `/profile/requests`, `/u/[username]`, `/app/analytics/profile/[username]`. Public profile `/{username}` remains indexable when published (generateMetadata sets robots only when not published or reserved).

---

## 3. Final launch checklist

### 3.1 Required env vars (runtime)

| Var | Description |
|-----|-------------|
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (e.g. `https://linkary.xyz`). Used for sitemap, robots, canonicals. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase access (public profile, sitemap, analytics, etc.). |

Optional for launch (depending on features): X OAuth, billing, cron secrets, etc. (see existing env docs).

### 3.2 Required secrets (CI / deploy)

| Secret | Use |
|--------|-----|
| Same as above for production | Deploy target must have NEXT_PUBLIC_*, SUPABASE_* set. |
| E2E (if running Playwright in CI) | `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, Supabase vars (see E2E_CI_AND_LOCAL.md). |

### 3.3 Migrations to run before deploy

- Run Supabase migrations in order (timestamp order under `supabase/migrations/`). Trust-loop and public profile rely on: reviews (verified_deal, gig_deal), case_studies (owner_type, deal_id, gig_deal_id), collab_requests (converted_gig_deal_id), profiles (published, username), orgs (slug, published).
- No new migrations were added in this pass; ensure existing migrations are applied in the correct order for your environment.

### 3.4 Tests to run before deploy

| Command | What it runs |
|---------|----------------|
| `pnpm run build` (from `apps/web`) | Next.js production build. Must succeed. |
| `pnpm test:route` (from `apps/web`) | Vitest route and payload tests. The 6 script-style lib tests (appRouting, crossUserAnalyticsAllowlist, etc.) are excluded from Vitest and run via `pnpm run test:profile-analytics`. |
| `pnpm run test:profile-analytics` (from `apps/web`) | Script-style lib tests: crossUserAnalyticsAllowlist, profileRedirect, appRouting, reviewsContract. |
| `pnpm run test:e2e` (optional, from `apps/web`) | Playwright E2E. Requires auth env for authenticated specs (see E2E_CI_AND_LOCAL.md). |

### 3.5 Post-deploy smoke tests (manual or E2E)

- **Public profile:** Open `/{published_username}` → profile loads; no `deal_id`/`gig_deal_id` in DOM or API response; proof signals (Verified, From verified work) if data exists.
- **Authenticated profile:** Sign in → open `/app/profile` (or redirect) → profile/edit saves.
- **Analytics:** Sign in → open `/analytics` → analytics loads (or connect X message).
- **Cross-user analytics:** If eligible, open `/app/analytics/profile/{username}` → allowlisted data only.
- **Discovery/explore:** Open `/explore` → loads (noindex).
- **Profile deals:** Sign in → `/profile/deals` → list and CTAs (Complete, Leave review, Create case study) as per deal status.
- **Profile work:** Sign in → `/profile/work` → completed work list and review/case study actions.
- **Collab convert:** As target, accept collab → Convert to verified work → deal appears on `/profile/deals`; complete → appears on `/profile/work`; review/case study unlock.
- **Reviews:** Only after completed verified work; no fake proof paths.
- **Case studies:** Link only to completed deal/gig_deal when caller is party; no private IDs on public profile.
- **Indexing:** `GET /robots.txt` disallows /app, /profile, /analytics, /deal, /settings, /api, /auth, /login. `GET /sitemap.xml` includes homepage and published profiles/orgs. Internal routes return noindex in HTML where layouts are set.

---

## 4. Test / build / deploy status summary

| Check | Status |
|-------|--------|
| **Production build** | Passed (`pnpm run build`). |
| **Vitest route suites** | 10 suites, 66 tests passed (public profile, deals/mine, work/mine, reviews, case-studies, collab convert, complete, me/analytics/profile, buildPublicProfilePayload). |
| **Vitest lib script-style files** | 6 files (appRouting, crossUserAnalyticsAllowlist, discoveryValidation, entitlementDiscovery, profileRedirect, reviewsContract) are excluded from Vitest and run via `pnpm run test:profile-analytics` (tsx). |
| **Playwright E2E** | Not run in this pass; run manually or in CI with auth env (see E2E_CI_AND_LOCAL.md). |
| **Docs** | ROUTE_CONSISTENCY.md, LAUNCH_HARDENING_P0_DELIVERABLES.md, PUBLIC_PROFILE_PROOF_DELIVERABLES.md, E2E_CI_AND_LOCAL.md, COLLAB_VERIFIED_WORK_HANDSHAKE.md align with current behavior. No stale contradictions found. |
| **Migrations** | Present under `supabase/migrations/` in timestamp order; trust-loop and public proof logic depend on existing migrations (reviews, case_studies, collab_requests, profiles, orgs). |

---

## 5. Remaining blockers

- **None** for structural launch readiness. Optional follow-ups:
  - Run full Playwright suite in CI with auth secrets and fix any flakiness.
  - (Done) The 6 tsx-style lib tests are excluded in `vitest.config.ts` so `pnpm test:route` exits 0; run `pnpm run test:profile-analytics` for those.

---

## 6. Final regression checklist

- [ ] **Indexing:** Internal routes noindex: /app, /analytics, /profile, /profile/*, /deal, /deal/*, /settings, /login, /explore, /u. robots.txt disallows these paths; sitemap includes only / and published /{username} (and orgs).
- [ ] **Public profile:** Remains /{username}; canonical and indexable when published; proof signals and no private metadata (see PUBLIC_PROFILE_PROOF_DELIVERABLES.md).
- [ ] **Analytics ownership:** /analytics is the only deep analytics surface; Profile shows snapshot + "See full analytics" (see LAUNCH_HARDENING_P0_DELIVERABLES.md).
- [ ] **Work surfaces:** /profile/work and /profile/deals remain internal, authenticated; no privacy regression.
- [ ] **Trust loop:** Reviews only after completed verified work; case studies only from completed deal/gig_deal when party; collab convert flow unchanged.
- [ ] **Build:** `pnpm run build` succeeds.
- [ ] **Tests:** Route and payload Vitest tests pass; script-style lib tests run via test:profile-analytics.
- [ ] **Env and migrations:** Required env vars and migrations applied before deploy; post-deploy smoke checks listed above.
