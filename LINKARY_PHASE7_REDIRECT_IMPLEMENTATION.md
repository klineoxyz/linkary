# Phase 7: Root App → /app 301 Redirect Implementation

**Goal:** Enable safe 301 redirects from old root app routes to the new `/app/...` canonical routes.

**Status:** Implemented. Final QA can begin.

---

## 1. Where Implemented

- **File:** `apps/web/middleware.ts`
- **Mechanism:** Middleware runs after www → apex and `/@username` → `/:username`. A single normalized-path check against a map of old root app paths; on match, 301 to the canonical `/app/...` URL with query string preserved.

Redirects are implemented in middleware (not `next.config`) so that:
- Query string is preserved (e.g. `/profile?tab=foo` → `/app/profile?tab=foo`).
- Hash cannot be preserved (fragment is not sent to the server on HTTP requests); clients that need hash can append it after the redirect or use client-side navigation to `/app/...` which already avoids the redirect.

---

## 2. Exact Redirect Rules Added

All 301 (Moved Permanently). Source paths are matched without trailing-slash sensitivity (e.g. `/dashboard` and `/dashboard/` both redirect).

| From (old root app path) | To (canonical) |
|--------------------------|----------------|
| `/dashboard` | `/app/dashboard` |
| `/overview` | `/app/overview` |
| `/analytics` | `/app/analytics` |
| `/profile` | `/app/profile` |
| `/profile/edit` | `/app/profile/edit` |
| `/profile/deals` | `/app/profile/deals` |
| `/profile/applications` | `/app/profile/applications` |
| `/profile/insights` | `/app/profile/insights` |
| `/profile/inbox` | `/app/profile/inbox` |
| `/profile/requests` | `/app/profile/requests` |
| `/profile/dashboard` | `/app/analytics` |
| `/settings` | `/app/settings` |
| `/settings/integrations` | `/app/settings/integrations` |
| `/settings/roles-skills` | `/app/settings/roles-skills` |
| `/settings/wallet` | `/app/settings/wallet` |
| `/work/requests` | `/app/work/requests` |
| `/explore` | `/app/explore` |
| `/market` | `/app/market` |
| `/messages` | `/app/messages` |
| `/circles` | `/app/circles` |
| `/plans` | `/app/plans` |
| `/pricing` | `/app/pricing` |
| `/billing` | `/app/billing` |
| `/leaderboards` | `/app/leaderboards` |
| `/creator` | `/app/creator` |
| `/brand` | `/app/brand` |
| `/agency` | `/app/agency` |
| `/calendar` | `/app/calendar` |
| `/xspaces` | `/app/xspaces` |
| `/host` | `/app/host` |
| `/availability` | `/app/availability` |
| `/monetization` | `/app/monetization` |
| `/monetization-flow` | `/app/monetization-flow` |
| `/kol-lists` | `/app/kol-lists` |
| `/capital-partners` | `/app/capital-partners` |
| `/connections` | `/app/connections` |
| `/preferences` | `/app/preferences` |
| `/support` | `/app/support` |
| `/notifications` | `/app/notifications` |
| `/showcase` | `/app/showcase` |
| `/watchlist` | `/app/watchlist` |

---

## 3. What Was Intentionally Excluded

The following are **not** redirected in this pass:

- **`/`** — Landing; remains as-is.
- **`/:username`** and **`/:slug`** — Public profiles/orgs. Only the fixed list above is redirected; arbitrary single segments (e.g. `johndoe`) are not in the map and are left alone.
- **`/u/:username`** — In-app user route; excluded by `u/` prefix.
- **`/org/:id`** and **`/org/:slug`** — Org routes; excluded by `org/` prefix. Old org UUID routes continue to work; no `/org/:uuid` → `/org/:slug` redirect in this phase.
- **`/deal/:id`** — Deal deep links; excluded by `deal/` prefix.
- **Auth:** `/login`, `/auth/callback`, `/auth/*`, `/onboarding` — Excluded by path check.
- **Legal:** `/terms`, `/privacy`, `/privacy-policy` — Excluded by path check.
- **`/api/*`** — API routes; excluded and also outside middleware matcher.
- **`/app`** and **`/app/*`** — Canonical app routes; explicitly excluded to prevent redirect loops.

---

## 4. Risks and Edge Cases

- **Hash:** URL fragments are not sent to the server. 301 responses preserve only path + query. If an old link included a hash (e.g. `/profile#section`), the redirect will be to `/app/profile` (and `/app/profile?…` if there was a query); the hash will be lost. Mitigation: internal navigation already uses `/app/...`; external links with hashes are rare; if needed, client can re-append hash after load.
- **Trailing slash:** Both `/dashboard` and `/dashboard/` normalize to `dashboard` and redirect to `/app/dashboard` (no trailing slash). Consistent and loop-free.
- **Public profile collision:** Only the fixed set of path strings above is redirected. A path like `/explore` redirects to `/app/explore`; a path like `/someusername` does not match any key and is not redirected, so public profile pages are unchanged.
- **Redirect loops:** `/app` and any path starting with `app/` are excluded before the map lookup, so `/app/dashboard` (and all `/app/*`) are never redirected. No loop.

---

## 5. QA Readiness

- **Final QA can begin.** Recommended checks:
  1. Visit each old root app path (e.g. `/dashboard`, `/profile`, `/settings/integrations`) and confirm 301 to the corresponding `/app/...` URL.
  2. Confirm query string is preserved (e.g. `/profile?tab=deals` → `/app/profile?tab=deals`).
  3. Confirm `/`, `/:username`, `/u/:username`, `/org/:slug`, `/org/:uuid`, `/deal/:id`, `/login`, `/auth/callback`, `/onboarding`, `/terms`, `/privacy`, `/api/*` are not redirected.
  4. Confirm no redirect loop: `/app/dashboard` (and other `/app/*`) return 200, not 301.

---

*Phase 7 complete. Optional future work: 301 from `/org/:uuid` to `/org/:slug` for canonicalization, documented and implemented separately when safe.*
