# Linkary Route Coverage Audit (Post Black-Screen Fix)

**Date:** 2026-03-10  
**Scope:** `apps/web/src/figma/app/App.tsx`  
**Goal:** Ensure every route name produced by `routeFromPathname()`, `pathFromRoute()`, or `setRoute({ name })` is either disallowed (redirect to overview) or allowed and has a render branch—no blank content area.

---

## 1. Full reachable route list

### 1.1 From `routeFromPathname(pathname, searchParams)`

Pathname is normalized: leading slash and `/app/` prefix stripped; then logic below.

| Source | Route name(s) |
|--------|----------------|
| Empty or `app` only | `landing` |
| `work/requests` | `workRequests` (data: tab, id) |
| `settings/integrations` | `integrations` |
| `settings/roles-skills` | `rolesSkills` |
| `settings/wallet` | `wallet` |
| `profile/edit` | `profileEdit` |
| `profile/deals` | `profileDeals` |
| `profile/applications` | `profileApplications` |
| `profile/insights` | `profileInsights` |
| `profile/dashboard` | `analytics` |
| `u/:username/insights` | `userInsights` |
| `profile` (no second segment) | `profile` (data: tab, username) |
| `org/:id` | `orgDetail` (data: orgId, tab) |
| Single segment in RESERVED_PATHS → nameMap | See below |
| Other single segment | `userProfile` (handle/username) |

**nameMap (single segment under /app/):**  
`dashboard`, `explore`, `terms`, `privacyPolicy`, `privacy`, `login`, `accountType` (onboarding), `profile`, `overview`, `market`, `messages`, `circles`, `analytics`, `verification`, `plansBilling`, `billing`, `pricing`, `landing` (home), `leaderboards`, `creatorProfile`, `brandProfile`, `agencyProfile`, `calendar`, `xspaces`, `hostDashboard`, `availability`, `monetizationShowcase`, `monetizationFlowShowcase`, `kolLists`, `capitalPartners`, `connections`, `preferences`, `support`, `notifications`, `verificationInbox`, `showcase`, `integrations`, `rolesSkills`, `watchlist`, `integrations` (settings).

**Full set from routeFromPathname:**  
`landing`, `workRequests`, `integrations`, `rolesSkills`, `wallet`, `profileEdit`, `profileDeals`, `profileApplications`, `profileInsights`, `analytics`, `userInsights`, `profile`, `orgDetail`, `dashboard`, `explore`, `terms`, `privacyPolicy`, `privacy`, `login`, `accountType`, `overview`, `market`, `messages`, `circles`, `plansBilling`, `billing`, `pricing`, `leaderboards`, `creatorProfile`, `brandProfile`, `agencyProfile`, `calendar`, `xspaces`, `hostDashboard`, `availability`, `monetizationShowcase`, `monetizationFlowShowcase`, `kolLists`, `capitalPartners`, `connections`, `preferences`, `support`, `notifications`, `verification`, `verificationInbox`, `showcase`, `userProfile`.

### 1.2 From `pathFromRoute(route)` (names that can be set then synced from URL)

Map keys and special cases:  
`landing`, `overview`, `dashboard`, `explore`, `discovery`, `terms`, `privacyPolicy`, `privacy`, `login`, `onboarding`, `accountType`, `profile`, `profileEdit`, `profileDeals`, `profileApplications`, `market`, `messages`, `circles`, `circleDetail`, `analytics`, `verification`, `verificationInbox`, `plansBilling`, `pricing`, `billing`, `pricingRefined`, `leaderboards`, `creatorProfile`, `brandProfile`, `agencyProfile`, `calendar`, `calendarRefined`, `enhancedCalendar`, `xspaces`, `hostDashboard`, `availability`, `monetizationShowcase`, `monetizationFlowShowcase`, `kolLists`, `capitalPartners`, `connections`, `preferences`, `support`, `notifications`, `showcase`, `integrations`, `rolesSkills`, `wallet`, `watchlist`; plus special: `userProfile`, `profileInsights`, `userInsights`, `orgDetail`, `dealDetail`, `workRequests`, `profile`.

### 1.3 From `setRoute({ name })` usage in codebase

Observed names:  
`landing`, `overview`, `dashboard`, `profile`, `profileEdit`, `userProfile`, `market`, `messages`, `workRequests`, `brandProfile`, `orgDetail`, `dealDetail`, `login`, `accountType`, `terms`, `privacyPolicy`, `privacy`, `integrations`, `rolesSkills`, `explore`, `orgs`, `profileDashboard`.

---

## 2. Mismatches found (pre-fix)

### 2.1 Reachable from URL, not in ALLOWED_ROUTES → redirect (no black screen, but wrong UX)

| Route name | URL | Component exists? | Risk |
|------------|-----|-------------------|------|
| `leaderboards` | `/app/leaderboards` | Yes (`LeaderboardsPage`) | **Fixed** – was redirect only |
| `hostDashboard` | `/app/host` | Yes (`HostDashboard`) | **Fixed** – was redirect only |
| `availability` | `/app/availability` | Yes (`AvailabilitySettings`) | **Fixed** – was redirect only |
| `monetizationShowcase` | `/app/monetization` | Yes (`MonetizationShowcase`) | **Fixed** – was redirect only |
| `monetizationFlowShowcase` | `/app/monetization-flow` | Yes (`MonetizationFlowShowcase`) | **Fixed** – was redirect only |
| `verification` | `/app/verification` (if under app) | No render in App | Redirect only; acceptable |
| `verificationInbox` | `/app/verification-inbox` | No render in App | Redirect only; acceptable |
| `support`, `notifications`, `showcase`, `preferences` | `/app/support`, etc. | No render in App | Redirect only; acceptable |
| `profileDeals`, `profileApplications` | `/app/profile/deals`, `/app/profile/applications` | No render in App | Redirect only; acceptable |

### 2.2 Allowed but no render branch → blank content (black screen)

- **onboarding** – Was in `ALLOWED_ROUTES` with no dedicated branch (only `accountType` was rendered). **Fixed:** render branch now treats `onboarding` like `accountType` → `<AccountTypePage />`.

### 2.3 Rendered but not allowed

**None.** All render branches correspond to route names that were in `ALLOWED_ROUTES` (or added in this audit).

### 2.4 Programmatic-only names (setRoute, not from URL)

| Route name | Where set | In ALLOWED_ROUTES? | Render? | Note |
|------------|------------|--------------------|---------|------|
| `orgs` | OnboardingPage | No | No | Redirects to overview; no OrgsPage in App. Documented only. |
| `profileDashboard` | ProfileDashboardPage | No | No | Redirects to overview. Could later map to profile/insights. Documented only. |

### 2.5 Already fixed (black-screen fix)

- `explore` – allowed + `<ExplorePage />`
- `creatorProfile` – allowed + `<CreatorProfilePage />`
- `agencyProfile` – allowed + `<AgencyProfilePage />`

---

## 3. Files changed

- **`apps/web/src/figma/app/App.tsx`**
  - Extended `ALLOWED_ROUTES` with: `leaderboards`, `hostDashboard`, `availability`, `monetizationShowcase`, `monetizationFlowShowcase`.
  - Added five render branches: `leaderboards` → `<LeaderboardsPage />`, `hostDashboard` → `<HostDashboard />`, `availability` → `<AvailabilitySettings />`, `monetizationShowcase` → `<MonetizationShowcase />`, `monetizationFlowShowcase` → `<MonetizationFlowShowcase />`.
  - Render branch for `accountType` extended to also handle `onboarding` (same `<AccountTypePage />`) so no allowed route has no branch.

---

## 4. Fixes applied

1. **leaderboards** – Added to `ALLOWED_ROUTES` and branch `route.name === "leaderboards"` → `<LeaderboardsPage setRoute={setRoute} />`.
2. **hostDashboard** – Added to `ALLOWED_ROUTES` and branch → `<HostDashboard setRoute={setRoute} />`.
3. **availability** – Added to `ALLOWED_ROUTES` and branch → `<AvailabilitySettings setRoute={setRoute} />` (component ignores `setRoute`; no API change).
4. **monetizationShowcase** – Added to `ALLOWED_ROUTES` and branch → `<MonetizationShowcase setRoute={setRoute} />`.
5. **monetizationFlowShowcase** – Added to `ALLOWED_ROUTES` and branch → `<MonetizationFlowShowcase setRoute={setRoute} />`.
6. **onboarding** – Already in `ALLOWED_ROUTES`; added to the same render branch as `accountType` so `(route.name === "accountType" || route.name === "onboarding")` → `<AccountTypePage />`.

No changes to URL shape or to `routeFromPathname` / `pathFromRoute` logic. No refactors beyond these additions.

---

## 5. Routes that were already correct

All of the following were already in `ALLOWED_ROUTES` and had a corresponding render branch (or shared branch, e.g. `calendar`/`xspaces`, `pricing`/`billing`/`plansBilling`):

- `landing`, `overview`, `dashboard`, `profile`, `profileEdit`, `profileInsights`, `userProfile`, `userInsights`, `market`, `messages`, `workRequests`, `analytics`, `privacy`, `integrations`, `rolesSkills`, `wallet`, `login`, `onboarding`, `accountType`, `orgDetail`, `brandProfile`, `creatorProfile`, `agencyProfile`, `dealDetail`, `terms`, `privacyPolicy`, `plansBilling`, `billing`, `pricing`, `circles`, `circleDetail`, `connections`, `kolLists`, `calendar`, `xspaces`, `capitalPartners`, `watchlist`, `explore`.

---

## 6. Final verdict

- **Remaining risk of black/blank screens in App.tsx:** **None** for the audited scope.
  - Every route name that is in `ALLOWED_ROUTES` has a render branch.
  - Every route name that is reachable from the URL and has a dedicated component in App is now allowed and rendered.
- **Intentional redirect-only (no render in App):**  
  `verification`, `verificationInbox`, `support`, `notifications`, `showcase`, `preferences`, `profileDeals`, `profileApplications` — these URLs redirect to overview; no blank content.
- **Programmatic-only:**  
  `orgs`, `profileDashboard` redirect to overview if set; no blank content. No change made; documented for future UX if needed.

URL architecture is unchanged; only `ALLOWED_ROUTES` and the main route switch were extended with the five new safe cases above.
