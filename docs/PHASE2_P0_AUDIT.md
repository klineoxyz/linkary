# Linkary Phase 2 (P0) — Baseline verification & change log

## Step 0 — Baseline verification checklist

### A) Profile Insights
- **Route / tab:** `/profile?tab=insights`; `/profile/dashboard` redirects to `/profile?tab=insights` (see `apps/web/src/app/profile/dashboard/page.tsx`).
- **Components:** `apps/web/src/figma/app/components/profile/InsightsTab.tsx` (rendered from App when `tab === "insights"`). `ProfileDashboardPage.tsx` exists but is **not** used in App (only InsightsTab is).
- **API calls from InsightsTab:** `GET /api/profile/me-stats`, `GET /api/analytics/x`, `GET /api/social/insights?provider=x&username=...`, `POST /api/profile/refresh-x-insights`.
- **App.tsx:** Profile has two tabs (Overview | Insights); Insights branch at ~2449 renders `<InsightsTab />`. `routeFromPathname` maps `profile/dashboard` → `{ name: "profile", data: { tab: "insights", username } }`.

### B) Analytics page
- **Route:** `/analytics` → `route.name === "analytics"` → `<AnalyticsPage />` (App.tsx ~3598).
- **Page entry:** `apps/web/src/app/analytics/page.tsx` (client, renders AppWithProviders).
- **Component:** `apps/web/src/figma/app/components/AnalyticsPage.tsx` (uses `/api/analytics/init-status`, `/api/analytics/x`, `/api/analytics/x/summary`, `/api/analytics/backfill-90`, `/api/analytics/x/rebuild`, `/api/analytics/x/job`). `AnalyticsTabContent.tsx` also fetches init-status, x, backfill-90. Auth: Bearer token in headers.
- **API routes:** `apps/web/src/app/api/analytics/init-status/`, `x/`, `x/summary/`, `x/rebuild/`, `x/rebuild/force/`, `x/job/`, `backfill-90/`, `ensure-backfill/`.

### C) Dashboard & Analytics styling (light shell)
- **App shell:** `App.tsx` ~3067: `min-h-screen bg-[#F7F8FB] text-gray-900` (light).
- **Dark-token offenders (used on this light shell):**
  - **SharedComponents.tsx:** GlassCard (border-white/10, from-white/5, hover:border-white/20), StatCard (border-white/20, text-white/70, text-white, bg-gradient from-white/8).
  - **AnalyticsTabContent.tsx:** border-white/10, bg-gradient from-white/5, text-white, bg-white/5, border-white/20, etc.
  - **DashboardPage.tsx:** bg-white/10, border-white/10, text-white (buttons/cards).
  - **ProfileHeaderCard.tsx:** Has `variant="light"`; dark branch uses border-white/10, text-white, etc.
  - **ReputationCard.tsx:** border-white/10, text-white, bg-white/5.

### D) Client fetching / duplicate endpoints
- **Duplicate endpoints:**
  - `/api/profile/me-stats`: called from App.tsx (~2382), InsightsTab (~217), ProfileDashboardPage (~233).
  - `/api/analytics/x`: called from AnalyticsPage (~187), AnalyticsTabContent (~91, ~103), InsightsTab (~218), ProfileDashboardPage (~234).
  - `/api/analytics/init-status`: called from AnalyticsPage (~173), AnalyticsTabContent (~78).
- **SWR/React Query:** Neither in `apps/web/package.json`. Use SWR (lightweight).

---

## Changes made (summary)

### Step 1 — Analytics ownership (Option A: remove Profile Insights tab)
- Removed Insights tab from Profile page; profile shows Overview only.
- `/profile/dashboard` now redirects to `/analytics`.
- Nav/links that pointed to Profile Insights now point to `/analytics`.
- Deep analytics (backfill, rebuild, init-status, charts) remain only on `/analytics`.

### Step 2 — Light theme
- Replaced dark tokens on light surfaces in Dashboard, Analytics, SharedComponents (GlassCard, StatCard), AnalyticsTabContent, and related cards so text/borders use foreground/card/border/muted.

### Step 3 — Performance
- Dashboard and Analytics route components loaded via `next/dynamic`.
- SWR added; cached `/api/profile/me-stats`, `/api/analytics/x`, `/api/analytics/init-status` (60s stale) to avoid duplicate fetch when moving Profile → Analytics.

### Endpoints owned only by /analytics (deep analytics)
- `/api/analytics/init-status` (GET)
- `/api/analytics/x` (GET)
- `/api/analytics/x/summary` (GET)
- `/api/analytics/x/rebuild` (POST)
- `/api/analytics/x/rebuild/force` (POST)
- `/api/analytics/x/job` (GET)
- `/api/analytics/backfill-90` (POST)
- `/api/analytics/ensure-backfill` (POST, also used from auth callback / PublicOnePagerWrapper for onboarding; no change)

---

## Before/after (Profile Insights + theme)

- **Profile Insights:** Removed. Profile page now has only Overview + link to Analytics. `/profile/dashboard` redirects to `/analytics`. Client route `profile/dashboard` resolves to `analytics`. All nav links that pointed to profile?tab=insights now point to profile overview or /analytics.
- **Theme:** Dashboard, Analytics, SharedComponents (GlassCard, StatCard), and AnalyticsTabContent use token-based styling (text-foreground, text-muted-foreground, border-border, bg-card, bg-muted) so they are readable on the light app shell (bg-[#F7F8FB]). GlassCard/StatCard accept `variant="light"` (default) for app shell.
- **Performance:** Dashboard and Analytics route components are loaded via `next/dynamic` (ssr: false). SWR caches `/api/profile/me-stats`, `/api/analytics/init-status`, `/api/analytics/x`, `/api/analytics/x/summary` with 60s dedupingInterval so Profile → Analytics does not refetch immediately.
