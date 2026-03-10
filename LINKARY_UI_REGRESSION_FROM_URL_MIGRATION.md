# UI/Content Regression from URL Migration — Audit and Repair

**Date:** 2026-03-10  
**Scope:** Identify and undo UI/content regressions caused by the URL migration. **URL architecture is unchanged.**

---

## 1. URL architecture (unchanged)

- Public user: `/:username`
- Public org: `/:slug` (same route as username; segment resolves to org when slug claimed)
- In-app user: `/u/:username`
- In-app org: `/org/:slug`
- App pages: `/app/...`

No rollback of routing. Only UI/content was audited and restored where it was downgraded.

---

## 2. Pages audited

### 2.1 Public profile page `/:username`

**Current (pre-fix) rendering chain:**  
`[username]` page (slug branch) → `getPublicEntityByUsername` → `entityToPublicDTO` → `dtoToEntityView` → **PublicOnePagerWrapper** → **PublicOnePager** (entityView).

**Intended / optimized chain (per page docstring):**  
Same data source, but **PublicProfileContent** with full **PublicProfileApiPayload** (layout presets, hero, sections order/hidden, featured items, relations, gigs, team, skills, achievements, links, reviews, token, CV, partner programs, completed collabs, pricing).

**What changed during routing work:**  
The `[username]` page was wired to **PublicOnePagerWrapper** (which renders **PublicOnePager**) instead of **PublicProfileContent**. The in-page docstring still said “Rendered (PublicProfileContent)”, so the optimized UI was the section-rich **PublicProfileContent**, not the simpler one-pager.

**Content/UI that was effectively lost on `/:username`:**

- Layout presets (classic / spotlight / showcase / compact) and custom section order/hidden
- Featured case study / review / gig
- Hero block (image / video / title)
- Full relations (ambassadors, affiliates, ecosystem, subsidiaries, ambassadorOf, affiliateOf)
- Gigs section (project/company)
- Team section (company)
- Skills / achievements
- Custom links (profile_links) in the same layout as the optimized page
- Trust strip, action bar, starter block
- Section cards and completeness prompts keyed off the same payload
- Reviews in the same structure (latest, average, count) as the API payload
- Token/Dexscreener (project)
- CV download, partner programs, completed collabs, pricing block

**Root cause:**  
Component swap: **PublicOnePager** (simpler, entityView-based) was used for the public URL instead of **PublicProfileContent** (API payload, section-rich).

---

### 2.2 Public org page `/:slug`

Same route as `/:username`; segment resolves to org when the slug is an org. The same regression applied: the page rendered **PublicOnePager** instead of **PublicProfileContent**. The public profile API returns a payload for orgs (profile-shaped with org data, caseStudies, reviews). **PublicProfileContent** can render that; with the fix below it is used for orgs as well.  
**Note:** The API org payload was updated to set `profile_type` from `entity.org.org_type` (`"project"` or `"company"`) so PublicProfileContent can show org-specific sections (team, gigs, relations) for orgs.

---

### 2.3 Logged-in `/app/profile`

Rendering: App route `/app/profile` → LinkaryApp → **ProfilePage** (in App.tsx). No component swap found. Owner context line was added in a previous patch. **No regression identified**; no change in this audit.

---

### 2.4 `/app/profile/edit`

Rendering: **ProfileEditPage** (Public 1-Pager editor). “Private editor” copy was added previously. **No regression identified**; no change in this audit.

---

### 2.5 View insights

- **`/u/:username/insights`:** Page renders **AppWithProviders**; pathname yields `userInsights`; App.tsx renders **InsightsSnapshot** with `username`. No swap found.
- **`/app/profile/insights`:** Pathname yields `profileInsights`; App.tsx renders **InsightsSnapshot** (snapshotOnly, no username). No swap found.

**No regression identified** for insights routes; no change in this audit.

---

### 2.6 Generic wrappers replacing optimized pages

The only confirmed swap was on the public profile route: **PublicOnePagerWrapper** + **PublicOnePager** replaced the intended **PublicProfileContent** for `/:username` (and thus `/:slug` when the segment is an org). No other “generic wrapper replaced optimized page” cases were found in the audited scope.

---

## 3. What was restored

### 3.1 Public profile and public org at `/:username` and `/:slug`

**Change:** Use the **optimized** UI when the full API payload is available.

- When the page has a resolved entity (slug or wallet/UUID branch), it now:
  1. Tries to load the **full** public payload from the existing API:  
     `GET /api/public/profile?username={canonicalSlug}` (server-side fetch).
  2. If the response is OK, it renders **PublicProfileContent** with that payload (same component and data shape as `/u/:username` and the API).
  3. If the fetch fails or `?view=brochure` is set, it falls back to **PublicOnePagerWrapper** → **PublicOnePager** (unchanged behavior).

So:

- **Normal view:** Public profile and public org again use **PublicProfileContent** with layout presets, hero, sections, relations, gigs, team, skills, achievements, links, reviews, token, etc., without changing URLs.
- **Brochure view:** Still uses PublicOnePagerWrapper/PublicOnePager.
- **URLs:** Remain `/:username` and `/:slug`; no routing changes.

**Files changed:**

- `apps/web/src/app/(public)/[username]/page.tsx`
  - (as above)
- `apps/web/src/app/api/public/profile/route.ts`
  - For org payload, set `profile_type` from `entity.org.org_type` (`"project"` or `"company"`) so PublicProfileContent renders org-specific sections.
  - Import **PublicProfileContent**.
  - In the slug branch (when entity exists): if not `viewBrochure`, fetch `/api/public/profile?username=...`, then render **PublicProfileContent** with the JSON payload when `res.ok`; otherwise keep **PublicOnePagerWrapper**.
  - In the wallet/UUID branch: same logic (fetch API, then **PublicProfileContent** or fallback).

---

## 4. Routing vs UI/content

| Change type | Description |
|-------------|-------------|
| **Routing (kept)** | Public at `/:username` / `/:slug`, in-app user at `/u/:username`, in-app org at `/org/:slug`, app at `/app/...`. No reversion. |
| **UI/content (repaired)** | Public profile and org at `/:username` / `/:slug` again use **PublicProfileContent** with full API payload when available, instead of the simpler **PublicOnePager**. |

---

## 5. Exact components involved

| Location | Before (regression) | After (restored) |
|----------|----------------------|-------------------|
| `/:username` (and `/:slug`) normal view | PublicOnePagerWrapper → PublicOnePager (entityView) | Fetch API → **PublicProfileContent** (PublicProfileApiPayload) |
| `/:username` brochure view | PublicOnePagerWrapper → PublicOnePager | Unchanged (still PublicOnePagerWrapper) |
| `/:username` fetch failure fallback | — | PublicOnePagerWrapper → PublicOnePager |
| `/u/:username` | PublicProfileContent (API payload) | Unchanged |
| `/app/profile` | ProfilePage | Unchanged |
| `/app/profile/edit` | ProfileEditPage | Unchanged |
| `/u/:username/insights`, `/app/profile/insights` | InsightsSnapshot | Unchanged |

---

## 6. Confirmation that URLs stay on the new architecture

- No changes to Next.js route segments, middleware, or `pathFromRoute` / `routeFromPathname`.
- Public profile and org remain at `/:username` and `/:slug`.
- In-app user and org remain at `/u/:username` and `/org/:slug`.
- App pages remain at `/app/...`.

Only the **component and data** used to render the public profile/org were reverted to the optimized path (PublicProfileContent + API payload).

---

## 7. Final verdict

- **Routing:** Kept. New URL architecture is intact.
- **UI:** Restored for the public profile and org. The public page at `/:username` (and `/:slug`) again uses **PublicProfileContent** with the full **PublicProfileApiPayload** when the API returns successfully, so layout presets, hero, sections, relations, gigs, team, skills, achievements, links, reviews, and other sections are back.
- **Insights, /app/profile, /app/profile/edit:** No regressions found; no changes in this audit.
- **Done:** `profile_type` is now set in the public profile API response for orgs (`org_type` → `"project"` or `"company"`) so PublicProfileContent shows company/project-specific sections for orgs.
