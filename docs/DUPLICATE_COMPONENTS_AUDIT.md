# Duplicate components audit (figma/app/components)

**Scope:** `apps/web/src/figma/app/components/` — duplicate or near-duplicate pages/sections.  
**Ignore:** Auth and wallet flows.  
**Goal:** Merge impact list, canonical component per group, and minimal safe file actions.

---

## 1) Duplicates ranked by merge impact

### High impact (same layout + copy + CTAs, repeated in 4+ files)

| Rank | Group | Why duplicate | Canonical | Remove or alias |
|------|--------|----------------|-----------|------------------|
| 1 | **UserProfilePage, CreatorProfilePage, BrandProfilePage, AgencyProfilePage** | Same card layout, same helpers (cn, Stars, ScorePills, Button, Card), same sections (scores, links, reviews). Only theme color and demo data differ (amber vs indigo vs cyan vs purple). | **One shared component** e.g. `ProfileDemoPage` with `variant: "user" \| "creator" \| "brand" \| "agency"` and shared `ScorePills`, `Stars`, `Card`, `Button` from SharedComponents or a single profile layout. | **Merge:** Extract shared layout + theme; keep 4 thin wrappers that pass variant + data, or one component with variant. **Files:** `UserProfilePage.tsx`, `CreatorProfilePage.tsx`, `BrandProfilePage.tsx`, `AgencyProfilePage.tsx` — refactor into one (or one + small wrappers). |

### Medium impact (two versions of same feature)

| Rank | Group | Why duplicate | Canonical | Remove or alias |
|------|--------|----------------|-----------|------------------|
| 2 | **PricingPage vs PricingPageRefined** | Two pricing UIs; same concept (plans, features, CTA). App already uses only PricingPageRefined for both `pricing` and `pricingRefined` routes. | **PricingPageRefined** | **Delete or alias:** `apps/web/src/figma/app/components/monetization/PricingPage.tsx` — remove file or keep as re-export of PricingPageRefined. No nav change. |
| 3 | **PublicProfileDemo vs PublicStandalonePage (+ PublicProfilePage)** | Three ways to show a “public” profile: PublicProfileDemo (wraps PublicProfilePage by type), PublicStandalonePage (uses profile/PublicStandaloneProfile for individual/project), publicCompany uses PublicProfileDemo. Two different visual systems. | **PublicStandalonePage** (or UnifiedProfileLayout via PublicProfilePage) — pick one system. | **Merge:** Use one public profile component for all three types (individual, project, company). **Files:** `PublicProfileDemo.tsx` (wrapper around PublicProfilePage), `PublicStandalonePage.tsx`, `profile/PublicStandaloneProfile.tsx`, `PublicProfilePage.tsx` — consolidate so publicCreator, publicProject, publicCompany all use the same component with a type prop. |

### Lower impact (extra calendar/pricing UIs, dead files)

| Rank | Group | Why duplicate | Canonical | Remove or alias |
|------|--------|----------------|-----------|------------------|
| 4 | **CalendarPage, CalendarRefined, EnhancedCalendarPage** | Three calendar UIs. Only CalendarPage is in sidebar. | **CalendarPage** | **Safe:** Leave as-is for launch. CalendarRefined and EnhancedCalendarPage are not in nav; can delete later or alias to CalendarPage. **Files:** `CalendarPage.tsx`, `monetization/CalendarRefined.tsx`, `monetization/EnhancedCalendarPage.tsx`. |
| 5 | **DiscoveryPage** | Discovery route now renders ExplorePage; DiscoveryPage is no longer imported in App. | **ExplorePage** (already canonical) | **Safe:** Remove unused import already done. **File:** `DiscoveryPage.tsx` — can delete or keep for future “Discovery” tab; no references in App. |
| 6 | **ProjectProfilePage** | Not imported anywhere in the repo. | N/A (dead) | **Done:** Deleted `ProjectProfilePage.tsx`. |

---

## 2) Recommended canonical components (summary)

| Feature | Canonical component | Location |
|---------|---------------------|----------|
| Profile demos (user/creator/brand/agency) | Single shared layout with variant | Refactor from UserProfilePage, CreatorProfilePage, BrandProfilePage, AgencyProfilePage |
| Pricing | PricingPageRefined | `monetization/PricingPageRefined.tsx` |
| Public link pages (creator/project/company) | PublicStandalonePage or PublicProfilePage | Consolidate PublicProfileDemo + PublicStandalonePage + type prop |
| Calendar | CalendarPage | `CalendarPage.tsx` |
| Explore / Discovery | ExplorePage | Discovery route already aliases to ExplorePage |

---

## 3) Exact file paths — delete or alias (launch-safe, minimal)

- **Done:**
  - `ProjectProfilePage.tsx` — deleted (was not referenced).
  - `monetization/PricingPage.tsx` — replaced with re-export of PricingPageRefined (MonetizationShowcase still imports it).
  - `DiscoveryPage.tsx` — deleted (App no longer imports it; discovery → ExplorePage).

- **Do not delete (used):**
  - All four *ProfilePage (User, Creator, Brand, Agency) — refactor in a follow-up, do not delete before merging.
  - PublicProfileDemo, PublicStandalonePage, PublicProfilePage — consolidate in a follow-up; do not delete before merging.

---

**Audit complete.** Launch cleanup done: ProjectProfilePage deleted, PricingPage is re-export alias, DiscoveryPage deleted. Larger merges (profile demos, public profile system) recommended as post-launch refactor.
