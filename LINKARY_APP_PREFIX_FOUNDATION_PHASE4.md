# Linkary: /app/... Prefix Foundation (Phase 4)

**Purpose:** Add the `/app/...` route foundation so both root app routes and prefixed app routes work, without migrating links or adding redirects.  
**Scope:** New route segments under `/app/...` and route mapping helpers only. No link migration, no redirects, no removal of root routes.  
**Reference:** `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` Phase 4; Phase 3 usernames-based public resolver unchanged.

---

## 1. Which `/app/...` Routes Were Added

All of these render the same shell as the root route (`AppWithProviders`); the client app derives the route from the pathname via `routeFromPathname`, which now normalizes `/app/...` to the same logical route as the root path.

| Path | File | Reuses |
|------|------|--------|
| `/app/dashboard` | `app/app/dashboard/page.tsx` | `AppWithProviders` (same as `/dashboard`) |
| `/app/overview` | `app/app/overview/page.tsx` | `AppWithProviders` |
| `/app/analytics` | `app/app/analytics/page.tsx` | `AppWithProviders` |
| `/app/profile` | `app/app/profile/page.tsx` | `AppWithProviders` |
| `/app/settings` | `app/app/settings/page.tsx` | `AppWithProviders` (resolves to `integrations` route) |
| `/app/profile/edit` | `app/app/profile/edit/page.tsx` | `AppWithProviders` |
| `/app/profile/deals` | `app/app/profile/deals/page.tsx` | `AppWithProviders` |
| `/app/profile/applications` | `app/app/profile/applications/page.tsx` | `AppWithProviders` |
| `/app/profile/insights` | `app/app/profile/insights/page.tsx` | `AppWithProviders` |
| `/app/profile/dashboard` | `app/app/profile/dashboard/page.tsx` | `AppWithProviders` (→ analytics) |
| `/app/profile/inbox` | `app/app/profile/inbox/page.tsx` | `AppWithProviders` |
| `/app/profile/requests` | `app/app/profile/requests/page.tsx` | `AppWithProviders` |
| `/app/settings/integrations` | `app/app/settings/integrations/page.tsx` | `AppWithProviders` |
| `/app/settings/roles-skills` | `app/app/settings/roles-skills/page.tsx` | `AppWithProviders` |
| `/app/settings/wallet` | `app/app/settings/wallet/page.tsx` | `AppWithProviders` |
| `/app/work/requests` | `app/app/work/requests/page.tsx` | `AppWithProviders` |

**Note:** `/app` (no segment) is unchanged: `app/app/page.tsx` still redirects to `/`.

---

## 2. Which Components Were Reused

- **Every new `/app/...` page** reuses **`AppWithProviders`** only. No duplication of business logic; the same `LinkaryApp` (and thus `routeFromPathname` / `pathFromRoute`) runs for both root and `/app/...` URLs.
- Root pages (e.g. `dashboard/page.tsx`, `profile/page.tsx`) are unchanged and still render `AppWithProviders`; they were not refactored into shared components because they were already minimal wrappers.

---

## 3. Which Route Helpers Changed

### 3.1 `routeFromPathname` (App.tsx)

- **Change:** Pathname is normalized so that paths under `/app/...` are treated like the corresponding root path.
  - If pathname (after stripping leading `/`) starts with `app/`, the prefix `app/` is removed and the rest is used (e.g. `app/dashboard` → `dashboard`, `app/profile/edit` → `profile/edit`).
  - If pathname is exactly `app` (with or without trailing slash), it is treated as empty (landing).
- **Result:** Visiting `/app/dashboard` produces the same route object as `/dashboard`; visiting `/app/profile/edit` produces the same as `/profile/edit`. All existing branch logic (work/requests, settings/..., profile/..., org, u/..., RESERVED_PATHS segment map) runs on the normalized path, so no duplicate mapping was added.

### 3.2 `pathFromRoute` (App.tsx)

- **Not changed.** It still returns root paths only (e.g. `/dashboard`, `/profile`, `/settings/integrations`). In-app navigation and links continue to use root URLs; no redirects or link migration in this phase.

### 3.3 `nameMap` for first segment (App.tsx)

- **Change:** Added `settings: "integrations"` so that a lone `settings` segment (e.g. `/app/settings`) maps to the same route as the integrations page. `RESERVED_PATHS` already included `"settings"`; without this entry, `/app/settings` would have fallen through to `landing`.

---

## 4. What Was Intentionally Not Changed

- **Root app routes:** All existing root-level app routes (e.g. `/dashboard`, `/overview`, `/profile`, `/settings/integrations`, `/work/requests`) are unchanged and still work.
- **Public routing:** No change to `(public)/[username]/page.tsx`, usernames-based resolver, or reserved-path behavior. `/:segment` resolution is unchanged.
- **Middleware:** No change. Still only handles www → apex and `/@username` → `/:username`.
- **Auth redirects:** No change to login or auth callback behavior.
- **`/u/:username` and `/org/[orgId]`:** Unchanged.
- **Links and redirects:** No link migration; no new redirects from root to `/app/...` or vice versa. Users can open `/app/dashboard` directly (e.g. bookmark); in-app navigation still goes to `/dashboard`, etc.
- **pathFromRoute:** Still returns root paths only, by design, so Phase 5 can later switch to `/app/...` output and add redirects in a controlled way.

---

## 5. What Phase 5 Should Do Next

- **Option A (recommended):** Migrate internal links and nav to use `/app/...` (e.g. update `pathFromRoute` to return `/app/dashboard`, `/app/profile`, etc., and update sidebar/nav links, redirects after login, and any hardcoded root app paths). Then add 301/302 redirects from root app paths to `/app/...` so old URLs still work.
- **Option B:** Add redirects first (root → `/app/...`) and then migrate links so that the canonical app URLs become `/app/...`.
- **Deferred:** Actual removal of root app route files (e.g. deleting `dashboard/page.tsx` at root) should wait until redirects are in place and link migration is verified; not part of Phase 4.

---

## 6. Risks Found

- **`/app` alone:** Currently redirects to `/` via `app/app/page.tsx`. If users bookmark `/app`, they land on the homepage. No change in Phase 4.
- **Client pathname:** The app uses the browser pathname (e.g. from `usePathname()` or similar) in `routeFromPathname`. For `/app/dashboard`, pathname is `/app/dashboard`; normalization ensures the correct route. If any code elsewhere reads `pathname` and assumes root-only paths, it could behave differently on `/app/...`. Only `routeFromPathname` was updated; no other pathname assumptions were changed in this pass.
- **Deep links / auth redirects:** If login or other flows redirect to a root path (e.g. `/dashboard`), they were not changed. After Phase 5 (link migration), those targets can be switched to `/app/...` if desired.
- **Profile/requests vs work/requests:** Root has both `profile/requests` and `work/requests`. `routeFromPathname` maps `work/requests` to `workRequests`; `profile/requests` is not a distinct route name (it falls through to `profile` with a second segment). So `/app/profile/requests` may show the same as `/app/profile`. Left as-is for Phase 4; can be refined in a later pass if needed.

---

*End of document.*
