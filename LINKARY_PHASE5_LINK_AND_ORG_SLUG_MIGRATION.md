# Linkary: Phase 5 – Link Migration & In-App Org Slug Route

**Purpose:** Add in-app org slug route support (`/org/:slug`) and migrate internal in-app navigation to the final URL model (`/app/...` and `/org/:slug`) without removing old routes or adding redirects.  
**Scope:** Route resolution, pathFromRoute, setRoute data (slug), search API org URL, and in-app hrefs/links.  
**Reference:** `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` Phase 5; `/app/...` foundation from Phase 4.

---

## 1. Exact Files Changed

| File | Change |
|------|--------|
| **apps/web/src/figma/app/components/OrgDetailPage.tsx** | Resolve org by segment: if `getIdentifierKind(orgId) === "uuid"` then `getOrgById(orgId)`, else `getOrgBySlug(orgId)`. So `/org/:orgId` works for both UUID and slug. |
| **apps/web/src/figma/app/App.tsx** | **pathFromRoute:** Map app routes to `/app/...` (overview, dashboard, analytics, profile, profileEdit, workRequests, settings/*, connections, xspaces, etc.). **orgDetail:** Use `/org/${route.data.slug ?? route.data.orgId}` so slug is preferred when present. **profileEdit** push: use `/app/profile`. **notifLink:** Use `/app/connections`, `/app/overview`, `/app/dashboard`, `/app/xspaces` where applicable; org links stay `/org/:orgId` (UUID) when payload has no slug. **hrefs:** `/profile/edit`, `/profile/insights`, `/analytics`, `/profile/edit`, **router.push:** `/settings/wallet` → `/app/settings/wallet`, post-login `/overview` → `/app/overview`. |
| **apps/web/src/figma/app/components/DashboardPage.tsx** | **setRoute orgDetail:** Add `slug: org.slug` (and `slug: _slug` in handleOrgCreated) so pathFromRoute generates `/org/:slug`. **hrefs:** `/analytics` → `/app/analytics`, `/profile/edit` → `/app/profile/edit`. |
| **apps/web/src/figma/app/components/ProfileEditPage.tsx** | **setRoute orgDetail:** Add `slug: org.slug` for org link. **href:** `/profile/deals` → `/app/profile/deals`. |
| **apps/web/src/app/api/search/route.ts** | Org result **url:** from `/${o.slug}` (public canonical) to `/org/${encodeURIComponent(o.slug)}` (in-app org view). **handleLabel** remains `/${o.slug}` for display. |
| **apps/web/src/figma/app/components/AnalyticsPage.tsx** | **hrefs:** `/settings/integrations` → `/app/settings/integrations`, `/dashboard` → `/app/dashboard`. |
| **apps/web/src/figma/app/components/analytics/AnalyticsHeader.tsx** | **href:** `/dashboard` → `/app/dashboard`. |
| **apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx** | **href:** `/analytics` → `/app/analytics`. |
| **apps/web/src/app/CdpErrorBoundary.tsx** | **href:** `/settings/wallet` → `/app/settings/wallet`. |
| **apps/web/src/components/RequestsLayout.tsx** | **hrefs:** `/profile` → `/app/profile`, `/profile/inbox` → `/app/profile/inbox`, `/profile/requests` → `/app/profile/requests`. |

**Not changed:** WatchlistPage (org link still uses `orgId` only; pathFromRoute falls back to `/org/:orgId`), notification org links (payload has `org_id` only), public pages (OwnerUnpublishedProfile, PublicHeader, ApplyToGigButton, etc.), API routes under `/api/orgs/[orgId]/` (still use UUID).

---

## 2. How `/org/:slug` Works Now

- **Single route segment:** The app still uses one dynamic segment: `org/[orgId]/page.tsx`. The param can be either a **UUID** or a **slug**.
- **Resolution in OrgDetailPage:** On load, the segment (from `data?.orgId ?? data?.slug`, which is `parts[1]` from the URL) is passed to `getIdentifierKind(segment)`. If it is a UUID, the code calls `getOrgById(segment)`; otherwise it calls `getOrgBySlug(segment)`. So:
  - **`/org/520af360-4196-4a41-94d3-523b0ae6c4cc`** → resolve by id.
  - **`/org/desicryptoclub`** → resolve by slug.
- **Navigation:** When the app has an org with `slug` (e.g. from list or create), `setRoute({ name: "orgDetail", data: { orgId: org.id, slug: org.slug, tab? } })` is used. `pathFromRoute` then returns `/org/${route.data.slug ?? route.data.orgId}`, so new in-app links use **`/org/:slug`** when slug is present.

---

## 3. Whether `/org/:orgId` Still Works

- **Yes.** Old links and notifications that use `/org/:uuid` still work:
  - The same page `org/[orgId]/page.tsx` handles the request.
  - `routeFromPathname` still sets `data: { orgId: parts[1], tab }`.
  - OrgDetailPage treats a UUID segment as id and calls `getOrgById(orgId)`.
- **Watchlist and notifications** that only have `entity_id` or `org_id` (UUID) continue to use `/org/:uuid`; no redirects were added.

---

## 4. Internal Links Migrated to `/app/...`

- **pathFromRoute** now returns `/app/...` for: overview, dashboard, explore, profile, profileEdit, profileDeals, profileApplications, profileInsights, market, messages, circles, analytics, plans, pricing, billing, leaderboards, creator, brand, agency, calendar, xspaces, host, availability, monetization, kol-lists, capital-partners, connections, preferences, support, notifications, showcase, integrations, rolesSkills, wallet, watchlist, workRequests.
- **Hardcoded hrefs** updated to `/app/...` in: App.tsx (profile/edit, profile/insights, analytics, profile/edit, settings/wallet), DashboardPage (analytics, profile/edit), ProfileEditPage (profile/deals), AnalyticsPage (settings/integrations, dashboard), AnalyticsHeader (dashboard), InsightsSnapshot (analytics), CdpErrorBoundary (settings/wallet), RequestsLayout (profile, profile/inbox, profile/requests).
- **Notification links** updated to `/app/connections`, `/app/overview`, `/app/dashboard`, `/app/xspaces` where applicable.
- **Post-login redirect** and **profileEdit** push use `/app/overview` and `/app/profile`.

---

## 5. Internal Org Links Migrated to `/org/:slug`

- **DashboardPage:** All `setRoute({ name: "orgDetail", data: { orgId: org.id, ... } })` now include `slug: org.slug` (and handleOrgCreated passes `slug: _slug`). So new navigation from dashboard goes to `/org/:slug`.
- **ProfileEditPage:** Org link in “My orgs” now passes `slug: org.slug`, so the generated link is `/org/:slug`.
- **Search API:** Org results now return `url: /org/:slug` so in-app search takes users to the in-app org page by slug.
- **WatchlistPage:** Still uses only `entity_id` (UUID); link remains `/org/:orgId` until we have slug in that flow.

---

## 6. Intentionally Left Unchanged

- **Root app routes:** `/dashboard`, `/profile`, `/analytics`, etc. are still in place and work.
- **Public routing:** `/:username`, `/:slug`, usernames-based resolver, reserved paths, middleware – no changes.
- **`/u/:username`:** Unchanged; people search still uses `/u/:username` for in-app profile (search API person url already `/u/${p.username}`).
- **API routes:** All `/api/orgs/[orgId]/...` still use UUID; no slug-based API routes added.
- **Notification org links:** Still use `/org/${n.payload.org_id}` (UUID) because the payload does not include slug.
- **Public discovery/share:** Search API `handleLabel` for orgs remains `/${o.slug}` for display; only the click-through `url` is `/org/:slug` for in-app. Copy/share of public profile and org URLs remain root canonical.
- **Redirects:** No new redirects; old URLs still work.

---

## 7. Risks Before Redirect Phase

- **Bookmarks / external links:** Users who bookmarked root paths (e.g. `/dashboard`, `/profile`) will keep landing on the old routes. After a future redirect phase, those can 301 to `/app/...`.
- **Notifications:** Org notification links still use UUID. If an org changes slug, old notification links still resolve by UUID; no broken links.
- **Watchlist:** Org entries only have `entity_id`; links are `/org/:uuid`. Adding slug to watchlist response and using `/org/:slug` can be a later improvement.
- **Mixed usage:** Some entry points (e.g. public CTA “Go to dashboard”) may still point at `/dashboard`. Root routes remain valid, so behavior is unchanged until redirects are added.

---

*End of document.*
