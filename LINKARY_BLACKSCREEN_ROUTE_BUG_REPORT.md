# Linkary: Black Screen Route Bug Report (Post–URL Migration)

**Date:** 2026-03-10  
**Scope:** Identify and fix the root cause of black/blank screens on some routes after Phase 7 URL migration. No architecture changes; minimal safe patch only.

---

## 1. Exact URLs Affected

Routes that could show a blank or black screen (or a brief blank during redirect):

- **`/app/explore`** (and after 301: **`/explore`** → `/app/explore`)
- **`/app/creator`** (and after 301: **`/creator`** → `/app/creator`)
- **`/app/agency`** (and after 301: **`/agency`** → `/app/agency`)

Other `/app/*` routes (e.g. `/app/dashboard`, `/app/profile`, `/app/analytics`) were already allowed and had matching components; they were not the cause.

---

## 2. Root Cause

**Production route lockdown in `App.tsx`:** The app keeps an `ALLOWED_ROUTES` set. Any route name not in that set triggers a `useEffect` that calls `setRoute({ name: "overview" })`, which in turn does `router.push("/app/overview")`.

For `/app/explore`, `/app/creator`, and `/app/agency`:

1. **`routeFromPathname()`** correctly mapped these pathnames to route names **`explore`**, **`creatorProfile`**, and **`agencyProfile`** (via the existing `nameMap` in `routeFromPathname`).
2. **None of these names were in `ALLOWED_ROUTES`**, so the app treated them as disallowed.
3. The app first rendered the fallback **OverviewPage** (because `!ALLOWED_ROUTES.has(route.name)` is true), then the `useEffect` ran and called **`router.push("/app/overview")`**.
4. **Result:** A client-side redirect from e.g. `/app/creator` to `/app/overview`. During that navigation the previous page is unmounted; if the transition is slow or the new page is slow to mount, the user can see a **blank/black screen** (no content, only background).
5. Additionally, **no component was ever rendered for these route names.** The switch has explicit `route.name === "..." && <Component />` branches for `brandProfile`, `dashboard`, etc., but there were **no branches for `explore`, `creatorProfile`, or `agencyProfile`**, even though **ExplorePage**, **CreatorProfilePage**, and **AgencyProfilePage** exist and are imported/defined. So even if we had added those names to `ALLOWED_ROUTES` without adding the branches, the app would have rendered **nothing** inside the content area (empty `motion.div`), which with a dark theme looks like a black screen.

So the root cause was:

- **Missing route names** in `ALLOWED_ROUTES`: `explore`, `creatorProfile`, `agencyProfile`.
- **Missing render branches** for those route names, so the correct page components were never shown.

---

## 3. Files Changed

**Single file:** `apps/web/src/figma/app/App.tsx`

- **Change 1:** In the `ALLOWED_ROUTES` set, added **`creatorProfile`**, **`agencyProfile`**, and **`explore`**.
- **Change 2:** In the route switch (content render), added three branches:
  - `{route.name === "creatorProfile" && <CreatorProfilePage setRoute={setRoute} />}`
  - `{route.name === "agencyProfile" && <AgencyProfilePage setRoute={setRoute} />}`
  - `{route.name === "explore" && <ExplorePage setRoute={setRoute} />}`

No other files were modified. Middleware, `routeFromPathname`, `pathFromRoute`, app shell pages, org route, and redirects were left unchanged.

---

## 4. Fix Applied

1. **Allow the three route names** so the app no longer redirects to overview for `/app/explore`, `/app/creator`, `/app/agency`.
2. **Render the correct page** for each:
   - **explore** → **ExplorePage**
   - **creatorProfile** → **CreatorProfilePage**
   - **agencyProfile** → **AgencyProfilePage**

Result:

- Visiting `/app/explore`, `/app/creator`, or `/app/agency` (or landing there via 301 from `/explore`, `/creator`, `/agency`) now shows the intended page instead of redirecting and avoids the blank screen during navigation.

---

## 5. What Was Not Changed

- **Middleware:** No changes. 301 redirects from old root app paths to `/app/...` are unchanged.
- **`routeFromPathname()` / `pathFromRoute()`:** No changes. Pathname normalization and route mapping were already correct.
- **App shell pages:** No changes. Thin wrappers under `app/app/*` still only render `<AppWithProviders />`.
- **Org route:** No changes. `/org/:slug` and `/org/:uuid` behavior and OrgDetailPage load path unchanged.
- **Redirect list:** No routes removed or temporarily reverted. No narrowing of redirects.
- **Sitemap, robots, canonical:** Unchanged.

---

## 6. Verification After Fix

Recommended manual checks:

1. **Direct `/app/...` URLs**
   - Open `/app/explore`, `/app/creator`, `/app/agency`.
   - Expect: Each shows its page (Explore, Creator, Agency) with no blank screen and no redirect to overview.

2. **301 from old root**
   - Open `/explore`, `/creator`, `/agency` (no `/app`).
   - Expect: 301 to `/app/explore`, `/app/creator`, `/app/agency`, then the same content as above, no black screen.

3. **Other app routes**
   - Open `/app/dashboard`, `/app/profile`, `/app/analytics`, `/app/profile/edit`, `/app/work/requests`.
   - Expect: Unchanged; correct pages and no blank screen.

4. **Public and org**
   - Open `/`, `/:username`, `/org/:slug`, `/org/:uuid`.
   - Expect: Unchanged; no regressions.

---

## 7. URL Migration Status After Patch

**The URL migration remains safe after this patch.**

- The fix is limited to **allowing three route names** and **rendering their existing components**.
- No redirects were reverted or altered. Middleware and route parsing are unchanged.
- All Phase 7 behavior (301 from old root app paths, `/app/...` as canonical, exclusions for public/auth/legal/api) is preserved. This was a **runtime/render bug** (missing allowed routes and missing switch branches), not an architecture defect.

---

*End of report.*
