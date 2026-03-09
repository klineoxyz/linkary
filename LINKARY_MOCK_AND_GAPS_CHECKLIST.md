# Linkary — Mock Data and Product Gaps Checklist

**Date:** 2026-03-10  
**Labels:** BLOCKER | HIGH | MEDIUM | LOW

---

## 1. Mock / Fake / Sample / Hardcoded Data

| Location | What is mock | Label | Action |
|----------|--------------|--------|--------|
| **apps/web/src/figma/app/components/DashboardPage.tsx** | `categoryDistribution` (Marketing 35%, Dev 25%, etc.) | **BLOCKER** | Remove or replace with real data / empty state. |
| **DashboardPage.tsx** | `brandPerformanceData` (Sep–Feb revenue, projects, engagement) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `brandAudienceData` (Organic 45%, Referral 30%, etc.) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `profileViewsData` (projects, founders, users by month) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `socialPowerGrowth` (power + milestone) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `xSpacesData` (3 hardcoded spaces with listeners, engagement) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `xSpacesStats` (totalSpaces, totalListeners, etc.) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `credibilityGrowth` (jobs, testimonials, rating by month) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | `popularityMetrics` (mentions, shares, saves by month) | **BLOCKER** | Same. |
| **DashboardPage.tsx** | Brand cards from myOrgs use real orgs but **zeros** for revenue, projects, followers, engagement | **HIGH** | Either add real org metrics or show “—” / “Connect analytics” and avoid implying real numbers. |
| **apps/web/src/figma/app/components/circles/CirclesOverviewPage.tsx** | `demoCircles` (c1–c5+ with membersCount, powerScore, etc.) | **BLOCKER** | Remove from main flow or gate as “Coming soon”; no backend. |
| **apps/web/src/figma/app/components/circles/CreateCircleFlow.tsx** | `demoMembers` (m1–m4) | **BLOCKER** | Same as circles. |
| **apps/web/src/figma/app/components/circles/KOLListsPage.tsx** | `demoCreators` (8 hardcoded creators) | **BLOCKER** | Same; search results are real but lists are not saved. |
| **apps/web/src/figma/app/components/CreatorProfileDemo.tsx** | `demoCreator` (full demo profile + caseStudies, reviews placeholder) | **HIGH** | Ensure route is demo-only; do not use as default profile view. |
| **apps/web/src/figma/app/components/CreatorProfilePage.tsx** | `demoCreatorData` | **HIGH** | Same. |
| **apps/web/src/figma/app/components/PublicProfilePage.tsx** | `demoPublicProfileData` (default when `data` not passed) | **HIGH** | Avoid rendering without real `data` on production routes; or remove default. |
| **apps/web/src/figma/app/components/PublicStandalonePage.tsx** | `demoProjectProfile` / featuredWork, caseStudies, reviewItems | **HIGH** | Same. |
| **apps/web/src/figma/app/components/BrandProfilePage.tsx** | `u.caseStudies` default `[]`; may receive demo from parent | **MEDIUM** | Ensure only real data passed when used in app flow. |
| **apps/web/src/figma/app/components/OrgDetailPage.tsx** | `supportersSample` — filled from API; fallback when `dashboardData?.supportersPreview` empty | **LOW** | Real data when API returns; fallback is empty then sample from another fetch; clarify naming. |

---

## 2. Major Product Gaps

| Gap | Description | Label | Notes |
|-----|-------------|--------|------|
| **Circles / KOL lists persistence** | No DB table or API to create/save/load circles or KOL lists | **BLOCKER** | Entire feature is UI-only; either implement or remove from nav / label “Coming soon.” |
| **Org deal completion API** | No endpoint sets `deals.status = 'completed'`; only mark-accepted (accepted_at) | **HIGH** | Org flow: deliver → mark-accepted; completion and reviews for org deals need clarity. |
| **Org-deal review creation** | POST /api/reviews only supports gig_deal path; org deals have DB trigger but no API path | **HIGH** | Add branch for deal_id + org deal or document as “org deal reviews coming soon.” |
| **Profile Insights duplication** | Profile Insights tab still shows full deep analytics (social graph, top followers, refresh) | **HIGH** | IA audit recommended removal or snapshot-only; confuses “where is my analytics.” |
| **Dashboard chart data** | All trend/pie/bar charts on Dashboard are hardcoded | **BLOCKER** | See mock section; replace or remove. |
| **Client cache for analytics** | No React Query/SWR for me-stats and analytics/x; duplicate fetches across Profile/Insights/Analytics | **MEDIUM** | Performance and UX. |
| **Dynamic import Dashboard/Analytics** | Heavy routes and Recharts in main bundle | **MEDIUM** | AUDIT_PERFORMANCE. |
| **Light variant Dashboard/Analytics** | Dark tokens on light shell; contrast issues | **MEDIUM** | AUDIT_DESIGN_SYSTEM. |
| **ensure-backfill call sites** | Called on auth callback and app init; ensure not on every route change | **LOW** | Verify once per session. |
| **Landing OG/canonical** | Not re-verified in this audit | **LOW** | AUDIT_SEO recommended; confirm in place. |

---

## 3. Summary by Label

- **BLOCKER:** Dashboard hardcoded charts/KPIs (9 items); Circles/KOL demo-only with no backend (3); Dashboard chart data gap (1). **Must fix or clearly label before launch.**
- **HIGH:** Brand card zeros; Creator/Public demo defaults; org deal completion and org-deal reviews; Profile Insights duplication. **Should fix for credible launch.**
- **MEDIUM:** Demo component usage; client cache; dynamic import; light variant; BrandProfile data source. **Post-launch or short-term polish.**
- **LOW:** supportersSample naming; ensure-backfill scope; landing metadata. **Nice-to-have.**

---

*End of LINKARY_MOCK_AND_GAPS_CHECKLIST.md*
