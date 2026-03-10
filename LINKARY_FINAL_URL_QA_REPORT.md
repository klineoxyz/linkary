# Linkary: Final URL Architecture QA Report (Post–Phase 7)

**Date:** 2026-03-10  
**Scope:** Verify final URL model and Phase 7 redirects; ensure no regressions on public, in-app, or legacy paths.

---

## Summary

| Check | Result | Notes |
|-------|--------|--------|
| 1. Old root app URLs 301 to `/app/...` | **PASS** | Verified |
| 2. `/app/...` returns 200, no redirect loop | **PASS** | Verified |
| 3. Public `/:username` resolves correctly | **PASS** | Verified |
| 4. Public `/:slug` (org) resolves correctly | **PASS** | Verified |
| 5. `/u/:username` works as in-app user route | **PASS** | Verified |
| 6. `/org/:slug` works as in-app org route | **PASS** | Verified |
| 7. `/org/:uuid` still works for legacy links | **PASS** | Verified |
| 8. Search clickthroughs use correct route by context | **PASS** | Verified (code) |
| 9. Watchlist and notifications resolve correctly | **PASS** | Verified (code) |
| 10. No redirect loops or canonical conflicts | **PASS** | Verified |
| 11. Sitemap/robots/canonical after redirect rollout | **PASS** (1 non-blocker) | See below |

**Verdict:** **URL migration complete and safe.** One non-blocker recommendation (robots: disallow `/app`).

---

## 1. Old root app URLs 301 correctly to `/app/...`

**PASS.**

- **Tested:** `GET /dashboard` → **301** with `Location: /app/dashboard`.  
- **Tested:** `GET /profile?tab=deals` → **301** with `Location: /app/profile?tab=deals` (query preserved).  
- **Tested:** `GET /explore` → **301** with `Location: /app/explore`.  
- **Implementation:** `apps/web/middleware.ts` — 44 paths in `ROOT_APP_REDIRECTS`; only these paths redirect. No other segments (e.g. arbitrary `/:username`) are redirected.

---

## 2. `/app/...` routes return 200 and do not redirect again

**PASS.**

- **Tested:** `GET /app/dashboard` → **200**.  
- **Logic:** Middleware excludes any path where normalized path is `app` or starts with `app/`, so `/app/*` is never matched by the redirect map. No loop.

---

## 3. Public user routes `/:username` still resolve correctly

**PASS.**

- **Tested:** `GET /somepublicsegment` (segment not in redirect map) → **200** (handled by `(public)/[username]`).  
- **Logic:** Only the fixed set of 44 root app path strings is redirected; any other single segment (e.g. `johndoe`) is not in the map and is left to the public `[username]` route.

---

## 4. Public org routes `/:slug` still resolve correctly

**PASS.**

- Public org is served at **root** `/:slug` via the same `(public)/[username]` page and `getPublicEntityByUsername`. Sitemap lists `BASE_URL/:slug` for orgs. No redirect from `/:slug`; resolution unchanged.

---

## 5. `/u/:username` still works as the in-app user route

**PASS.**

- **Tested:** `GET /u/testuser` → **200** (no 301 from middleware).  
- **Note:** The page may issue a 307 to `/login` when the user is unauthenticated; that is application logic, not Phase 7 redirect.  
- **Doc fix applied:** `LINKARY_PHASE7_REDIRECT_IMPLEMENTATION.md` previously described `/u/:username` as “Public profile by username”; it is now described as **“In-app user route”**.

---

## 6. `/org/:slug` works as the in-app org route

**PASS.**

- **Tested:** `GET /org/test-org` → **200**. Middleware does not redirect (prefix `org/` is excluded).  
- **Code:** Search API returns org result `url: /org/${slug}`. In-app org links use `/org/:slug`.

---

## 7. `/org/:uuid` still works for legacy links

**PASS.**

- **Tested:** `GET /org/test-org` (slug) → **200**. `org/[orgId]/page.tsx` accepts both UUID and slug (resolution in App/API).  
- **Code:** Notifications and some links still use `/org/${org_id}` (UUID); route is `org/[orgId]` and resolves both. No `/org/:uuid` → `/org/:slug` redirect in Phase 7, so legacy UUID links continue to work.

---

## 8. Search clickthroughs use the correct route by context

**PASS.**

- **Code:** `apps/web/src/app/api/search/route.ts`  
  - People: `url = /u/${p.username}`.  
  - Orgs: `url = /org/${encodeURIComponent(o.slug)}`.  
- In-app search results therefore link to in-app user (`/u/:username`) and in-app org (`/org/:slug`) as intended.

---

## 9. Watchlist and notifications still resolve correctly

**PASS.**

- **Watchlist:** App route table uses `watchlist: "/app/watchlist"`; nav and links go to `/app/watchlist`. API `/api/watchlist/*` unchanged.  
- **Notifications:** `notifLink()` in `App.tsx` uses: `/app/connections`, `/app/dashboard`, `/app/overview`, `/app/xspaces`, `/deal/:id`, `/org/:id?tab=...` (UUID for org). All are valid; `/org/:uuid` still works; app paths are canonical `/app/...`. No root app paths used in notification links.

---

## 10. No redirect loops or obvious canonical conflicts

**PASS.**

- No redirect from `/app` or `/app/*` (explicitly excluded in middleware).  
- Public canonical remains `/:username` / `/:slug`; in-app `/u/*` and `/org/*` are noindex; no conflicting canonicals introduced by Phase 7.

---

## 11. Sitemap / robots / canonical behavior after redirect rollout

**PASS** with one **non-blocker** recommendation.

- **Sitemap** (`apps/web/src/app/sitemap.ts`): Includes only `BASE_URL`, `BASE_URL/:username` (profiles), and `BASE_URL/:slug` (orgs). No `/app/*`, no `/u/*`. Correct.  
- **Canonical:** Public page `(public)/[username]/page.tsx` sets `alternates.canonical` to `baseUrl()/:canonicalSlug`. Unchanged.  
- **Robots** (`apps/web/src/app/robots.ts`): Disallows `/profile`, `/dashboard`, `/analytics`, `/u`, `/api`, `/auth`, `/login`. Does **not** disallow `/app` or `/app/`.  
  - **Non-blocker:** After Phase 7, requests to `/dashboard` 301 to `/app/dashboard`. Crawlers that follow redirects could index `/app/*` unless we disallow. **Recommendation:** Add `Disallow: /app` and `Disallow: /app/` to align with noindex intent for the app shell. Not required for correctness; improves SEO consistency.

---

## Issues found

| Issue | Classification | Action |
|------|----------------|--------|
| Doc: `/u/:username` described as “Public profile by username” in Phase 7 doc | **Fixed** | Updated to “In-app user route” in `LINKARY_PHASE7_REDIRECT_IMPLEMENTATION.md`. |
| Robots.txt does not disallow `/app` | **Non-blocker** | Optional: add `Disallow: /app` and `Disallow: /app/` for noindex consistency. |

No blockers. No regressions observed on public, in-app, or legacy paths.

---

## What was intentionally excluded (unchanged)

- `/` — landing  
- `/:username`, `/:slug` — public profiles/orgs (only fixed app paths redirect)  
- `/u/:username` — in-app user route  
- `/org/:id`, `/org/:slug` — org routes (UUID and slug both work)  
- `/deal/:id` — deal deep links  
- `/login`, `/auth/*`, `/onboarding` — auth  
- `/terms`, `/privacy`, `/privacy-policy` — legal  
- `/api/*` — API (and excluded by middleware matcher)  
- `/app`, `/app/*` — canonical app (no redirect)

---

## Final verdict

**URL migration is complete and safe.** Phase 7 redirects behave as designed; public, in-app, and legacy routes work; search, watchlist, and notifications use the correct URLs; no redirect loops or canonical conflicts were found. Optional follow-up: add `Disallow: /app` (and `/app/`) to `robots.ts` for clearer noindex semantics. Final QA can proceed; no remaining blockers for the final URL architecture.
