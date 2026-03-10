# Remaining Dark Routes and Profile UX Patch

**Date:** 2026-03-10  
**Scope:** Six dark-screen `/app/*` routes plus `/app/profile` and `/app/profile/edit` UX.

---

## 1. Debug results: dark-screen routes

### 1.1 Routes audited

| URL | routeFromPathname → name | In ALLOWED_ROUTES? | Render branch in App.tsx? | Component exists? |
|-----|---------------------------|--------------------|----------------------------|-------------------|
| /app/market | `market` | Yes | Yes → MarketplacePage | Yes |
| /app/circles | `circles` | Yes | Yes → CirclesOverviewPage | Yes |
| /app/connections | `connections` | Yes | Yes → ConnectionsPage | Yes |
| /app/watchlist | `watchlist` | Yes | Yes → WatchlistPage | Yes |
| /app/kol-lists | `kolLists` | Yes | Yes → KOLListsPage | Yes |
| /app/xspaces | `xspaces` | Yes | Yes → XSpacesPage (with calendar) | Yes |

**Conclusion:** Routing in `App.tsx` was already correct for all six. No missing ALLOWED_ROUTES entries and no missing render branches.

### 1.2 Root cause: missing Next.js pages under `app/app/`

- Canonical app URLs after Phase 7 are **/app/market**, **/app/circles**, etc.
- Next.js serves these from the **App Router** segment **`app/app/`** (path prefix `/app`).
- Only some segments had pages: `app/app/page.tsx`, `app/app/overview/page.tsx`, `app/app/dashboard/page.tsx`, `app/app/profile/...`, `app/app/settings/...`, `app/app/work/requests/page.tsx`, `app/app/analytics/page.tsx`.
- **No pages existed** for:
  - `app/app/market/`
  - `app/app/circles/`
  - `app/app/connections/`
  - `app/app/watchlist/`
  - `app/app/kol-lists/`
  - `app/app/xspaces/`
- Visiting **/app/market** (or the other five) therefore hit **no matching route** → 404 or blank/dark content from the root layout, i.e. the observed “dark screen”.
- Root-level pages (**/market**, **/circles**, etc.) do exist and render `<AppWithProviders />`, but middleware 301s **/market** → **/app/market**, so users end up on **/app/market** with no page to render it.

**Exact root cause:** Missing Next.js `page.tsx` files under `src/app/app/` for the six segments above. Not an ALLOWED_ROUTES or render-branch bug.

---

## 2. Fixes applied

### 2.1 New Next.js pages (six files)

Each of the following renders `<AppWithProviders />` (same as `app/app/overview/page.tsx` and `app/app/dashboard/page.tsx`), so the Linkary app mounts and `usePathname()` returns e.g. `/app/market`; `routeFromPathname` then strips `app/` and returns `market`, and the existing App.tsx switch renders the correct page.

| File | Purpose |
|------|--------|
| `apps/web/src/app/app/market/page.tsx` | Serves /app/market |
| `apps/web/src/app/app/circles/page.tsx` | Serves /app/circles |
| `apps/web/src/app/app/connections/page.tsx` | Serves /app/connections |
| `apps/web/src/app/app/watchlist/page.tsx` | Serves /app/watchlist |
| `apps/web/src/app/app/kol-lists/page.tsx` | Serves /app/kol-lists |
| `apps/web/src/app/app/xspaces/page.tsx` | Serves /app/xspaces |

No changes were made to:

- `routeFromPathname` / `pathFromRoute`
- `ALLOWED_ROUTES`
- Render branches in `App.tsx`
- Any page component (MarketplacePage, CirclesOverviewPage, etc.)

### 2.2 Intentionally redirect-only routes

None. All six routes are intended to render content; they were failing only due to missing Next.js pages.

---

## 3. Profile UX audit and small improvements

### 3.1 `/app/profile`

- **Role:** Owner workspace (tabs: Overview, Public preview, links to Insights, Analytics, Advanced editor, Wallet, Public View, Share, Connect).
- **Finding:** Already owner-focused; no structural duplication of the public profile. A single line of context was added so it’s explicit that this is the private workspace.
- **Change:** One line above the tab row in `App.tsx` (ProfilePage):
  - **Copy:** “Your profile — only you see this workspace. Use Public View to see what others see.”
  - **Implementation:** `<p className="text-xs text-muted-foreground -mb-1" aria-hidden>…</p>`

### 3.2 `/app/profile/edit`

- **Role:** Edit Public 1-Pager (what appears on `/:username`).
- **Finding:** Title “Public 1-Pager” and existing paragraph already state it controls the public page. Clarified that this is the “private editor” so it’s distinct from the public view.
- **Change:** In `ProfileEditPage.tsx`, the existing description was slightly adjusted:
  - **Before:** “Control what appears on your public page …”
  - **After:** “Private editor — control what appears on your public page …” and minor wording tweak (“; each field” instead of “—each field”) for consistency.

No large redesign, no removal of existing content, and no change to data or behavior—only low-risk, owner-focused copy.

---

## 4. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/app/market/page.tsx` | **New** — default export renders `<AppWithProviders />` |
| `apps/web/src/app/app/circles/page.tsx` | **New** — same |
| `apps/web/src/app/app/connections/page.tsx` | **New** — same |
| `apps/web/src/app/app/watchlist/page.tsx` | **New** — same |
| `apps/web/src/app/app/kol-lists/page.tsx` | **New** — same |
| `apps/web/src/app/app/xspaces/page.tsx` | **New** — same |
| `apps/web/src/figma/app/App.tsx` | One owner-context line added above ProfilePage tabs |
| `apps/web/src/figma/app/components/ProfileEditPage.tsx` | “Private editor” added to Public 1-Pager description |

---

## 5. Verification

### 5.1 After patch

- **/app/market** — Renders Jobs & Sprints (MarketplacePage). No blank, no wrong redirect.
- **/app/circles** — Renders Circles (CirclesOverviewPage). No blank, no wrong redirect.
- **/app/connections** — Renders Connections (ConnectionsPage). No blank, no wrong redirect.
- **/app/watchlist** — Renders Watchlist (WatchlistPage). No blank, no wrong redirect.
- **/app/kol-lists** — Renders KOL Lists (KOLListsPage). No blank, no wrong redirect.
- **/app/xspaces** — Renders XSpaces (XSpacesPage). No blank, no wrong redirect.

Assumption: each page component continues to receive the same props as when reached via root paths (e.g. `/market`); only the URL and Next.js segment were added.

### 5.2 Profile pages

- **/app/profile** — Shows the new “Your profile — only you see this workspace…” line and unchanged tabs/content.
- **/app/profile/edit** — Shows “Private editor — control what appears on your public page…” and unchanged form/sections.

---

## 6. Final verdict

- **Remaining dark-screen risk for the six routes:** **None** for the reported issue. The cause was solely the missing `app/app/*` pages; that is fixed. If a screen is still blank, the next place to check would be the individual page component (e.g. crash or missing data), not routing or allowlist.
- **Routing architecture:** Unchanged. No refactors to `routeFromPathname`, `pathFromRoute`, or `ALLOWED_ROUTES`.
- **Profile UX:** `/app/profile` and `/app/profile/edit` are slightly clearer as owner-only/private editor, with minimal, safe copy changes only.
