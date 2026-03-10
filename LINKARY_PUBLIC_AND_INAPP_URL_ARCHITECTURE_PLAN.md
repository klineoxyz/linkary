# Linkary: Public and In-App URL Architecture & Migration Plan

**Document purpose:** Senior routing and URL architecture audit plus a backward-compatible migration plan for a dual-profile URL system.  
**Constraints:** Preserve clean public profile URLs; move app pages under `/app/...`; keep `/u/:username` as authenticated in-app profile route; do not break frontend, backend, SEO, auth, or privacy.

---

## 1. Current Route Map

### 1.1 Next.js App Router Structure (apps/web/src/app)

| Path pattern | File(s) | Purpose |
|--------------|--------|---------|
| `/` | `page.tsx` | Landing |
| `/app` | `app/page.tsx` | Redirects to `/` (stub) |
| `/:segment` (catch-all) | `(public)/[username]/page.tsx` | Public profile (user or org) **or** reserved → SPA |
| `/u/[username]` | `u/[username]/page.tsx` | In-app user profile (auth-gated; falls back to public view) |
| `/u/[username]/insights` | `u/[username]/insights/page.tsx` | User insights (auth) |
| `/org/[orgId]` | `org/[orgId]/page.tsx` | Org detail (in-app; UUID) |
| `/deal/[id]` | `deal/[id]/page.tsx` | Deal detail |
| `/auth/callback` | `auth/callback/page.tsx` | OAuth callback |
| `/login` | `login/page.tsx` | Login |
| `/dashboard` | `dashboard/page.tsx` | Dashboard |
| `/overview` | `overview/page.tsx` | Overview |
| `/analytics` | `analytics/page.tsx` | Analytics |
| `/profile` | `profile/page.tsx` | My profile |
| `/profile/edit` | `profile/edit/page.tsx` | Profile edit |
| `/profile/insights` | `profile/insights/page.tsx` | My profile insights |
| `/profile/dashboard` | `profile/dashboard/page.tsx` | Redirects → `/analytics` |
| `/profile/deals` | `profile/deals/page.tsx` | My deals |
| `/profile/applications` | `profile/applications/page.tsx` | My applications |
| `/profile/inbox` | `profile/inbox/page.tsx` | Redirects → `/work/requests?tab=inbox` |
| `/profile/requests` | `profile/requests/page.tsx` | Redirects → `/work/requests?tab=sent` |
| `/settings/*` | `settings/...` | Integrations, wallet, roles-skills |
| `/work/requests` | `work/requests/page.tsx` | Collab requests (inbox/sent) |
| `/explore` | `explore/page.tsx` | Explore |
| `/market`, `/messages`, `/circles`, `/verification`, `/verification-inbox` | … | Product pages |
| `/pricing`, `/billing`, `/plans` | … | Monetization |
| `/onboarding`, `/home`, `/leaderboards`, `/creator`, `/brand`, `/agency`, `/host` | … | Various |
| `/availability`, `/monetization`, `/monetization-flow`, `/kol-lists`, `/capital-partners` | … | Various |
| `/connections`, `/preferences`, `/support`, `/notifications`, `/showcase` | … | Various |
| `/watchlist` | `watchlist/page.tsx` | Watchlist |
| `/xspaces` | `xspaces/page.tsx` | X Spaces (calendar redirect target) |
| `/calendar` | `calendar/page.tsx` | 308 → `/xspaces` |
| `/terms`, `/privacy-policy`, `/privacy` | … | Legal |
| `/(internal)/ops` | `(internal)/ops/page.tsx` | Internal ops |
| `/test-supabase`, `/debug/*` | … | Dev/debug |

### 1.2 How `/:segment` (public catch-all) behaves

- **Reserved segment** (see `RESERVED_PATHS` in `@/lib/reservedPaths`): Renders `<AppWithProviders />` (client SPA). The SPA’s `routeFromPathname()` maps the path to the correct app screen (e.g. `dashboard` → dashboard).
- **Non-reserved segment:** Resolved via `getPublicEntityByUsername(segment)`:
  - **Profile first:** `profiles.username` or `profiles.twitter_username` (ilike).
  - **Then org:** `orgs.slug` (ilike).
  - If **profile** found (and published or viewer is owner): Public profile page.
  - If **org** found: Public org one-pager (`PublicOnePagerWrapper`).
  - If **slug history** match: 301 to current `profiles.username`.
  - If **reserved** (after no entity): Render `AppWithProviders`.
  - Else: `NotFoundClaimView` (claim/404).

So **both public users and public orgs live at root** `/:segment`. **Profile wins over org** when the same slug exists for both.

### 1.3 Key URL touchpoints (non-exhaustive)

| Location | URL pattern / behavior |
|----------|-------------------------|
| **Middleware** (`middleware.ts`) | www → apex 308; `/@username` → `/:username` 301 |
| **Reserved paths** | `@/lib/reservedPaths.ts` — first-segment blocklist; used by (public)/[username], App.tsx `routeFromPathname`, claim/safeSlug |
| **Sitemap** (`sitemap.ts`) | Homepage + `/{username}` (profiles) + `/{slug}` (orgs) — both at root |
| **Robots** (`robots.ts`) | Disallow: `/profile`, `/dashboard`, `/analytics`, `/u`, `/api`, `/auth`, `/login` |
| **Search API** (`api/search/route.ts`) | People → `/u/:username`; Orgs → `/:slug` |
| **App.tsx** `pathFromRoute` / `routeFromPathname` | All app routes (dashboard, profile, org, deal, work/requests, etc.); `userProfile` → `/:handle`; `userInsights` → `/u/:handle/insights`; `orgDetail` → `/org/:orgId` |
| **Public profile CTA** | “View insights” → `/u/:username/insights` (`StarterBlock.tsx`, `ActionBar.tsx`) |
| **Profile edit** | “View public profile” → `/{username}` (root) |
| **Org share** | `OrgDetailPage` → `/org/:org.id` (UUID) |
| **Notifications** | Deal → `/deal/:id`; Org jobs/ambassadors/affiliates → `/org/:id?tab=...` |
| **Auth callback** | Default next: `/settings/integrations`; uses `safe-redirect-url` for `next` |
| **Collab email** | “View request” → `/profile/inbox` (which redirects to `/work/requests?tab=inbox`) |
| **ApplyToGigButton** | Login redirect: `?redirect=.../{username}` (public root); “My Applications” → `/profile/applications` |
| **Deal page** | “Back” → `/` |
| **Canonical (public page)** | `(public)/[username]/page.tsx` — `alternates.canonical` = `canonicalBaseUrl()/:canonicalSlug` (profile username or org slug) |
| **OG/API** | `api/og?username=...` uses canonical slug |

### 1.4 Backend / API assumptions

- **Public profile API:** `api/public/profile?username=...` — resolves profile (and possibly org) by slug; used by `/u/[username]` when not owner.
- **Entity resolver:** `getPublicEntityByUsername` (profile then org) is the single resolution order for root `/:segment`.
- **Org routes:** Backend and frontend use **org UUID** at `/org/[orgId]`, not slug. Public org **landing** is at root `/:slug`; in-app org **detail** is `/org/:orgId`.

---

## 2. Collision Risks

### 2.1 Root namespace today

- **One shared root namespace:** `/:segment` serves both public **profiles** (username / twitter_username) and public **orgs** (slug).
- **Resolution order:** Profile (username, then twitter_username) **then** org (slug). So if `profiles.username = 'acme'` and `orgs.slug = 'acme'`, `linkary.xyz/acme` shows the **user**.
- **Collision:** A user can “take” a slug that an org might want (or vice versa). No technical block today; product/process must decide who gets a slug when both want it.

### 2.2 Reserved paths

- **First segment** only: e.g. `dashboard`, `u`, `org`, `profile`, `app`, etc. If a profile or org had username/slug `dashboard`, they would never be reachable at root because `(public)/[username]` would render the app for that segment (reserved).
- **Script:** `scripts/checkReservedCollisions.ts` checks `usernames` table (and owner_type) against `RESERVED_PATHS`; run before adding new top-level routes.

### 2.3 After moving app pages to `/app/...`

- **New reserved segment:** `app`. Anything under `/app/...` is no longer a profile/org. No new root-level collision with users/orgs.
- **Existing risk unchanged:** User vs org at same root slug remains; resolution order (profile first) is unchanged unless we change it.

---

## 3. Recommended Final Architecture

### 3.1 Target URL model

| Purpose | URL | Canonical? | Auth | Notes |
|--------|-----|------------|------|-------|
| Public user profile | `/:username` | Yes | No | SEO, share, discovery |
| Public org/project profile | `/:slug` **or** `/org/:slug` (see 3.2) | Yes | No | SEO, share |
| In-app user profile (deeper analytics) | `/u/:username` | No (noindex) | Yes (then permissions) | Deeper analytics; search-from-app → here |
| App shell (dashboard, settings, etc.) | `/app/dashboard`, `/app/overview`, `/app/analytics`, `/app/settings`, `/app/profile`, … | N/A | Yes | Product UI |
| Org detail (in-app) | `/org/:id` (UUID) or `/org/:slug` (if migrated) | N/A | Yes | Keep or move to slug (see 3.2) |
| Deal detail | `/deal/:id` | As today | Mixed | No change |
| Auth / login | `/login`, `/auth/callback` | N/A | - | No change |

### 3.2 Root-level namespace strategy — founder decision

**Can both public users and public orgs safely stay at root?**

- **Technically yes:** Current design already supports it (profile then org). No required code change for “both at root.”
- **Product risk:** Same slug for a user and an org → user always wins. Orgs cannot have a root slug that a profile has claimed. That may be acceptable if you enforce “no duplicate slugs across users and orgs” (e.g. org slug must not match any profile username/twitter_username).

**Recommendation (safest long-term production model):**

- **Option A — Keep both at root (shared namespace):**  
  - **Rule:** Enforce globally unique “slug” for discovery: no org slug equal to any profile username or twitter_username (and ideally one namespace table or validation at create/update).  
  - **Pros:** Cleanest public URLs; no redirects.  
  - **Cons:** Requires product/DB policy and possibly migration to resolve existing collisions.

- **Option B — Users at root, orgs under `/org/:slug` (recommended default):**  
  - **Public user:** `/:username` (unchanged).  
  - **Public org:** `/org/:slug` (new). In-app org detail can stay `/org/:id` (UUID) or become `/org/:slug` and redirect UUID→slug.  
  - **Pros:** No user/org slug collision at root; clear semantics; orgs get a stable, shareable `/org/desicryptoclub`.  
  - **Cons:** Public org URLs change from `/:slug` to `/org/:slug` — need 301s and sitemap/OG/canonical updates.

**Founder recommendation (explicit answer):**

- **If you want zero collision risk and clearest semantics:** Use **users at root, orgs at `/org/:slug`**. Public user stays `/:username`; public org becomes `/org/:slug`; in-app org can remain `/org/:id` with optional redirect from slug.  
- **If you prefer one shared root and will enforce unique slugs:** Keep **both at root** and add strict validation so no org slug equals any profile username/twitter_username.

This document assumes **Option B** for the migration plan (orgs → `/org/:slug` for public) so that the “safest long-term production model” is clearly defined. If you choose Option A, the same plan applies except: no org URL move; only add `/app/...` and keep `/u/:username` behavior.

### 3.3 Public vs authenticated profile strategy

- **`/:username` (public):**  
  - Only public profile surface (no auth-gated analytics).  
  - Canonical, indexable, OG/canonical tags.  
  - Same for `/:slug` (if orgs stay at root) or `/org/:slug` (if orgs move).

- **`/u/:username`:**  
  - Auth required; otherwise redirect to `/login?next=/u/:username` or, when appropriate, to `/:username` for public view.  
  - When authenticated: owner sees full preview; non-owner sees public view + optional “deeper” analytics where permissions allow.  
  - **Non-canonical:** `robots: noindex,nofollow` (already in place).  
  - **Search (in-app):** When intent is “in-app profile analysis,” link to `/u/:username`. Public discovery and external links keep using `/:username`.

### 3.4 Reserved paths strategy (after migration)

- **Reserved first segment (root):**  
  - Keep: `api`, `auth`, `login`, `u`, `org`, `deal`, `app`, `profile`, `dashboard`, `settings`, `analytics`, … (current list).  
  - Add: `app` (so `/app/...` is never treated as profile/org).  
  - Run `checkReservedCollisions` after any new top-level segment; consider extending to org slugs if orgs move to `/org/:slug`.

- **Under `/app/`:** No reserved “second segment” list needed initially; all `/app/*` are app pages. Add to reserved list only if you introduce another dynamic segment at root.

### 3.5 Canonical and redirect strategy

- **Public profile `/:username`:**  
  - Canonical = `canonicalBaseUrl()/:canonicalUsername` (e.g. `profiles.username`; alias like twitter_username 301 to username).  
  - No canonical to `/u/:username` (in-app is not the canonical URL).

- **Public org:**  
  - If orgs stay at root: canonical = `/:slug`; 301 from any alias if you add org aliases later.  
  - If orgs move to `/org/:slug`: canonical = `/org/:slug`; 301 from old `/:slug` to `/org/:slug` for a defined period.

- **`/u/:username`:**  
  - Never set as canonical for the public profile.  
  - Optional: 301 from `/u/:username` to `/:username` for unauthenticated requests (so shared links normalize to public URL). Decide per product.

- **App pages:**  
  - After migration: `/dashboard` → 301 to `/app/dashboard` (and same for all moved routes).  
  - Or: keep both and make `/app/...` canonical (then eventually drop old paths). Prefer 301 from old to new for SEO.

- **Sitemap:**  
  - Only include public, indexable URLs: `/`, `/:username` (profiles), and either `/:slug` (orgs) or `/org/:slug` (orgs).  
  - Exclude `/u/`, `/app/`, `/org/:uuid` (in-app), `/deal/` if not public, etc.

---

## 4. Migration Risks (concise)

| Risk | Mitigation |
|------|------------|
| Broken internal nav | Update `pathFromRoute` / `routeFromPathname` and every `href`/`router.push` to `/app/...` in one pass or behind feature flag. |
| Broken search results | Search API: keep people → `/u/:username`, orgs → `/:slug` or `/org/:slug`; update any links that should point to app to `/app/...`. |
| Broken public profile | Do not change resolution order or reserved logic for `/:segment` until `/app/...` is live; then add `app` to reserved only. |
| Broken SEO/canonicals | Keep canonical on public pages; add 301 from old app paths to `/app/...`; update sitemap to new paths only. |
| Broken auth redirects | Keep `safe-redirect-url` and callback; ensure `next` can be `/app/...`; allowlist unchanged. |
| Broken analytics visibility / privacy | Keep public page data-only public; keep deeper analytics behind auth and only on `/u/:username` (and permissions). |
| Notifications / emails | Update notification link builder to `/app/...` and `/org/:id` or `/org/:slug`; collab email: keep `/profile/inbox` or point to `/app/...` with redirect. |
| Reviews / case studies / org pages / jobs / deal pages | All links to app or org or deal: update to new paths; deal can stay `/deal/:id`. |
| Watchlist / dashboard cards | Update all internal links to `/app/...` and profile/org URLs per new policy. |
| Middleware / sitemap / robots / reserved | Middleware: no change for www/@; sitemap: add `/org/:slug` if orgs move, remove root org entries; robots: add `/app/` to disallow if desired; reserved: add `app`. |
| Public vs private visibility | Keep public route strictly public; keep `/u/:username` and `/app/*` behind auth and permission checks. |

---

## 5. Phased Migration Plan

### Phase 1 — No-breaking-change prep

- Confirm `app` is in `RESERVED_PATHS` (already present) so no one can claim username/slug `app`.
- Document all `pathFromRoute` / `routeFromPathname` and every internal link (nav, notifications, emails, search, cards) in a checklist.
- If moving orgs to `/org/:slug`: add DB/index for org slug; add redirect map or logic for `/:slug` → `/org/:slug` for org-only slugs (no change yet, just design).
- Run `checkReservedCollisions`; fix any collision before adding `app` routes.

**Deliverable:** Reserved list updated; link audit checklist; optional org redirect design.

### Phase 2 — Create `/app/` routes

- Create route group or flat structure under `app/`: e.g. `app/(app)/dashboard/page.tsx`, `app/(app)/overview/page.tsx`, … (or `app/app/dashboard/page.tsx`).
- Each new page: same component as current root page (e.g. re-export or move component). No URL change for users yet; new routes are reachable only by direct URL.
- Ensure `routeFromPathname` recognizes `/app/dashboard`, `/app/overview`, etc., and `pathFromRoute` can generate `/app/...` when a feature flag or config is set (e.g. `USE_APP_PREFIX=true`).

**Deliverable:** All current app pages available under `/app/...`; SPA route sync supports both old and new paths.

### Phase 3 — Define public root profile behavior (no URL change)

- Confirm `/:username` only shows public profile surface (no auth-gated analytics). No code change if already true.
- Confirm `/:slug` for org (if still at root) or prepare `/org/:slug` handler and canonical/OG. If orgs move: implement `/org/:slug` page and 301 from `/:slug` for known org slugs (or do in Phase 6).

**Deliverable:** Written contract: public root = public-only content; in-app = `/u` or `/app`.

### Phase 4 — Define `/u/:username` authenticated profile behavior

- Ensure `/u/:username` requires auth; redirect to login with `next=/u/:username`; after login, permission-based “deeper” analytics only where allowed.
- Keep metadata `noindex,nofollow` for `/u/*`.
- Search (in-app): keep returning `/u/:username` for “person” results when the intent is in-app analysis. External/share links remain `/:username`.

**Deliverable:** Clear behavior: `/u` = auth + optional deeper analytics; public = `/:username`.

### Phase 5 — Migrate internal links and search behavior

- Flip config so `pathFromRoute` generates `/app/dashboard`, `/app/overview`, etc., and `routeFromPathname` treats `/app/...` as app routes.
- Replace all internal `href`/`router.push` from `/dashboard`, `/profile`, … to `/app/dashboard`, `/app/profile`, …
- Update notification/email link builder to `/app/...` (and `/org/:slug` if applicable). Collab email: use `/app/...` for inbox or keep `/profile/inbox` with redirect to `/app/...` or `/work/requests`.
- Search: keep people → `/u/:username`, orgs → `/:slug` or `/org/:slug`. No change unless you want “open in app” to point to `/u/:username` and “open in app” for org to `/org/:id` or `/org/:slug`.
- Add redirects (Phase 6) so old URLs still work.

**Deliverable:** All internal navigation and notifications use new paths; old paths still work via redirects.

### Phase 6 — Redirect compatibility and canonical cleanup

- Add Next.js redirects (or middleware): `/dashboard` → `/app/dashboard`, `/profile` → `/app/profile`, … (301).
- If orgs moved to `/org/:slug`: 301 `/:slug` → `/org/:slug` for slugs that are org-only (and not profile); update sitemap and canonical for orgs to `/org/:slug`.
- Sitemap: list only public URLs (`/`, `/:username`, and `/org/:slug` if applicable); remove any listing of `/u/` or app pages.
- Robots: optionally disallow `/app/` (or allow; your choice). Keep disallow for `/u/`, `/profile`, etc. as today.

**Deliverable:** Old app URLs 301 to `/app/...`; public canonicals and sitemap correct; noindex for `/u/` and app if desired.

### Phase 7 — Cleanup

- Remove duplicate page components at root (e.g. `dashboard/page.tsx`) and keep only redirects or a single redirect layer so all app UI lives under `/app/...`.
- Optionally remove redirects after a long tail period (e.g. 6–12 months) and 404 old paths.
- Update any external docs, help, or marketing to use `/:username`, `/org/:slug`, `/app/...`, `/u/:username`.

**Deliverable:** Single source of truth for app pages under `/app/...`; optional removal of legacy redirects later.

---

## 6. What to Change Now vs Later

### Safe to do now (low risk)

- **`app` is already in `RESERVED_PATHS`** — no change needed; the segment `app` cannot be claimed as a username or org slug. Verify and document.
- **Document** all route → path and path → route mappings and link touchpoints (this doc + internal checklist).
- **Run** `scripts/checkReservedCollisions.ts` and fix any collisions.

### Do not do in one pass (high risk)

- Moving all app pages to `/app/...` and removing root copies without Phase 2–6 (redirects and internal link updates) will break bookmarks, notifications, and emails.
- Changing resolution order for `/:segment` (e.g. org before profile) without product/DB rules can break existing links and expectations.
- Removing `/u/:username` or changing it to canonical would break “in-app only” analytics and noindex semantics.

### Do later (with migration)

- Create `/app/*` pages and switch internal links (Phases 2, 5).
- Add 301 from old app paths to `/app/...` (Phase 6).
- If moving orgs: implement `/org/:slug`, 301 from `/:slug`, and sitemap/canonical updates (Phases 3, 6).

---

## 7. Founder Recommendation Summary

- **Dual-profile URL system:**  
  - **Public:** `/:username` (user), `/:slug` or `/org/:slug` (org).  
  - **In-app user:** `/u/:username` (auth; optional deeper analytics; noindex).  
  - **App shell:** `/app/dashboard`, `/app/overview`, `/app/analytics`, `/app/settings`, `/app/profile`, etc.

- **Can both public users and public orgs stay at root?**  
  - **Yes**, if you enforce a single global namespace (no org slug = any profile username/twitter_username).  
  - **Safest and clearest:** **Users at root `/:username`; orgs at `/org/:slug`.** That avoids collisions and keeps semantics clear. Public org URLs become `/org/desicryptoclub` with 301 from old `/:slug` for a transition period.

- **Order of operations:**  
  1. Reserve `app`; audit links.  
  2. Add `/app/...` routes and SPA sync.  
  3. Keep public root behavior strict (public-only).  
  4. Keep `/u/:username` auth-only and noindex.  
  5. Migrate internal links and notifications to `/app/...` (and `/org/:slug` if applicable).  
  6. Add 301s and canonical/sitemap/robots cleanup.  
  7. Remove duplicate root app pages.

- **Implementation:** Only **Phase 1 (prep)** is recommended as “implement now”: add `app` to `RESERVED_PATHS` and run the collision script. Full migration should follow the phases above with testing at each step.

---

*End of document.*
