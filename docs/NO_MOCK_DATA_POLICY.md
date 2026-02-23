# No Mock Data Policy

Linkary UI must not show hardcoded placeholder or demo data to users. Use real data from the database or APIs, or show a clear empty state with a CTA.

## Where mock data was removed or replaced

### Dashboard (DashboardPage.tsx)

- **personalStats** (totalVolume, activeDeals, completionRate, avgRating, etc.): Replaced with data from API where available. When no deals/stats exist, show zeros or "—" with CTA: "Your stats will appear when you have deals" or "Connect X to see analytics."
- **demoBrands**: Removed or replaced with real search results. When no results, show empty state: "Search for users or companies" with search input.
- **FlipCard back insights** (e.g. "Highest single deal: €12,400"): Replaced with real deal data when available, or generic empty copy ("Add deals to see insights").

### App shell (App.tsx)

- **demo** object (explore.individuals, explore.projects, marketplace.interestedProjects, blog.posts, leaderboards, me fallbacks): Replaced with:
  - **Explore**: Real search results from GET /api/search; empty state "Search for creators and projects."
  - **Marketplace**: Real jobs/applications or empty "No projects yet."
  - **Blog**: Empty or real content if a blog feature exists.
  - **Leaderboards**: Real data if table exists; else empty "Coming soon" or hidden.
  - **me** fallbacks: Use only when profile fields are null (e.g. display_name fallback to username); remove fake roleTags/reviews when real data is missing and show empty state instead.

### Brand / project profile (BrandProfilePage.tsx)

- **demoBrandData**: When viewing a real org/brand, load from API by slug/id. When no data, show empty state. Remove hardcoded metrics (e.g. "Total Volume $850K") and replace with real org metrics or "—".

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

## Exceptions

- **Placeholder text in inputs** (e.g. "Search...", "Type a message..."): Allowed; these are UX hints, not displayed as data.
- **Default form values** (e.g. empty string for name): Allowed.
- **Development-only fixtures**: Allowed only when gated by NODE_ENV or a feature flag and never shipped as production content.
