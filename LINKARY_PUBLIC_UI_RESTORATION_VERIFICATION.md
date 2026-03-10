# Public Profile UI Restoration — Strict Verification

**Date:** 2026-03-10  
**Purpose:** Confirm the UI regression fix is implemented in the correct layer and that API vs rendering separation is intact.

---

## 1. API route: JSON-only, no UI

**File:** `apps/web/src/app/api/public/profile/route.ts`

| Check | Result |
|-------|--------|
| Remains a JSON API only | **Yes.** All responses use `NextResponse.json(...)` (errors: 400/404/500 with JSON body; success: 200 with payload). |
| Renders React components? | **No.** No JSX, no `createElement`, no component return. |
| Imports or uses PublicProfileContent? | **No.** Grep for `PublicProfileContent`, `React`, `JSX`, `render`, `createElement`: **no matches.** |
| Exports | `export const runtime`, `export type PublicProfileApiPayload`, `export async function GET`. No default export. |

**Conclusion:** The API route is a pure HTTP JSON API. It does not render any UI and does not depend on PublicProfileContent or any React component. The fix did not move rendering into the API layer.

---

## 2. Page route: sole place that chooses and renders UI

**File:** `apps/web/src/app/(public)/[username]/page.tsx`

| Check | Result |
|-------|--------|
| Decides PublicProfileContent vs PublicOnePagerWrapper? | **Yes.** For the slug branch and the wallet/UUID branch: when `!viewBrochure`, it fetches `GET /api/public/profile?username=...`; if `res.ok`, it returns `<PublicProfileContent data={data} ... />`; otherwise (or on catch, or when `viewBrochure`) it returns `<PublicOnePagerWrapper ... />`. |
| Fetches payload safely? | **Yes.** Server-side `fetch` to same-origin API with `cache: "no-store"`. Uses `canonicalSlug` or `canonicalUsername` for the query. On failure, falls back to PublicOnePagerWrapper; no throw. |
| Imports | Imports `PublicProfileContent` from `./PublicProfileContent` and `PublicOnePagerWrapper` from `./PublicOnePagerWrapper`. Renders one or the other; does not pass React into the API. |

**Conclusion:** The **page** is the only place that renders PublicProfileContent or PublicOnePagerWrapper for the public profile/org. The API is only called for data; rendering stays in the page.

---

## 3. Restored public page content (PublicProfileContent)

**Component:** `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx`  
**Data:** Receives `data: PublicProfileApiPayload` (same shape as API response).

Verified that the component consumes and uses the previously optimized fields:

| Area | In payload / component |
|------|------------------------|
| Layout presets | `profile.public_layout` → classic / spotlight / showcase / compact; `layoutPreset`, `isSpotlight`, `isShowcase`, `isCompact`. |
| Hero | `hero?.hero_image_url`, `hero?.hero_video_url`, `hero?.hero_title`; `hasHeroImage`, `hasHeroVideo`, `heroTitle`, `hasHero`. |
| Section order/hidden | `profile.layout_order`, `profile.layout_hidden` → `resolvedOrder`, `resolvedHidden`, `visibleOrder`. |
| Featured items | `profile.featured_case_study_id`, `featured_review_id`, `featured_gig_id` → `featuredCaseStudy`, `featuredReview`, `featuredGig`, `showFeatured`. |
| Relations | `relations` (ambassadors, affiliates, ecosystemProjects, subsidiaries, ambassadorOf, affiliateOf); `hasAnyRelation`. |
| Gigs / team | `data.gigs`, `team`; sections for gigs (project/company) and team (company). |
| Skills / achievements | `skills`, `achievements` (destructured from `data`). |
| Trust / action / starter | Sections `trust_strip`, `action_bar`, `starter_block` render `<TrustStrip>`, `<ActionBar>`, `<StarterBlock>`. |

**Conclusion:** The restored public page (when rendered via PublicProfileContent with API payload) includes layout presets, hero, section order/hidden, featured items, relations, gigs/team where applicable, skills/achievements, and trust/action/starter blocks. No inconsistency found with the restoration summary.

---

## 4. Other routes (no regression)

| Route | Responsible file(s) | Rendering | Verified |
|-------|----------------------|-----------|----------|
| Public org `/:slug` | Same `[username]` page; segment resolves to org. | Same flow: fetch API (with org slug) → PublicProfileContent when ok; API returns org payload with `profile_type` for org. | **No regression.** |
| `/u/:username` | `apps/web/src/app/u/[username]/page.tsx` | Fetches `/api/public/profile?username=...` (or owner preview API); renders `<PublicProfileContent data={data} ... />` + optional LeaveReviewBlock. | **Unchanged;** still uses PublicProfileContent with API payload. |
| `/app/profile` | App route → LinkaryApp → ProfilePage in App.tsx. | ProfilePage (owner workspace). | **Not modified by restoration.** |
| `/app/profile/edit` | App route → LinkaryApp → ProfileEditPage. | ProfileEditPage (Public 1-Pager editor). | **Not modified by restoration.** |
| Insights (`/u/:username/insights`, `/app/profile/insights`) | App route or page → LinkaryApp; route name `userInsights` / `profileInsights` → InsightsSnapshot. | InsightsSnapshot. | **Not modified by restoration.** |

---

## 5. Summary of responsibilities

| Layer | Responsibility |
|-------|----------------|
| **API** `route.ts` | Build PublicProfileApiPayload (entity → DTO → profile/org payload); return JSON only. No React, no rendering. |
| **Page** `[username]/page.tsx` | Resolve entity (slug/wallet/UUID); optionally fetch API; **choose** PublicProfileContent (normal, when API ok) or PublicOnePagerWrapper (brochure/fallback); **render** the chosen component with the fetched or entity-derived data. |
| **PublicProfileContent** | Consume PublicProfileApiPayload and render the full section-rich public UI (layout, hero, sections, featured, relations, gigs, team, skills, achievements, trust/action/starter, etc.). |

---

## 6. Inconsistencies with prior doc

- **None.** The prior summary stated that the API stays JSON-only and the page does the rendering; verification confirms that. The doc stated that PublicProfileContent receives the full API payload and includes the listed sections; the codebase matches.

---

## 7. Final verdict

- **Fix in correct layer:** Yes. Rendering lives only in the page and in PublicProfileContent; the API remains a JSON-only handler.
- **API remains JSON-only:** Yes. No React imports, no component usage, only `NextResponse.json`.
- **Page route is the one rendering the restored UI:** Yes. The page fetches the API and renders either PublicProfileContent (restored optimized UI) or PublicOnePagerWrapper (brochure/fallback).
- **Restored content present:** PublicProfileContent uses layout presets, hero, section order/hidden, featured items, relations, gigs, team, skills, achievements, and trust/action/starter blocks from the payload.
- **Other routes:** No regression identified for public org, `/u/:username`, `/app/profile`, `/app/profile/edit`, or insights.

**Verdict: Public UI restoration is implemented correctly. The API is still just an API; the page route is the one rendering the restored UI.**
