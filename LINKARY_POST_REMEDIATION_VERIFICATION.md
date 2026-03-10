# Linkary — Post-Remediation Verification Report

**Date:** 2026-03-10  
**Scope:** Strict verification that launch-credibility remediation was implemented correctly in code and product behavior.

---

## 1. Dashboard

### Claim 1.1 — No hardcoded production-facing analytics/chart/KPI datasets in DashboardPage or related production dashboard components

**Verification result:** **PASS**

**Evidence:**
- **File:** `apps/web/src/figma/app/components/DashboardPage.tsx`
- **Lines 147–148:** Single comment: `// All chart data is backend-driven or empty state. No mock/sample datasets (launch-credibility remediation).`
- **Grep:** No remaining top-level constants such as `categoryDistribution`, `brandPerformanceData`, `brandAudienceData`, `profileViewsData`, `socialPowerGrowth`, `xSpacesData`, `xSpacesStats`, `credibilityGrowth`, or `popularityMetrics`. The only `const` arrays in the component are: `days` / `order` inside `activityData` useMemo (day labels, not metrics), and `headers` in useEffect. No hardcoded chart datasets.

---

### Claim 1.2 — Every remaining dashboard metric is either real backend-driven data or an explicit empty state

**Verification result:** **PASS**

**Evidence:**
- **Personal stats:** `personalStats` from `useMemo` over `myDeals` and `meStats` (API: `listMyDeals()`, `GET /api/profile/me-stats`). `emptyStats` is the base (zeros); overridden by real counts.
- **Brand cards:** `brandsFromOrgs` from `myOrgs` (API: `listOrgsForUser(uid)`). Revenue/projects/followers/engagement show "—" when 0 (lines 218–230, 311–318, 942–960, etc.).
- **Banner (lines 471–474):** "Your dashboard" and "Numbers below are from your deals and profile. For full X analytics… go to Analytics."
- **Category block (lines 1128–1139):** Explicit empty state: "No category data yet. Add roles and skills…" + "See full analytics →".
- **Skills block (lines 1142–1178):** When `skillsRadarData.length === 0`, shows "No skills added yet." + link to Profile edit; otherwise real data from `profileSkills` (API: `GET /api/profile/skills`).

---

### Claim 1.3 — List every remaining chart and its exact source of truth

**Verification result:** **PASS**

| Chart | Source of truth | Evidence (file:line) |
|-------|-----------------|----------------------|
| **Volume Trend** (AreaChart) | `volumeData` | useMemo: `myDeals` → count by month; `last6MonthLabels()`. Lines 325–350, 1011. |
| **Reputation Growth** (LineChart) | `reputationData` | useMemo: `meStats?.ethos`, `meStats?.xscore`, `meStats?.reputationIndex`; same value repeated per month (no time-series backend). Lines 351–363, 1068. |
| **Weekly Activity** (BarChart) | `activityData` | useMemo: `myDeals` → count by day of week. Lines 365–384, 1106. |
| **Categories** | (no chart) | Empty state only: "No category data yet" + link. Lines 1128–1139. |
| **Your Skills** (RadarChart) | `skillsRadarData` | useMemo: `profileSkills` from `GET /api/profile/skills`; or empty state when length 0. Lines 386–392, 1154–1177. |

**Note:** Reputation Growth uses the same ethos/xscore/index value for every month (no historical series from backend); it is still backend-driven (me-stats), not mock.

---

## 2. Circles / KOL

### Claim 2.1 — Sidebar/nav labels clearly show “Coming soon”

**Verification result:** **PASS**

**Evidence:**
- **File:** `apps/web/src/figma/app/App.tsx`
- **Lines 1001, 1004:**  
  `label="Circles (Coming soon)"`  
  `label="KOL Lists (Coming soon)"`

---

### Claim 2.2 — Page banners state that lists are not saved yet

**Verification result:** **PASS**

**Evidence:**
- **CirclesOverviewPage.tsx (lines 168–175):**  
  Banner: "Coming soon" / "Circles are not saved yet. Data below is for preview only. Save and reuse of creator lists will be available in a future update."  
  Subtitle: "Build and manage your creator networks (preview — not saved)".
- **KOLListsPage.tsx (lines 171–173, 189):**  
  Banner: "Coming soon" / "KOL lists are not saved yet. Data shown is for preview only. Save and reuse will be available in a future update."  
  Subtitle: "Build creator lists for campaigns and gigs (preview — lists are not saved)".

---

### Claim 2.3 — No user could reasonably mistake circles/KOL preview data as persisted personal data

**Verification result:** **PASS**

**Evidence:** Nav labels and in-page banners explicitly state "Coming soon", "not saved yet", and "preview only". Demo circles/creators remain for preview UX but are clearly framed as non-persisted.

---

## 3. Analytics ownership

### Claim 3.1 — Profile Insights and User Insights now render snapshot-only

**Verification result:** **PASS**

**Evidence:**
- **File:** `apps/web/src/figma/app/App.tsx`  
  - **Lines 4669–4679:** For `route.name === "profileInsights"` and `route.name === "userInsights"`, only `<InsightsSnapshot … snapshotOnly />` is rendered (with `snapshotOnly` prop).
- **File:** `apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx`  
  - **Lines 25–31:** Interface includes `snapshotOnly?: boolean`.  
  - **Line 136:** Default `snapshotOnly = false`.  
  - **Lines 330–366:** When `snapshotOnly` is true, component returns only: ProfileHeaderCard, TrustStrip, and one card ("Credibility snapshot" + "See full analytics" link to `/analytics`). No social graph, top followers, refresh, or deep X analytics.

---

### Claim 3.2 — Deep analytics no longer appear on profile surfaces

**Verification result:** **PASS**

**Evidence:** The only insights routes used in App are `profileInsights` and `userInsights`, both rendering `InsightsSnapshot` with `snapshotOnly`. `InsightsTab` (full deep analytics) is not imported or rendered in App.tsx; it exists only as an export in `InsightsTab.tsx`. Therefore no profile route shows deep analytics.

---

### Claim 3.3 — /analytics is the only deep analytics destination

**Verification result:** **PASS**

**Evidence:** Snapshot-only view explicitly links to `/analytics` for "full X analytics, time-series, top followers, and backfill". Dashboard banner and chart section also link to Analytics. Deep analytics UI (init-status, backfill, rollups, top drivers, etc.) lives in AnalyticsPage, which is rendered for `route.name === "analytics"` (path `/analytics`).

---

## 4. Org deal reviews

### Claim 4.1 — POST /api/reviews supports (a) gig_deal flow and (b) org deal flow via deal_id

**Verification result:** **PASS**

**Evidence:**
- **File:** `apps/web/src/app/api/reviews/route.ts`
- **Path 1 — Org deal (lines 50–109):** When `body.deal_id` is provided, deal is loaded from `deals`, status must be `"completed"`, caller must be profile party or org admin; insert uses `deal_id`, `reviewer_type`/`reviewee_type` (profile vs org), and corresponding ids. `gig_deal_id` is null.
- **Path 2 — Gig deal (lines 111–166):** When `body.reviewee_profile_id` is provided, a matching `gig_deals` row (active or completed) is required; insert uses `gig_deal_id`, profile-to-profile reviewer/reviewee. `deal_id` not set in this path.

---

### Claim 4.2 — Auth and party validation correct

**Verification result:** **PASS**

**Evidence:**
- **Auth:** Token required; `supabase.auth.getUser(token)`; 401 if missing or invalid (lines 15–26).
- **Org deal:** `isProfileParty = d.profile_id === reviewerProfileId`; `isOrgParty` from `org_members` with role owner/admin. If neither, 403 "Only a party to this deal can leave a review" (lines 65–75).
- **Gig deal:** Reviewer and reviewee must be the two parties of the gig deal (via `.or()` filter); self-review blocked (reviewee_profile_id === reviewerProfileId → 400) (lines 116–118).

---

### Claim 4.3 — Completed-deal requirement enforced

**Verification result:** **PASS**

**Evidence:**
- **Org deal (lines 61–63):** `if (d.status !== "completed") return NextResponse.json({ error: "Reviews only allowed for completed deals" }, { status: 400 });`
- **Gig deal:** Only gig_deals with `status IN ('active', 'completed')` are considered (line 126). DB trigger for reviews enforces deal validity; API does not allow non-active/non-completed gig deals in the query.

---

## 5. Production truth scan

**Search:** Production-facing routes/components for `demo`, `mock`, `sample`, `placeholder`, `fake`, `fallback`.

### (a) Safe internal / demo-only

| Location | Term | Classification |
|----------|------|----------------|
| **CreatorProfileDemo.tsx** | demoCreator, DEMONSTRATION | Demo component; not used as main profile view. |
| **CreatorProfilePage.tsx** | demoCreatorData | Demo; same. |
| **PublicProfileDemo.tsx** | sampleCreatorProfile, sampleProjectProfile, sampleCompanyProfile, placeholder, Demo | Demo wrapper; imported in App but not rendered in main route switch — effectively demo-only. |
| **MonetizationShowcase.tsx** | Demo Modal, placeholder | Explicit showcase; HostDashboard / AvailabilitySettings used there. |
| **HostDashboard.tsx** | Demo: Multiple X Spaces, Demo speaker requests | Used in MonetizationShowcase (showcase route). |
| **AvailabilitySettings.tsx** | Demo speaker reputation, Placeholder, Design Only | Same. |
| **ReputationCardGenerator.tsx** | Mock download, Demo mode | Demo/showcase behavior. |
| **InsightsTab.tsx** | sampleLabel | Prop for TopFollowersCard label ("Sample" when data present); not fake data. |
| **ProfileDashboardPage.tsx** | Coming soon (empty state) | Empty state copy. |
| **api/overview/stats/route.ts** | "No mock data" | Comment only. |
| **api/landing/featured/route.ts** | "no mock data" | Comment only. |
| **api/cron/xspaces-stats/route.ts** | placeholder worker | Internal cron; message says not implemented. |
| **api/wallet/cdp/send-test/route.ts** | placeholder | Documented; client uses CDP SDK. |
| **debug/x-tweets/page.tsx** | fallback (Suspense) | React Suspense fallback; not data. |

### (b) Still risky in production

| Location | Term | Risk |
|----------|------|------|
| **DailyDropBanner.tsx** | mockProfiles | Component contains hardcoded `mockProfiles` array. **Not currently rendered** anywhere in the codebase (grep for usage found none). If later added to overview/landing, would show fake profiles. **Recommendation:** Remove or replace before ever rendering on a production route. |
| **PublicProfilePage.tsx** | demoPublicProfileData | Uses `data ?? demoPublicProfileData` (line 159). **Not rendered directly in App.tsx**; only used inside PublicProfileDemo with real `data`. If any route ever renders PublicProfilePage without `data`, users would see demo. **Recommendation:** Ensure any production use passes real `data`. |
| **PublicStandalonePage.tsx** | demoProjectProfile, demoPublicProfile | Always uses demo data (`profileData = profileType === 'project' ? demoProjectProfile : demoPublicProfile`). **Imported in App.tsx but not rendered** in the route switch. If wired to a main nav route, would show demo-only content. **Recommendation:** Do not expose on production routes without real data; or label as preview/demo. |

### (c) Harmless UI fallback

| Location | Term | Notes |
|----------|------|--------|
| **SharedComponents.tsx** | fallbackGradient | Avatar UI fallback when no image. |
| **BrandProfilePage.tsx** | Empty fallback when no org data | Comment; no mock payload. |
| **OrgDetailPage.tsx** | supportersSample | Real data from API; name means "preview slice". |
| **api/orgs/connect-x-callback/route.ts** | fallback user_metadata | Identity extraction fallback. |
| **api/me/profile-status/route.ts** | Fallback (comment) | Username claim logic. |
| **api/auth/safe-redirect-url/route.ts** | FALLBACK_ORIGIN | Default origin constant. |
| **api/auth/post-login-bootstrap/route.ts** | fallback (comment) | Safe slug. |
| **api/analytics/x/summary/route.ts** | source: "fallback" | Data source label for UI. |
| **PublicOnePagerWrapper.tsx** | analyticsSource fallback | Source label. |
| **api/xspaces/my-x-spaces/route.ts** | fallback_used, linkary_fallback | When X API unavailable, return Linkary spaces; documented. |
| **api/wallet/external/set-primary/route.ts** | fallbackAddress | CDP wallet fallback. |
| **api/orgs/[orgId]/supporters/route.ts** | sample list | Returns real supporter list (sample = slice). |
| **profiles.ts** | placeholders (comment) | Username claim. |
| **resolveEntityMediaUrls.ts** | fallback | URL resolution. |
| **ui/input-otp.tsx** | hasFakeCaret | Accessibility caret. |
| **CreateOrgModal, OrgDetailPage, etc.** | placeholder (input attr) | Form input placeholders; not data. |

---

## 6. Anything still risky before launch

1. **DailyDropBanner:** Contains `mockProfiles` but is **not rendered** anywhere. If it is ever added to overview or landing, replace with real featured API or remove.
2. **PublicProfilePage / PublicStandalonePage:** Default demo payload when `data` is missing. Ensure production never renders these without real `data` (e.g. from server or redirect).
3. **MonetizationShowcase / HostDashboard / AvailabilitySettings:** Demo/placeholder copy; if the monetization-flow or host dashboard route is linked from main nav for all users, consider labeling as "Preview" or gating.

No remaining **dashboard** mock data; no **circles/KOL** confusion; **analytics ownership** and **org deal reviews** are correctly implemented.

---

## 7. Final recommendation

**Ready for launch QA:** **Yes.**

Remediation is correctly implemented:

- Dashboard has no hardcoded chart/KPI data; all metrics are backend-driven or explicit empty states.
- Circles and KOL are clearly "Coming soon" and "not saved" in nav and on-page.
- Profile and User Insights are snapshot-only; deep analytics only on `/analytics`.
- POST /api/reviews supports both gig and org deals with correct auth, party checks, and completed-deal requirement.

Before launch, it is **recommended** (non-blocking) to:

- Confirm no production route renders `PublicProfilePage` or `PublicStandalonePage` without real `data`.
- If `DailyDropBanner` is ever wired into the app, remove mock profiles or replace with real featured content.

---

*End of LINKARY_POST_REMEDIATION_VERIFICATION.md*
