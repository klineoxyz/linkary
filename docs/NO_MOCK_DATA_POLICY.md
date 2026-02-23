# No Mock Data Policy

Linkary UI must not show hardcoded placeholder or demo data to users. Use real data from the database or APIs, or show a clear empty state with a CTA.

## Where mock data was removed or replaced

### Dashboard (DashboardPage.tsx)

- **personalStats**: Replaced with `emptyStats` (zeros) and values derived from `myDeals` (activeDeals, completionRate). No fake numbers.
- **demoBrands**: Removed. Brands are derived from `myOrgs` via `brandsFromOrgs`. When user has no orgs, the "My Brands & Projects" section is hidden.
- **searchResults**: Removed. Search uses GET /api/search when user types (min 2 chars). Empty state: "No people or companies found. Try a different search."
- **FlipCard back insights**: Replaced with generic copy: "Complete a deal to see stats" or "Connect X to see analytics." No fake insights.

### App shell (App.tsx)

- **demo.explore**: Set to `{ individuals: [], projects: [] }`. Overview shows empty state: "Search for creators and projects."
- **demo.marketplace.interestedProjects**: Set to `[]`. AI Matched Opportunities section is hidden when empty.
- **demo.blog.posts**: Set to `[]`. Blog tab shows "No posts yet."
- **demo.leaderboards**: Set to `{ topCreators: [], topProjects: [] }`. Leaderboards page shows "Coming soon." when empty.
- **me fallbacks**: Profile (u) uses empty strings and zeros when no real data. roleTags from profileProfessions only (no fake roleTags). reviews from meStats or `{ avg: 0, count: 0 }`.

### Brand / project profile (BrandProfilePage.tsx)

- **demoBrandData**: Removed. Replaced with `emptyBrandData` (zeros, empty arrays, name "—"). When no dbOrg and no brandData, empty state is shown.

### Public profile demo

- **PublicProfileDemo** or any standalone demo component: Remove or gate behind dev-only; public pages must use real public DTO only.

## Empty state pattern

- **No data**: Show a short message and one primary CTA (e.g. "Add your first case study", "Connect X to fetch analytics", "Search for creators").
- **No search results**: "No people or companies found. Try a different search."
- **Stats**: Use "—" or "0" and subtext like "Connect X for analytics" or "Complete a deal to see stats."

## APIs used for real data

- **Profile / me**: GET /api/me/profile-status, GET /api/profile/me-stats (reviews, ethos, xscore, linkary power).
- **Search**: GET /api/search?q= (profiles + orgs, published only).
- **Connections**: GET /api/connections/list, GET /api/connections/status?username=.
- **Deals / stats**: Use deals and reviews tables via me-stats or a dedicated stats endpoint when added.
- **Org follow**: GET /api/orgs/[orgId]/follow-status.

## Search recents (GlobalSearch.tsx)

- **recentSearches**: No hardcoded seeds. Initial state is `[]`; recents are loaded from localStorage (key `linkary_search_recents`) and updated when user clicks a result. No "MatrixPay", "Web3 developers", etc. shipped.

## Messaging guard (backend)

- Profile–profile conversations require an accepted connection. POST /api/conversations/get-or-create returns 403 "Connect first" when participants are two profiles and no accepted connection exists. Job apply (profile/org ↔ org) is unchanged.

## Exceptions

- **Placeholder text in inputs** (e.g. "Search...", "Type a message..."): Allowed; these are UX hints, not displayed as data.
- **Default form values** (e.g. empty string for name): Allowed.
- **Development-only fixtures**: Allowed only when gated by NODE_ENV or a feature flag and never shipped as production content.
