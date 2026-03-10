# Linkary — Launch Credibility Remediation Report

**Date:** 2026-03-10  
**Scope:** Strict launch-credibility pass per LINKARY_TRUTH_AUDIT and prior six audits.  
**Mission:** Make the product honest, trustworthy, and launch-safe without adding unnecessary scope.

---

## 1. What Was Changed

### 1.1 Dashboard truthfulness

**File:** `apps/web/src/figma/app/components/DashboardPage.tsx`

- **Removed** all hardcoded mock/sample chart and KPI datasets:
  - `categoryDistribution` (Marketing 35%, Development 25%, etc.)
  - `brandPerformanceData`, `brandAudienceData`, `profileViewsData`, `socialPowerGrowth`
  - `xSpacesData`, `xSpacesStats`, `credibilityGrowth`, `popularityMetrics`
- **Replaced** the Category Distribution pie chart with an **empty state**: “No category data yet. Add roles and skills on your profile…” + “See full analytics →” link.
- **Skills Radar:** Now uses **only real profile skills** from `/api/profile/skills`. Removed fake “Industry Avg” series and `defaultIndustry`; when no skills, shows empty state with link to Profile edit.
- **Brand cards (personal + brand detail view):** When revenue, projects, followers, or engagement are 0, display **"—"** instead of “€0” or “0%” so zeros are not mistaken for real metrics.
- **Banner:** Replaced “Sample metrics” / “sample preview data” with “Your dashboard” and “Numbers below are from your deals and profile. For full X analytics… go to Analytics.”
- **Section header:** “Sample analytics (coming soon)” → “Activity & reputation” with copy that charts use deal activity and profile stats, with link to Analytics.
- **Total Reviews stat:** Removed hardcoded `change={8.3}`; now uses 0.
- **Profile Showcase:** Renamed from “Profile Showcase” + “Demo” badge to “Example profile types” (no demo badge).
- **Recharts:** Removed unused imports `PieChart as RePieChart`, `Pie`, `Cell` after removing the category pie chart.

**Charts still using real data (unchanged):**

- Volume Trend: `volumeData` from `myDeals` (real).
- Reputation Growth: `reputationData` from `meStats` (real).
- Weekly Activity: `activityData` from `myDeals` (real).

### 1.2 Circles / KOL honesty

**Files:**  
`apps/web/src/figma/app/App.tsx`  
`apps/web/src/figma/app/components/circles/CirclesOverviewPage.tsx`  
`apps/web/src/figma/app/components/circles/KOLListsPage.tsx`

- **Nav labels:** Sidebar now shows “Circles (Coming soon)” and “KOL Lists (Coming soon)” so users do not expect persistence.
- **CirclesOverviewPage:** Added top banner: “Coming soon — Circles are not saved yet. Data below is for preview only. Save and reuse of creator lists will be available in a future update.” Subtitle set to “(preview — not saved)”.
- **KOLListsPage:** Added top banner: “Coming soon — KOL lists are not saved yet. Data shown is for preview only…” Subtitle: “(preview — lists are not saved)”.
- **No removal of demo data** from Circles/KOL pages (demo circles and demo creators remain for preview UX); they are clearly labeled as not saved.

### 1.3 Analytics ownership cleanup

**Files:**  
`apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx`  
`apps/web/src/figma/app/App.tsx`

- **InsightsSnapshot** now accepts **`snapshotOnly`** (default `false`). When `snapshotOnly === true`:
  - Renders only: ProfileHeaderCard, TrustStrip (score/tier), and a single “Credibility snapshot” card with copy and **“See full analytics”** link to `/analytics`.
  - No social graph, top followers, refresh controls, or deep X analytics on profile.
- **App.tsx:** For routes `profileInsights` and `userInsights`, **`snapshotOnly`** is passed so Profile Insights is snapshot-only. Deep analytics remain only on `/analytics`.

### 1.4 Org deal completion + review integrity

**Org deal completion:**  
- No API change. The DB trigger `deals_set_completed` (in `supabase/migrations/20260232000000_reviews_deal_enforcement.sql`) already sets `deals.status = 'completed'` and `completed_at` when both `delivered_at` and `accepted_at` are set. So when the org admin calls `POST /api/deals/[id]/mark-accepted` after the creator has marked delivered, the trigger runs and the deal becomes completed. **No new endpoint was added.**

**Reviews API:**  
**File:** `apps/web/src/app/api/reviews/route.ts`

- **Extended** `POST /api/reviews` to support **org deals** in addition to gig deals:
  - **Path 1 (org deal):** If body includes `deal_id`, the API loads the deal, checks `status === 'completed'`, verifies the caller is either the profile party or an org admin, and inserts a review with `deal_id`, `reviewer_type` / `reviewee_type` (profile vs org), and matching `reviewer_*` / `reviewee_*` ids. The existing DB trigger continues to enforce parties and completed deal.
  - **Path 2 (gig deal):** Unchanged; still uses `reviewee_profile_id` and `gig_deals` to create a profile-to-profile verified review.
- Doc comment updated to describe both paths.

### 1.5 Production truth pass (classification)

Search across the repo for demo/mock/sample/placeholder/hardcoded/fake/fallback:

| Location | Classification | Notes |
|----------|----------------|-------|
| **DashboardPage.tsx** (mock constants) | **Removed** | All mock chart/KPI data removed in this pass. |
| **CirclesOverviewPage** `demoCircles` | **Safe demo-only** | Clearly labeled “Coming soon” and “not saved”; no persistence. |
| **KOLListsPage** `demoCreators` | **Safe demo-only** | Same; banner and nav label. |
| **CreateCircleFlow** `demoMembers` | **Safe demo-only** | Used only in circles flow (coming soon). |
| **CreatorProfileDemo.tsx** `demoCreator` | **Safe demo-only** | Demo component; not used as main profile view. |
| **CreatorProfilePage.tsx** `demoCreatorData` | **Safe demo-only** | Same. |
| **PublicProfilePage.tsx** `demoPublicProfileData` | **Acceptable** | Fallback when `data` not passed; ensure production never renders without real `data`. |
| **PublicStandalonePage.tsx** `demoProjectProfile` | **Acceptable** | Same. |
| **DailyDropBanner.tsx** `mockProfiles` | **Review** | If this banner is shown in production, consider removing or replacing with real “featured” API. |
| **ReputationCardGenerator.tsx** “Mock download” / “Demo mode” | **Acceptable internal** | Demo/showcase behavior; not passed as real data. |
| **MonetizationShowcase.tsx** “Demo Modal” / “placeholder” | **Acceptable internal** | Explicit showcase; not production flow. |
| **SharedComponents.tsx** `fallbackGradient` | **Acceptable** | UI fallback for avatar; not data. |
| **BrandProfilePage.tsx** “Empty fallback when no org data” | **Acceptable** | Comment only; no mock data. |
| **OrgDetailPage.tsx** `supportersSample` | **Acceptable** | Real data from API; name means “preview slice”. |
| **InsightsTab.tsx** `sampleLabel` | **Acceptable** | Label “Sample” for top followers when present; not fake data. |
| **profiles.ts** “placeholders” | **Acceptable** | Comment re: username claim. |
| **input-otp.tsx** `hasFakeCaret` | **Acceptable** | Accessibility caret; not content. |
| **api/overview/stats/route.ts** “No mock data” | **Acceptable** | Comment. |
| **PublicOnePagerWrapper** `analyticsSource` fallback | **Acceptable** | Source label; not fake metrics. |

No further code changes were made for DailyDropBanner or PublicProfilePage/PublicStandalonePage in this pass to avoid scope creep; they are documented for follow-up.

---

## 2. What Fake / Mock / Demo Data Was Removed

- **DashboardPage.tsx:** All of: `categoryDistribution`, `brandPerformanceData`, `brandAudienceData`, `profileViewsData`, `socialPowerGrowth`, `xSpacesData`, `xSpacesStats`, `credibilityGrowth`, `popularityMetrics`, and the fake “Industry Avg” series and `defaultIndustry` in the skills radar. The category pie chart and its legend were replaced by an empty state. The Skills chart now shows only real profile skills or an empty state.

---

## 3. What Still Remains and Why

- **Circles/KOL:** `demoCircles`, `demoCreators`, `demoMembers` remain in their components to provide preview UX; they are **not** presented as saved data. Nav and in-page banners state “Coming soon” and “not saved.”
- **CreatorProfileDemo / CreatorProfilePage:** Demo data remains for demo/showcase routes; not used as the main logged-in profile view.
- **PublicProfilePage / PublicStandalonePage:** Default demo payload when `data` is not passed; production should ensure these views receive real `data` so fallback is not shown.
- **DailyDropBanner** `mockProfiles`: Still present; if shown in production, should be replaced with real featured profiles or removed (not changed in this pass).
- **InsightsTab.tsx:** Still contains full deep analytics UI; it is **no longer rendered** for the profile/user insights routes (App now uses InsightsSnapshot with `snapshotOnly`). InsightsTab is only referenced in its own file; if any other route used it, that would need to be updated to use snapshot-only or Analytics.

---

## 4. Routes / Components / APIs Touched

| Area | Routes/Components/APIs |
|------|-------------------------|
| Dashboard | `DashboardPage.tsx` (charts, stats, brand cards, banner, section headers, empty states, imports). |
| Circles/KOL | `App.tsx` (nav labels), `CirclesOverviewPage.tsx` (banner, subtitle), `KOLListsPage.tsx` (banner, subtitle). |
| Analytics ownership | `InsightsSnapshot.tsx` (new `snapshotOnly` prop and snapshot-only branch), `App.tsx` (pass `snapshotOnly` for `profileInsights` and `userInsights`). |
| Org deal reviews | `apps/web/src/app/api/reviews/route.ts` (new org-deal path with `deal_id`). |
| No DB migrations | Org deal completion already enforced by existing trigger; reviews table already supports `deal_id` and trigger. |

---

## 5. DB Migrations Added

**None.** Org deal completion was already correct (trigger sets `status = 'completed'` when both `delivered_at` and `accepted_at` are set). The reviews table and trigger already support org deals; only the API was extended to create reviews for them.

---

## 6. Final Verdict: Launch-Safe or Not Yet

**Verdict: Launch-safe from a credibility perspective**, with the following conditions.

- **Dashboard:** No chart or KPI is driven by mock data in production; only real deal/profile data or explicit empty states and links to Analytics.
- **Circles/KOL:** Clearly labeled as “Coming soon” and “not saved”; no user can reasonably believe lists are persisted.
- **Analytics:** Deep analytics live only on `/analytics`; Profile Insights is snapshot-only with a clear “See full analytics” link.
- **Org deals:** Completion is already correct via trigger; org-deal reviews can be created via `POST /api/reviews` with `deal_id`.

**Recommended follow-up (non-blocking):**

- Replace or remove **DailyDropBanner** mock profiles if that banner is shown in production.
- Ensure **PublicProfilePage** and **PublicStandalonePage** are never rendered without real `data` on production paths.
- Optional: Add a single “Complete deal” or “Mark completed” UX for org deals if product wants an explicit button (backend already supports it via mark-accepted after deliver).

---

*End of LINKARY_LAUNCH_CREDIBILITY_REMEDIATION.md*
