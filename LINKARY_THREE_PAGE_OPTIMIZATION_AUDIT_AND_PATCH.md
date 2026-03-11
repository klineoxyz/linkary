# Linkary — Three-Page Optimization Audit and Patch

**Date:** 2026-03-10  
**Scope:** Full-page audit and optimization for the 3 target owner/public surfaces. No partial patches; restore or improve the intended optimized experience without breaking URL architecture.

---

## 1. Target Pages Audited

| # | Page | Route(s) | Primary component(s) |
|---|------|----------|------------------------|
| 1 | **Public profile** | `/:username`, `/:slug` (org) | `[username]/page.tsx` → `PublicProfileContent` |
| 2 | **View Insights** | `/app/profile/insights` | `InsightsSnapshot` (no `snapshotOnly`) |
| 3 | **Owner profile (Overview)** | `/app/profile` (tab: overview) | `ProfilePage` in App.tsx |

**Note:** `/app/profile/edit` is the **Public 1-Pager (Advanced) editor**; the “third optimized page” in scope is the **owner’s profile Overview** at `/app/profile`, not the edit page. The edit page is the control surface; the Overview is what the owner sees as their profile workspace.

---

## 2. Page 1 — Public profile `/:username` (and `/:slug`)

### 2.1 Current layout structure

- **Data:** Server-side `buildPublicProfilePayloadFromEntity(entity, serviceSupabase)` (no internal API fetch for initial render). Entity from `getPublicEntityByUsername` + media resolution.
- **Layout:** Single route `(public)/[username]/page.tsx`; when `!viewBrochure` and entity exists → `PublicProfileContent` with full `PublicProfileApiPayload`.
- **Structure:** Full-width hero (if in `visibleOrder` and has image/video/title) → two-column grid (classic/showcase/compact) or single-column (spotlight). Left: `header_media`, `header`, `roles`, `socials`, `proof`, `trust_strip`. Right: `action_bar`, `starter_block`, `featured`, `token`, `team`, `gigs`, `relations`, `skills`, `achievements`, `case_studies`, `links`, `cv`, `partner_programs`, `reviews`, `completed_collabs`. Section order and hidden come from `public_layout` or preset defaults.

### 2.2 Section order

- From `publicLayoutPresets`: `PRESET_DEFAULT_ORDER` and `SECTION_KEYS`; `resolvedOrder` / `resolvedHidden` / `visibleOrder` drive what appears and in what order. Left/right columns from `LEFT_COLUMN_KEYS` / `RIGHT_COLUMN_KEYS`. No disorder found.

### 2.3 What was already fixed (recent work)

- Switched to **direct payload build** via `buildPublicProfilePayloadFromEntity` (no fragile server fetch to `/api/public/profile`).
- **Power** (`reputation_index`) and **Ethos** / **REP** in header from view/DTO fallbacks.
- **ETHOS pill** tier-based styling (entry → elite) using Linkary primary.
- Layout presets, hero, section order/hidden, featured, relations, gigs, team, skills, achievements, reviews, case studies, trust strip, action bar, starter block all wired and rendered.

### 2.4 What was still missing / weak

- **Duplicate REP in header:** Both a tier pill (e.g. “Rising”) and `RepPillWithBreakdown` (REP score number + modal) were shown when `rep_score` was set, cluttering the credibility strip.
- **Information hierarchy:** Header already has clear h1 (display name), type badge, location, then score pills; no structural change required. Deduplication improves clarity.

### 2.5 Optimization applied (Page 1)

- **REP deduplication:** When `profile.rep_score != null`, only **RepPillWithBreakdown** is shown (numeric REP + breakdown modal). The standalone tier-only pill was removed so REP appears once, with one clear CTA for details.

### 2.6 Files changed (Page 1)

- `apps/web/src/app/(public)/[username]/PublicProfileContent.tsx`: Removed the duplicate REP tier pill when `RepPillWithBreakdown` is rendered (lines ~599–607: removed the `<span className={tierPillClass(...)}>` block; kept `RepPillWithBreakdown`).

### 2.7 Before/after summary (Page 1)

- **Before:** Header showed tier label (e.g. “Rising”) and “REP 75” button; two REP elements.
- **After:** Single REP representation: “REP {score}” button with breakdown modal. Cleaner credibility strip; no duplicate information.

---

## 3. Page 2 — View Insights `/app/profile/insights`

### 3.1 Current layout structure

- **Route:** `/app/profile/insights` → `route.name === "profileInsights"` → `InsightsSnapshot` with no `snapshotOnly` (full page).
- **Structure:** `ProfileHeaderCard` → `TrustStrip` → (own profile) refresh button + X connect CTA when no handle → grid: **ScoreCard** + **TopFollowersCard** (tabs: Creators / Projects / Brands) → **SocialGraphCard** + **TopFollowersByScoreTiersCard** → **Partners** (Affiliated / Ambassador toggle) → **RecommendedAccountsCard`. “See all” modal for top followers.

### 3.2 Section order

- Order is fixed: header → trust → refresh/empty state → (Score + Top followers) → (Social graph + Bar by tiers) → Partners → Recommended. Logical and matches requested structure.

### 3.3 What was already fixed (recent work)

- Full **InsightsSnapshot** (no `snapshotOnly`) for `/app/profile/insights`.
- **Top followers** tabs: Creators, Projects, Brands.
- **TopFollowersByScoreTiersCard** with Linkary orange bar styling.
- **Partners** island with Affiliated / Ambassador toggle.
- **RecommendedAccountsCard** present. Account feed island removed per product decision.

### 3.4 What was still missing / weak

- **No page title:** Page had no clear h1 (“Insights” or “Your X insights”), so hierarchy and accessibility were weak.
- **No at-a-glance summary:** Missing a compact line (e.g. followers count, X handle, last cache update) at the top to anchor the page.
- **See all modal:** “See all” for top followers opened a modal with placeholder copy (“Nothing here yet”) instead of the actual list when data existed.

### 3.5 Optimization applied (Page 2)

- **Page heading:** Added an `<h1>` at the top: “Insights” (for own profile) or “Insights for @{handle}” (when viewing another user), with short supporting line.
- **At-a-glance bar:** When insights data exists, added a compact summary line: followers, following, tweets (when available), and “Data updated {relative time}” from top-followers cache when available.
- **See all modal:** Modal now shows the actual top-followers list for the active tab (Creators/Projects/Brands) when items exist; otherwise shows the empty state. Removed hardcoded “Nothing here yet” when data is present.

### 3.6 Files changed (Page 2)

- `apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx`:
  - Inserted page title block (h1 + description) at top of full (non–snapshotOnly) content.
  - Inserted at-a-glance summary (followers, following, tweets, cache updated) below title when `insights?.profile` or cache meta exists.
  - Updated “See all” modal to render `topFollowersItems` (and tab context) so the list is shown when available; empty state only when no items.

### 3.7 Before/after summary (Page 2)

- **Before:** No h1; no summary line; “See all” modal was placeholder.
- **After:** Clear “Insights” title; one-line at-a-glance (followers, cache updated); “See all” shows real top-followers list for the selected tab.

---

## 4. Page 3 — Owner profile Overview `/app/profile`

### 4.1 Current layout structure

- **Route:** `/app/profile` with tab `overview` (default). **ProfilePage** in App.tsx; tabs: Overview, Public preview, View Insights (link), Analytics (link).
- **Structure:** Owner context line → tab bar → (when Overview) action bar + 3-column grid: **left** = profile summary card (avatar, name, handle, ScorePills, reviews, completed gigs, bio, roles, Ambassador Of, Partnerships, Links) + Core profile form (when own); **right** = AffiliationAmbassadorSection, Featured Work, case studies, etc. Public preview tab = iframe to `/:username` + copy about editor sync.

### 4.2 Section order

- Summary card first, then Core profile, then right-column sections. Order is consistent and matches owner workspace intent.

### 4.3 What was already fixed (recent work)

- **profilePayloadRefreshTrigger:** After saving in ProfileEditPage, trigger increments; ProfilePage refetches `/api/public/profile?username=...&_t={trigger}` so links/relations (and payload) stay in sync with public page.
- Copy under public preview iframe: “Edits in the Public 1-Pager (Advanced editor) appear here and on your public URL after you save.”
- Advanced editor intro: single source of truth copy.

### 4.4 What was still missing / weak

- **Owner context line** was generic: “Your profile — only you see this workspace. Use Public View to see what others see.” It did not explicitly state that **Overview** (summary, links, relations) reflects the same data as the public page after save.

### 4.5 Optimization applied (Page 3)

- **Owner context line** updated to: “Your profile — only you see this. What you see here (links, relations, scores) matches your public page after you save in the Advanced editor. Use Public View to open your public URL.”

### 4.6 Files changed (Page 3)

- `apps/web/src/figma/app/App.tsx`: In ProfilePage, updated the single owner-context `<p>` text to the copy above.

### 4.7 Before/after summary (Page 3)

- **Before:** Context line did not tie Overview content to “same as public page after save.”
- **After:** One sentence explains that Overview and public page stay in sync via the Advanced editor, improving clarity and trust in data consistency.

---

## 5. Summary of All Changes

| Page | File(s) | Change |
|------|---------|--------|
| Public profile | `PublicProfileContent.tsx` | Remove duplicate REP tier pill; keep only RepPillWithBreakdown in header. |
| View Insights | `InsightsSnapshot.tsx` | Add h1 “Insights”; add at-a-glance summary line; fix “See all” modal to show real top-followers list. |
| Owner profile | `App.tsx` (ProfilePage) | Strengthen owner context line to state Overview = same data as public page after save. |

---

## 6. What was not changed (by design)

- **URL architecture:** No change to `/:username`, `/:slug`, `/app/profile`, `/app/profile/insights`, or `/app/profile/edit`. No redirect or route renames.
- **Public profile payload:** Still built with `buildPublicProfilePayloadFromEntity`; no revert to internal fetch for initial render.
- **Insights snapshotOnly:** Still used for `userInsights` (viewing another user’s insights); full page only for `profileInsights`.
- **ProfileEditPage:** No structural change; already has single-source-of-truth copy. Third optimized “owner” page is Overview, not edit.

---

## 7. Final verdict

- **Page 1 (Public profile):** Layout, section order, and content (hero, scores, sections, reviews, case studies, relations, etc.) already matched the intended optimized experience. The only fix was **information quality**: removing duplicate REP in the header. **Verdict: Optimized.**
- **Page 2 (View Insights):** Structure and cards (Top followers with tabs, social graph, bar by tiers, Partners, Recommended) were in place. Missing were **page hierarchy** (title), **at-a-glance summary**, and a **functional “See all” modal**. All three added. **Verdict: Optimized.**
- **Page 3 (Owner profile Overview):** Data sync and tabs were correct. The **owner context line** was strengthened so it is explicit that Overview reflects the public page after save. **Verdict: Optimized.**

**Overall:** The three target pages are now audited and updated for **page-level** optimization: no partial patches, no scope drift, no architecture rollback. Information hierarchy, clarity, and data consistency are improved; the intended optimized experience is restored or strengthened on all three pages.
