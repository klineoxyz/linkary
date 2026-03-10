# Linkary: Final URL Architecture & Global Namespace Plan

**Document purpose:** Implementation plan for the founder-approved final URL model with a **single global namespace** (no user and no org may share the same name/slug), backward-compatible migration, and safe foundation work only.  
**Critical product rule:** Collisions are impossible by design; one shared namespace is enforced permanently everywhere (DB, API, UI).

---

## 1. Current Route Map & Dependencies

### 1.1 Next.js App Router (apps/web/src/app)

| Path | File(s) | Purpose |
|------|--------|---------|
| `/` | `page.tsx` | Landing |
| `/app` | `app/page.tsx` | Redirects to `/` |
| `/:segment` | `(public)/[username]/page.tsx` | Public profile (user or org) or reserved → SPA |
| `/u/[username]` | `u/[username]/page.tsx` | In-app user profile (auth; falls back to public) |
| `/u/[username]/insights` | `u/[username]/insights/page.tsx` | User insights (auth) |
| `/org/[orgId]` | `org/[orgId]/page.tsx` | In-app org detail (**UUID**; not slug) |
| `/deal/[id]` | `deal/[id]/page.tsx` | Deal detail |
| `/auth/callback`, `/login` | … | Auth |
| `/dashboard`, `/overview`, `/analytics`, `/profile`, `/settings/*`, `/work/requests`, … | … | Product pages at **root** |

### 1.2 URL touchpoints (concise)

| Area | Current behavior |
|------|------------------|
| **Middleware** | www → apex 308; `/@x` → `/x` 301 |
| **Reserved paths** | `RESERVED_PATHS`; (public)/[username] and App.tsx use it |
| **Public resolver** | `getPublicEntityByUsername(segment)`: **profile** (username, twitter_username) **then org** (slug). Profile wins if both match. |
| **Sitemap** | Homepage + `/{username}` (profiles) + `/{slug}` (orgs) at root |
| **Robots** | Disallow `/profile`, `/dashboard`, `/analytics`, `/u`, `/api`, `/auth`, `/login` |
| **Search API** | People → `/u/:username`; Orgs → `/:slug` |
| **App.tsx** | `pathFromRoute` / `routeFromPathname`: orgDetail → `/org/:orgId` (UUID); userProfile → `/:handle`; userInsights → `/u/:handle/insights` |
| **Org share** | `OrgDetailPage`: share URL = `/org/${org.id}` (UUID) |
| **Notifications** | Deal → `/deal/:id`; Org → `/org/:id?tab=...` (UUID) |
| **Collab email** | “View request” → `/profile/inbox` (redirects to `/work/requests?tab=inbox`) |
| **Canonical (public)** | `(public)/[username]`: canonical = `baseUrl()/:canonicalSlug` (profile username or org slug) |

### 1.3 Backend / namespace today

- **usernames table:** Single namespace; `username` UNIQUE; `owner_type` ('profile' | 'org'), `owner_id`. Used by `claim_username_for_profile` and `claim_username_for_org`.
- **Profile claims:** Go through `claim_username_for_profile` → insert/update usernames + denormalize to `profiles.username`.
- **Org creation:** `create_org_and_membership` RPC **does not** use usernames table. It only checks `orgs` for slug uniqueness (`WHILE EXISTS (SELECT 1 FROM public.orgs WHERE LOWER(slug) = candidate_slug)`). So an org can get a slug that a profile already has.
- **Org slug update:** `updateOrg(orgId, { slug })` in app; DB has no hook that writes to usernames. `claim_username_for_org` exists but is not called from create or from a central update path.
- **checkSlugAvailable (org UI):** Only checks `orgs` table, not `profiles` or `usernames`.
- **Resolver:** `getPublicEntityByUsername` queries profiles (username, twitter_username) and orgs (slug) in parallel; **profile wins** if both exist. Not collision-proof at write time.

**Gap:** Global namespace is only enforced for profile claims. Org create/update can create collisions with profile usernames. Resolver is deterministic (profile first) but collisions are not “impossible by design.”

---

## 2. Founder-Approved Final Route Architecture

### 2.1 URL model

| Purpose | URL | Canonical? | Auth | Index |
|--------|-----|------------|------|-------|
| Public user profile | `/:username` | Yes | No | Yes |
| Public org profile | `/:slug` | Yes | No | Yes |
| In-app user profile / analytics | `/u/:username` | No | Yes | No |
| In-app org profile / analytics | `/org/:slug` | No | Yes | No |
| App shell | `/app/dashboard`, `/app/overview`, `/app/analytics`, `/app/settings`, `/app/profile`, … | N/A | Yes | No |
| Deal | `/deal/:id` | As today | Mixed | Per policy |
| Auth | `/login`, `/auth/callback` | N/A | - | No |

### 2.2 Public vs in-app routing rules

1. **Public routes**
   - `/:username` → public **user** profile only (canonical, indexable; no auth-gated analytics).
   - `/:slug` → public **org** profile only (canonical, indexable; no auth-gated analytics).
   - Resolution of `/:segment` must be **deterministic and collision-free**: one segment = one owner (profile or org) via single global namespace.

2. **In-app user**
   - `/u/:username` → authenticated in-app user profile; may show deeper analytics / auth-gated data by permissions/payment.
   - Non-canonical, noindex.

3. **In-app org**
   - `/org/:slug` → authenticated in-app org profile; may show deeper org analytics / auth-gated data.
   - Non-canonical, noindex where appropriate.
   - **Migration:** Current links use `/org/:orgId` (UUID). New links use `/org/:slug`; old `/org/:id` can 301 to `/org/:slug` when slug is known.

4. **Search**
   - Public discovery / share: users → `/:username`, orgs → `/:slug`.
   - In-app (analysis intent): users → `/u/:username`, orgs → `/org/:slug`.

5. **App shell**
   - Product pages move under `/app/...`; root-level app routes eventually redirect to `/app/...`.

### 2.3 Canonical, noindex, sitemap

- **Canonical:** Public pages only. `/:username` and `/:slug` get `alternates.canonical` = `baseUrl()/:segment`. `/u/*` and `/org/*` (in-app) do **not** set canonical to themselves; they are noindex.
- **Noindex:** `/u/:username`, `/org/:slug` (in-app), `/app/*`, `/login`, `/dashboard`, etc. as today.
- **Sitemap:** Include only public indexable URLs: `/`, `/:username` (profiles), `/:slug` (orgs). Exclude `/u/`, `/org/` (or list only if you ever make public org pages at `/org/:slug` — per model public org is at root `/:slug`), `/app/`, `/deal/` (unless public), `/login`, etc.

---

## 3. Global Namespace Enforcement Strategy

**Goal:** No user and no org may ever share the same name/slug. One global namespace enforced at DB, API, and UI.

### 3.1 Source of truth: usernames table

- **usernames** is the single source of truth: one row per claimed slug; `owner_type` ('profile' | 'org'), `owner_id` (profile id or org id).
- **Normalization:** All slugs stored and compared in normalized form (lowercase, trim, strip @, allowed chars e.g. `[a-z0-9-]`). Use same `normalize_username` (or equivalent) everywhere.
- **Uniqueness:** Table already has `UNIQUE(username)`. For case-insensitivity, application (and RPCs) always insert/query normalized value; consider a unique index on `LOWER(username)` if not already sufficient to prevent duplicates (e.g. “Acme” vs “acme”).

### 3.2 DB / RPC layer

1. **Org creation**
   - **Change:** `create_org_and_membership` must:
     - Normalize desired slug.
     - **Check usernames** (and optionally profiles/orgs) for that normalized slug. If taken by another profile or org → fail or suffix (product choice: prefer fail with clear error).
     - If free: insert into **usernames** (owner_type = 'org', owner_id = new org id) and set **orgs.slug** to that value. Do not only check `orgs` table.
   - **Alternative:** Do not assign slug in create; require a follow-up call to `claim_username_for_org(desired_slug, org_id)` so all claims go through the same RPC. Then create inserts org with a placeholder slug (e.g. `org-<uuid>`); first “claim” sets real slug and usernames row.

2. **Org slug update**
   - All org slug changes must go through `claim_username_for_org(desired_slug, org_id)` (or an RPC that updates usernames + orgs.slug in one transaction). Direct `UPDATE orgs SET slug = ...` must be forbidden or trigger a sync to usernames (prefer RPC-only path).

3. **Profile username**
   - Already goes through `claim_username_for_profile`. No change; ensure it continues to write usernames + profiles.username.

4. **Constraints**
   - Keep `usernames.username` UNIQUE.
   - Optionally: trigger or check that `profiles.username` and `orgs.slug` always exist in usernames (denormalized copy). Backfill script can ensure existing data is in usernames before enforcing.

### 3.3 API validation

- **POST /api/orgs/create:** Before or inside RPC, validate desired slug: reserved path check + **global availability** (query usernames by normalized slug). Return 400 with clear code (e.g. `SLUG_TAKEN`) if taken.
- **Org slug update (e.g. PATCH org or dedicated endpoint):** Call `claim_username_for_org` or equivalent; return 400 if RPC raises (e.g. USERNAME_TAKEN_VERIFIED).
- **Profile username claim (onboarding, X sync, etc.):** Already use claim RPC; keep and ensure reserved + usernames check.

### 3.4 UI validation

- **Org create (CreateOrgModal):** `checkSlugAvailable` must check **global** namespace (usernames table, or an API that checks usernames + reserved). Today it only checks orgs → extend to “taken by profile or org.”
- **Profile edit / username field:** Already validated via claim; ensure reserved list and “taken” message include “taken by an org” when applicable.
- **Org settings (slug edit):** Before submit, check availability (usernames / API); on submit call API that uses claim_username_for_org.

### 3.5 Resolver: deterministic and collision-free

- **Option A (recommended):** Resolve `/:segment` **only from usernames table**.
  - Query: `SELECT owner_type, owner_id FROM usernames WHERE username = normalized(segment) LIMIT 1`.
  - If not found → 404/claim.
  - If profile → load public profile by owner_id; if org → load public org by owner_id. No “profile first then org” — single row in usernames defines owner. Collisions are impossible because there is only one row per slug.
- **Option B:** Keep profile-then-org resolution but **guarantee at write time** that no slug exists in both. Then resolver stays “profile then org” but collisions never occur. Requires all writes (profile and org) to go through usernames; org create/update must use usernames (as above).

Recommendation: **Option A**. Use usernames as the only lookup for `/:segment` so that resolution is deterministic and the same code path cannot see both a profile and an org for the same segment.

### 3.6 Migration audit for existing collisions

- **Script:** For each normalized slug that appears in both `profiles` (username or twitter_username) and `orgs` (slug), or that appears in usernames for both owner_types, list collisions.
- **Resolution:** Product decision per row: reassign one (e.g. org gets org-xxx suffix) or merge. Then backfill usernames so every profile username and every org slug has exactly one usernames row; no duplicate slugs across owner_type. After that, enforce create/update to use usernames only.

### 3.7 Slug history and redirects

- **profile_slug_history:** Keep for 301 from old profile username to current. When resolving `/:segment`, if usernames miss but profile_slug_history has old_slug → 301 to current username (then current username must be in usernames).
- **Orgs:** If you ever support org slug history, same idea. No org slug history in codebase today.

### 3.8 Reserved paths

- Reserved first-segment list remains; no profile/org can claim a reserved segment. Check reserved in usernames RPCs and in API/UI before claiming.
- **Case-insensitive:** Reserved check and namespace checks use same normalized form (lowercase).

### 3.9 twitter_username / aliases

- Public **canonical** URL is by `profiles.username` (or org slug). `twitter_username` can still be used to **match** a profile for resolution; if you resolve via usernames only, then usernames holds the single canonical slug and you may still have “alias” redirects: e.g. request with segment = twitter_username → lookup profile by twitter_username → 301 to `/:profiles.username`. So: usernames table = canonical slug; twitter_username can be an alias that redirects to that slug.

---

## 4. Answers to Explicit Questions

**How do we safely distinguish whether `/:segment` is a user or an org?**  
By resolving **only from usernames**: one row per segment → `owner_type` is either 'profile' or 'org'. No ambiguity.

**What is the resolution order when both could match?**  
With a single namespace and usernames as source of truth, “both” cannot match. Order is irrelevant. If you keep profile-then-org as fallback during migration, then profile first; after full enforcement, usernames-only resolution makes order N/A.

**How do we prevent collisions permanently?**  
(1) All profile claims → `claim_username_for_profile` (usernames + profiles). (2) All org slug create/update → usernames (via `create_org_and_membership` inserting into usernames, or via `claim_username_for_org`). (3) API/UI validate against usernames (and reserved) before submit. (4) Resolver uses usernames only for `/:segment`.

**How should existing `/org/[orgId]` links migrate to `/org/:slug`?**  
(1) Add route that accepts both: e.g. `app/org/[param]/page.tsx`. If `param` is UUID → `getOrgById(param)`; else → `getOrgBySlug(param)`. Render same OrgDetailPage; internally APIs still use `org.id`. (2) Update all internal links (nav, notifications, emails) to use `/org/:slug`. (3) Optional: 301 `/org/:id` → `/org/:slug` when id is valid so old links canonicalize to slug.

**Should `/u/:username` and `/org/:slug` be noindex?**  
Yes. Both are in-app, auth-gated views. Noindex (and no canonical to themselves).

**What should sitemap include and exclude?**  
Include: `/`, `/:username` (profiles), `/:slug` (orgs) — only public indexable pages. Exclude: `/u/`, `/org/` (in-app), `/app/`, `/deal/`, `/login`, `/api`, etc.

---

## 5. Migration Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Broken internal nav | Update pathFromRoute/routeFromPathname and every href/router.push to `/app/...` and `/org/:slug` in phased steps; feature flag or config if needed. |
| Broken search results | Search API: keep users → `/u/:username`, orgs → `/:slug` for public and add or keep `/org/:slug` for in-app links; update consumers to use correct URL by context. |
| Broken SEO/canonicals | Keep canonical only on public `/:username` and `/:slug`; 301 from old app paths to `/app/...`; sitemap only public. |
| Broken auth redirects | safe-redirect-url and callback allow `next` to be `/app/...` and `/org/:slug`; allowlist unchanged. |
| Broken org analytics access | New route `/org/:slug` loads org by slug and passes org.id to existing OrgDetailPage/APIs; APIs stay by id. |
| Broken user analytics access | `/u/:username` unchanged; ensure auth and permission checks remain. |
| Notifications/emails/deal/review/case study/watchlist/dashboard | Update link builder to `/app/...` and `/org/:slug` (and keep `/deal/:id`). Collab email: keep or point to `/app/...` with redirect. |
| Backend resolver assumptions | Switch public resolver to usernames-only (or profile-then-org with no collisions); update getPublicEntityByUsername and (public)/[username] page to use it. |
| Middleware / reserved / conflicts | Reserved list already has `app`, `org`, `u`; no change. Middleware stays www + @ redirect. |
| Privacy leaks | Public routes serve only public data; in-app routes enforce auth and permissions; no change to data gates. |
| Namespace enforcement breaks existing orgs | Backfill usernames for all org slugs; then enforce create/update. Resolve existing collisions before enforcing. |

---

## 6. Staged Migration Plan

### Phase 1: Namespace audit + validation prep

- **Audit:** Run `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts` to list collisions (same normalized slug in profiles and orgs, or in usernames with different owner_type). Document and resolve (reassign or merge).
- **Backfill:** Ensure every profile.username and every org.slug has a corresponding usernames row (insert missing; fix duplicates per audit).
- **API:** Add endpoint or extend existing to “check slug availability” against **usernames** (and reserved) for use by org create and profile claim.
- **UI:** Extend `checkSlugAvailable` (org) to use global check (usernames or new API). Do not change create_org_and_membership yet if that would require a DB migration in the same release; prepare so Phase 2 can switch.

**Deliverable:** Collision report; backfill done; global availability check available to API/UI.

### Phase 2: Enforce global namespace at write (DB + API)

- **DB/RPC:** Update `create_org_and_membership` to: (1) check usernames (and reserved) for desired slug; (2) if free, insert into usernames (owner_type 'org', owner_id new org) and set orgs.slug; (3) if taken, fail with clear error or suffix per product. Optionally: org slug update path (e.g. PATCH) must call `claim_username_for_org` or equivalent.
- **API:** Org create and org slug update validate via usernames; return 400 with code when slug is taken.
- **UI:** Org create and org slug edit use global check; show “taken by a user or another org” where applicable.

**Deliverable:** No new collisions possible; existing data already backfilled.

### Phase 3: Resolver and public routes

- **Resolver:** Change public `/:segment` resolution to **usernames-first** (or usernames-only): lookup by normalized segment → owner_type + owner_id → load profile or org. Keep slug history 301 for profiles. Remove “profile then org” dual-query that can theoretically see both.
- **Canonical/OG:** Keep canonical on `/:segment` for public profile and public org; ensure metadata uses resolved slug from usernames.

**Deliverable:** Public routes deterministic and collision-proof.

### Phase 4: Add `/app/...` routes (foundation)

- Create pages under `app/app/` (or route group): e.g. `app/app/dashboard/page.tsx`, `app/app/overview/page.tsx`, … reusing existing components. No redirect from old paths yet.
- Update App.tsx `routeFromPathname` to recognize `/app/dashboard`, etc., and `pathFromRoute` to generate `/app/...` when a config/flag is set (or always for new links).

**Deliverable:** All app pages reachable at `/app/...`; SPA sync supports both old and new paths.

### Phase 5: Add `/org/:slug` in-app route safely

- **Route:** Add `app/org/[param]/page.tsx` (or keep `[orgId]` and treat param as id-or-slug): if param is UUID format → getOrgById(param); else → getOrgBySlug(param). Render same OrgDetailPage with data={{ orgId: org.id }} (or slug; component already supports both).
- **Links:** Prefer generating `/org/:slug` for new links (nav, notifications, share). Keep existing API calls using org.id; only URL and client routing use slug.
- **Optional:** 301 `/org/:id` → `/org/:slug` for known orgs so old bookmarks canonicalize.

**Deliverable:** In-app org URLs can use slug; existing UUID links still work.

### Phase 6: Migrate internal links and search behavior

- **Internal links:** Replace root app paths with `/app/...` (dashboard, overview, analytics, settings, profile, work/requests, etc.) and org links with `/org/:slug` where applicable.
- **Notifications / emails:** Update to `/app/...` and `/org/:slug`.
- **Search API:** Keep returning users → `/u/:username`, orgs → `/:slug` for public; for in-app context return orgs → `/org/:slug` when intent is in-app analysis (or return both and let client choose).

**Deliverable:** All internal navigation and notifications use new paths.

### Phase 7: Redirect compatibility and canonical cleanup

- **Redirects:** Add 301 from `/dashboard` → `/app/dashboard`, `/profile` → `/app/profile`, etc. (full list from reserved paths that moved).
- **Sitemap:** Include only `/`, `/:username`, `/:slug` (from usernames or profiles+orgs); exclude `/u/`, `/org/`, `/app/`.
- **Robots:** Keep disallow for `/u`, `/app`, `/profile`, etc.; add `/app/` if desired.

**Deliverable:** Old app URLs redirect; sitemap/robots correct.

### Phase 8: Cleanup

- Remove duplicate root-level app pages (or leave as redirect-only). Single source of truth for app UI under `/app/...`.
- Optional: after a tail period, remove 301 from old app paths or keep forever.

**Deliverable:** Clean route tree; docs updated.

---

## 7. What Is Safe to Implement Now vs What Must Wait

### Safe to do now (low risk)

- **Namespace audit script:** Read-only script that lists profiles and orgs and usernames; report slugs that appear in both profiles and orgs (or multiple owner_types in usernames). No writes.
- **Backfill usernames for orgs:** One-time script or migration that inserts into usernames for each org.slug where no row exists (owner_type 'org', owner_id = org.id). Run after audit; resolve collisions first (reassign one side).
- **API: global slug check:** New endpoint e.g. `GET /api/slug/available?slug=xxx` that checks reserved + usernames (and optionally profiles/orgs) and returns `{ available: boolean }`. Used later by org create UI and profile UI; no behavior change until UI calls it.
- **Documentation:** This plan; internal checklist of all path/link touchpoints; update reserved path list and run checkReservedCollisions.

### Must wait (until phased work)

- **Changing create_org_and_membership** to use usernames (Phase 2): Requires DB migration and deployment; do after Phase 1 audit and backfill.
- **Switching public resolver to usernames-only** (Phase 3): Do after namespace is enforced and backfilled so no segment has two owners.
- **New route `/org/[param]`** (Phase 5): Do after or with Phase 4; coordinate with link updates.
- **Moving app pages to `/app/...` and adding redirects** (Phases 4, 6, 7): Do in order; do not remove root pages before redirects are in place.
- **Bulk internal link migration** (Phase 6): Do after `/app/...` and `/org/:slug` exist and are tested.

---

## 8. Founder Recommendation: Exact Implementation Order

1. **Namespace audit + enforcement design**  
   Run collision audit; design and document backfill; implement global slug-availability check (API + optional UI wiring). Backfill usernames for orgs and fix any collisions. No change to create/update flows yet.

2. **Enforce global namespace at write**  
   Update `create_org_and_membership` (and org slug update path) to use usernames; API/UI validate. So “collisions are impossible by design” from this point forward.

3. **Resolver and public routes**  
   Switch public `/:segment` to usernames-based resolution (or keep profile-then-org only after guaranteeing no duplicates). Canonical and sitemap stay on public `/:username` and `/:slug`.

4. **`/app/...` foundation**  
   Add `/app/...` routes and SPA sync; no redirects yet.

5. **`/org/:slug` in-app foundation**  
   Add org route that accepts slug (or id); render same OrgDetailPage; new links use `/org/:slug`.

6. **Internal link migration**  
   Point nav, notifications, emails, search result links to `/app/...` and `/org/:slug`.

7. **Redirects + canonical cleanup**  
   301 from old app paths to `/app/...`; optional 301 from `/org/:id` to `/org/:slug`; sitemap/robots final state.

8. **Final verification**  
   No broken links; no duplicate slugs; public canonical and noindex correct; auth and privacy unchanged.

---

## 9. Summary

- **Final URL model:** Public `/:username` and `/:slug`; in-app `/u/:username` and `/org/:slug`; app shell under `/app/...`. Single global namespace: one slug = one owner (profile or org).
- **Enforcement:** usernames table is source of truth; all profile and org slug claims go through it; create_org_and_membership and org slug update must use usernames; API/UI validate globally.
- **Resolver:** Use usernames (or guaranteed single-owner invariant) so `/:segment` is deterministic and collision-free.
- **Migration:** Audit → backfill → enforce writes → resolver → `/app/...` → `/org/:slug` → link migration → redirects → cleanup. Only safe, low-risk foundation work (audit, backfill, slug-availability API) is recommended for “implement now”; the rest follows the phases above without a big-bang refactor.

---

## 10. What Should Happen Next After This

The best sequence is:

1. **Namespace audit + enforcement design** — Run collision script; backfill usernames for orgs; add global slug-availability API; document resolution of any existing collisions.
2. **`/app/...` foundation** — Add route structure and SPA sync; no redirects or link changes yet.
3. **`/org/:slug` in-app foundation** — New route that accepts slug (or UUID); same OrgDetailPage; new links use slug.
4. **Internal link migration** — Update nav, notifications, emails, and search to `/app/...` and `/org/:slug`.
5. **Redirects + canonical cleanup** — 301 from old app paths; sitemap/robots; optional `/org/:id` → `/org/:slug`.
6. **Final verification** — No broken links; namespace collision-free; public canonical and noindex correct.

**Important caution:** With both public users and public orgs at root, the resolver must be **deterministic and collision-proof**. That means:

- Collisions are **impossible by design** (enforced at write via usernames).
- One shared namespace is **enforced permanently** (DB, API, UI).
- Do **not** keep “profile wins over org” as a soft rule; make it so the same slug can never exist for both (usernames table as single source of truth and resolver using usernames-only lookup).

---

*End of document.*
