# P0 launch-hardening deliverables

Structural cleanup, analytics ownership, technical SEO, and performance for launch readiness.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| **`apps/web/src/figma/app/App.tsx`** | Profile Insights route now renders `InsightsSnapshot` with `snapshotOnly` so the Profile tab shows only a snapshot card and "See full analytics" → /analytics (no duplicate deep analytics, refresh, or social graph on Profile). |
| **`apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx`** | "See full analytics" link updated from `/app/analytics` to `/analytics` so it targets the canonical analytics surface. |
| **`apps/web/src/app/app/layout.tsx`** | **New.** Layout for `/app/*` with `metadata.robots: { index: false, follow: false }` so app shell routes are noindex. |
| **`apps/web/src/app/analytics/layout.tsx`** | **New.** Layout for `/analytics` with `metadata.robots: { index: false, follow: false }` so analytics is noindex. |
| **`apps/web/src/figma/app/components/AnalyticsPage.tsx`** | useSWR for `/api/analytics/x` now uses `SWR_DEDUP_MS` (60s) for client cache consistency with me-stats; reduces duplicate fetches when switching tabs/windows. |

---

## 2. Analytics duplication removed or reduced

| Area | Before | After |
|------|--------|--------|
| **Profile Insights (`/app/profile/insights`)** | Full `InsightsSnapshot`: refresh button, social graph, top followers, score breakdown, backfill/refresh UI. | Snapshot-only: header card, TrustStrip (score/tier), credibility snapshot copy, and single CTA "See full analytics" → `/analytics`. No refresh, no social graph, no top followers on Profile. |
| **userInsights (other user)** | Already used `snapshotOnly`; unchanged. | Same snapshot-only experience; link to full analytics remains `/analytics` (own analytics). |
| **Deep analytics ownership** | Single owner: `/analytics`. Profile had duplicate deep analytics on Insights tab. | Enforced: Profile shows only snapshot + link; all deep analytics (time-series, top followers, refresh/backfill) live only on `/analytics`. |

No changes to `/profile/dashboard` (already redirects to `/analytics`). No new product surfaces.

---

## 3. SEO files added/updated

| File | Purpose |
|------|--------|
| **`apps/web/src/app/robots.ts`** | Unchanged. Already disallows `/app`, `/profile`, `/dashboard`, `/analytics`, `/api`, `/auth`, `/login`, `/u`; allows `/` (landing and public profiles are indexable). Sitemap and host set. |
| **`apps/web/src/app/sitemap.ts`** | Unchanged. Homepage + published profiles + orgs; revalidate 0. |
| **`apps/web/src/app/app/layout.tsx`** | **New.** `robots: { index: false, follow: false }` for all `/app/*` routes. |
| **`apps/web/src/app/analytics/layout.tsx`** | **New.** `robots: { index: false, follow: false }` for `/analytics`. |
| **`apps/web/src/app/profile/insights/layout.tsx`** | Already had noindex. |
| **`apps/web/src/app/app/analytics/profile/[username]/layout.tsx`** | Already had noindex. |

Result: Landing (/) and published public profiles (`/{username}`) remain indexable and canonical. Internal app, profile, dashboard, analytics, and auth routes are noindex via both robots.txt and metadata.

---

## 4. Design / readability fixes

- **Snapshot-only view** already uses `variant="light"` on `ProfileHeaderCard` and `TrustStrip` for readability on light shell.
- **Analytics page** uses design tokens (`bg-background`, `text-foreground`, `border-border`, `text-muted-foreground`, `bg-card`) throughout.
- **Dashboard** and **Analytics** route components are already dynamically imported in `App.tsx` (DashboardPage, AnalyticsPage) to keep initial bundle smaller.
- No additional design-system or token changes were made in this pass. Any further contrast or light-shell tweaks can be done in a follow-up.

---

## 5. Performance optimizations

| Optimization | Implementation |
|--------------|-----------------|
| **Dynamic imports** | Dashboard and Analytics pages were already loaded via `next/dynamic` in App.tsx; no change. |
| **Client cache for /api/profile/me-stats** | Already used with `authFetcher` and `SWR_DEDUP_MS` (60s) in InsightsSnapshot and other consumers. |
| **Client cache for /api/analytics/x** | AnalyticsPage useSWR now uses `SWR_DEDUP_MS` (60s) instead of 30s; aligned with me-stats and reduces duplicate fetches when navigating Profile → Analytics or reopening Analytics. |
| **Related analytics endpoints** | No new shared cache layer; existing SWR deduping is used. |

---

## 6. Data / visibility hardening

- **Cross-user analytics:** Confirmed `GET /api/me/analytics/profile/[username]` remains allowlisted (`crossUserAnalyticsAllowlist.ts`), rate-limited (rlKey), and returns only shaped profile + analytics keys; forbidden keys are tested. No access broadening.
- **Public profile:** No change; proof signals and no private metadata rules unchanged.
- **Privacy boundaries:** No regression; no new data exposed.

---

## 7. Remaining launch blockers

- None identified. Remaining items are optional:
  - Design: Any further Dashboard/Analytics contrast or token tweaks (e.g. explicit light-shell overrides) can be done incrementally.
  - Performance: Analytics init-status or summary endpoints could be cached similarly if needed; not required for P0.

---

## 8. Final regression checklist

- [ ] **Analytics ownership:** /analytics is the only deep analytics surface; Profile Insights shows only snapshot + "See full analytics" → /analytics.
- [ ] **No duplicate UI:** Refresh, social graph, top followers, and backfill UI do not appear on Profile; they remain only on /analytics.
- [ ] **SEO:** robots.txt disallows /app, /profile, /analytics, etc.; landing and public profiles allowed. Sitemap has homepage and published profiles/orgs. /app and /analytics have noindex metadata.
- [ ] **Canonical:** Public profile remains /{username}; /profile/work and /profile/deals remain internal.
- [ ] **Performance:** Analytics /api/analytics/x request uses 60s SWR deduping; Dashboard and Analytics routes are dynamically imported.
- [ ] **Privacy:** No new data or cross-user access; allowlist and rate limits unchanged.
- [ ] **No new surfaces:** No new routes or product areas; snapshot-only is a reduction of surface on Profile.
