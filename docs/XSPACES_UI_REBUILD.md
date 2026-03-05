# XSpaces UI Rebuild — Plan & Checklists

## Implementation plan (governance pass — executed)

1. **Bug:** Confirmed `loadMyXSpaces` is declared above its `useEffect`; no change needed.
2. **Token sweep:** Replaced all `zinc`, `neutral`, `bg-black/50` in XSpacesPage and xspaces/* with Linkary tokens; overlays use `bg-foreground/50 backdrop-blur-sm`.
3. **SharedComponents:** Option B — XSpaces uses only `StatCard` (light) and `Button`; no broad SharedComponents tokenization.
4. **Navigation:** Removed `activeTab` and its effect; deleted `DiscoverTab`; removed `view` state and use `mainNav` for refresh logic; Month/List/Week toggle moved into CalendarView.
5. **Buttons:** Create modal close and event detail header actions use `Button`; remaining raw buttons left for minimal scope.
6. **Event modal:** Single “Open on X” in header; header row with title + actions; Combined followers “Not available”; no duplicate link in body.

---

## Implementation summary (governance pass)

- **SharedComponents option:** **Option B** — XSpaces does not use SharedComponents except `StatCard` (via `StatCardsRow`) with `variant="light"`, which already uses only Linkary tokens. No broad tokenization of SharedComponents was done; app-shell pages use `Button` from `ui/button` and token-based Tailwind classes only.
- **Token governance:** All XSpaces UI (XSpacesPage.tsx and `xspaces/*`) uses only theme tokens: `text-foreground`, `text-muted-foreground`, `bg-background`, `bg-card`, `bg-muted`, `bg-secondary`, `bg-accent`, `border-border`, `bg-primary`, `text-primary`, `text-primary-foreground`. Overlays use `bg-foreground/50 backdrop-blur-sm`. No `zinc`, `neutral`, `bg-black/50`, or ad-hoc palette classes.
- **Navigation:** Single model `mainNav`: home | explore | calendar. Removed `activeTab` and `DiscoverTab`. Month/List/Week toggle lives inside `CalendarView` only.
- **Event detail modal:** Single “Open on X” in header row; proper header row (title + actions) instead of absolute positioning; Combined followers shows “Not available” when no data.

---

## A) Plan: Component breakdown and where each view lives

### Layout (single shell)
- **XSpacesPage.tsx** (existing): Root container. Renders:
  - **XSpacesSidebar** (new): Left rail with nav items Home, Explore, Calendar. Active state by `mainNav`.
  - **Main content area**: Switches by `mainNav`:
    - `home` → **HomeView**
    - `explore` → **ExploreView**
    - `calendar` → **CalendarView**
  - Global modals (unchanged): Create Space, Add from X, Event detail. Event detail is **EventDetailModal** (new) for layout/copy; logic stays in parent.

### New components under `apps/web/src/figma/app/components/xspaces/`

| Component | Responsibility |
|-----------|----------------|
| **XSpacesSidebar** | Left sidebar: Home, Explore, Calendar icons + labels. Uses Linkary sidebar tokens. |
| **HomeView** | Stat cards row (placeholders), Tabs (My Events / Analytics), Filters (All / Speaking / Hosting), Add Event button, event list or empty state with "Explore" CTA. |
| **ExploreView** | Left Filters rail (Topics, Event type, Format, Platform, Language — UI-only), top bar (Select Date, Sort By — UI-only), **EventCard** list. |
| **CalendarView** | Month grid, month navigation, Month/Week toggle (Week placeholder). Reuses existing calendar grid logic. |
| **EventDetailModal** | Two-column popup: left — title, scheduled start, tags, host, follower count, description, agenda, main CTA; right — countdown (D/H/M/S), co-hosts, speaker avatars, combined followers; top right — Open on X, Add to calendar, Share, menu. |
| **EventCard** | Single card for Explore: time range, title, tags (e.g. X Spaces, Roundtable), host, speakers preview, combined followers, primary CTA (Request), secondary (Event Page). |
| **FiltersRail** | Vertical filters for Explore: Topics, Event type, Format, Platform, Language with radio/options (UI-only). |
| **StatCardsRow** | Row of 6 stat cards: Spoken On, Hosted Events, Missed Events, Upcoming Reach, Total Listeners, My Ratings. Placeholder values when backend not available. |

### Data and state (unchanged)
- All API calls and state remain in **XSpacesPage.tsx** (spaces, loading, xConnected, create/add-from-X/detect, detailsSpace, etc.).
- Views receive props/callbacks from XSpacesPage (e.g. `spaces`, `upcoming`, `loadDiscover`, `onSpaceClick`, `me`, `xConnected`, `handleConnectX`, `onAddEvent`, `onOpenCreate`, `onOpenAddFromX`).
- **Event detail**: Still controlled by `detailsSpace`; when set, render **EventDetailModal** with same handlers (save edit, cancel, request speaker, RSVP, link X, etc.).

### Design system (Linkary only)
- **Tokens**: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `bg-primary`, `text-primary-foreground`, `bg-secondary`, `accent` for hover.
- **No new fonts**; no xcohost/neon colors. **Primary**: `#FF5300` (Linkary orange) via `bg-primary` / `text-primary`.
- **Corners**: `rounded-2xl` (16px) or `rounded-3xl` (24px) for cards/panels.
- **Buttons**: Use `Button` from `@/figma/app/components/ui/button` with `variant="default"` (primary) or `variant="outline"` / `variant="secondary"`.
- **Chips/tags**: Pill style `rounded-full px-3 py-1 text-xs font-medium bg-primary/10 text-primary border border-primary/20` or `bg-muted text-muted-foreground`.

---

## B) Manual test checklist (10 steps)

1. **Login and nav** — Sign in; open /xspaces. Left sidebar shows Home, Explore, Calendar. Click each: content switches to Home, Explore, Calendar respectively.
2. **Home — stat cards and tabs** — On Home, see 6 stat cards (Spoken On, Hosted Events, etc.). Tabs show "My Events" and "Analytics". Click Analytics: placeholder or empty. Click My Events: list or empty state.
3. **Home — filters and Add Event** — With My Events selected, use filters All / Speaking / Hosting (UI-only). Click "Add Event": Create Space modal opens (existing flow). Empty state shows "Explore" CTA; clicking it switches to Explore view.
4. **Explore — filters and cards** — On Explore, left rail shows filters (Topics, Event type, Format, Platform, Language). Main area shows event cards (from discover API). Each card has time, title, tags, host, Request and Event Page actions. Top right has Select Date and Sort By (UI-only).
5. **Explore — open event** — Click an event card: Event detail modal opens with two-column layout, countdown if upcoming, host/speakers, Open on X (if linked), no token in UI.
6. **Calendar — month and events** — On Calendar, month grid shows; prev/next change month. Events appear on correct dates. Click a date (if allowed): create modal. Click an event: detail modal.
7. **Connect X and Add from X** — Not connected: callout explains Connect X. Click Connect X: redirect to X OAuth. After connect, Add from X opens; paste URL or pick from past list; submit sync. 409 shows "Already imported". No tokens in response or DOM.
8. **Detect and link** — Create Space with "Create on X"; after create, Connect X if needed, Open X, Detect my Space. Detection runs; link or paste fallback works. No token leak.
9. **Event detail — host actions** — As host, open detail: edit title, Mark as ended, Replace link, Link X Space, speaker requests. As non-host: Interested, Going, Request speaker. Open on X only if `x_space_url` exists.
10. **Responsive** — Resize viewport; sidebar collapses or stacks if designed; stat cards and event cards reflow; modals remain usable.

---

## C) Visual checklist (per view vs screenshots)

- **Sidebar (A/B/C)**  
  - Left rail; icons + labels for Home, Explore, Calendar.  
  - Active item uses Linkary primary (e.g. bg-primary/10 + text-primary).  
  - Matches screenshot layout; colors are Linkary (no neon purple).

- **Home (screenshot 2)**  
  - Top: row of stat cards (6).  
  - Tabs: My Events | Analytics.  
  - Filters: All | Speaking | Hosting.  
  - Add Event button (primary).  
  - Event list or empty state with Explore CTA.  
  - Cards: subtle border, soft shadow, Linkary surfaces.

- **Explore (screenshot 1)**  
  - Left: Filters rail (Topics, Event type, Format, Platform, Language).  
  - Top right: Select Date, Sort By.  
  - Main: event cards with time, title, tags, host, speakers, combined followers, Request (primary) + Event Page (secondary).  
  - Linkary chips and primary/secondary buttons.

- **Calendar (screenshot 3)**  
  - Month grid; weekdays row; dates in cells; events on dates.  
  - Month navigation (prev/next).  
  - Month/Week toggle (Week can be placeholder).  
  - Linkary card/surface for calendar container.

- **Event detail popup (screenshot 4)**  
  - Left column: title, scheduled start, tags, host, follower count, description, agenda, main CTA.  
  - Right column: countdown (Days, Hours, Minutes, Seconds), co-hosts, speaker avatars carousel, combined followers.  
  - Top right: Open on X (if link exists), Add to calendar, Share, menu (optional).  
  - Graceful "Not provided" for missing data; Combined followers shows "Not available" when no data.  
  - No access_token/refresh_token ever rendered.

---

## D) Final QA checklist (governance + regression)

- [ ] **No reference-before-declare** — `loadMyXSpaces` is declared above any `useEffect` that uses it; TypeScript passes.
- [ ] **No non-token palette classes** — XSpacesPage and all `xspaces/*` use only Linkary tokens (no `zinc`, `neutral`, `bg-black/50`, etc.). Overlays: `bg-foreground/50 backdrop-blur-sm`.
- [ ] **Connect X** — Not connected: callout/button visible; click starts OAuth; return with `x_connected=1` updates state.
- [ ] **Add from X** — Actions disabled until connected; paste URL or pick from past list; submit runs sync-from-x; 409 shows "Already imported".
- [ ] **No token leaks** — No `access_token` or `refresh_token` in UI, logs, or DOM.
- [ ] **Home / Explore / Calendar** — Sidebar switches views; Home loads spaces; Explore loads discover; Calendar loads month; data correct per view.
- [ ] **Modal** — Event detail opens/closes cleanly; header has title + Open on X (if linked), Add to calendar, Share, Close; no duplicate Open on X in body; responsive.
- [ ] **CalendarView** — Month/List/Week toggle in top bar; Month and List switch content; Week placeholder styled correctly.

---

## E) Final polish QA (10 steps) — post–governance pass

1. **Governance** — No forbidden palette classes in XSpaces scope: no `zinc-`, `neutral-`, `amber-`, `red-`, `green-`, `blue-`, `slate-`, `gray-`, `bg-black`, `bg-white`, `text-white` (or `dark:` variants of those) in `XSpacesPage.tsx` or `xspaces/*`.
2. **Banners** — Connect X error, OAuth error, overlap warning, add-from-X success use only token styles (`bg-card`/`bg-muted`, `border-border`, `text-foreground`/`text-muted-foreground`, `text-destructive` for errors); rounded-2xl, no amber/red/green.
3. **Buttons** — Home list (Details, Connect X, Detect my Space, Paste link, Open X), Create modal, Add from X modal, Event detail (Approve/Reject, Mark as ended, Replace/Save link, etc.) use `<Button>` with variants; no raw palette classes; radii consistent (rounded-xl/2xl).
4. **Calendar list mode** — List view groups by date (Today, Tomorrow, then weekday+date); each event row is a card (`rounded-2xl border border-border bg-card`); shows time (Clock icon), title, status chip; matches Explore/Home density.
5. **Modals** — Overlay `bg-foreground/50 backdrop-blur-sm`; container `rounded-2xl`, `border-border`, `bg-card`; header row: title left, actions right; no absolute positioning hacks.
6. **Event detail** — Single "Open on X" in header only; right column spacing (countdown, speakers, combined followers); combined followers fallback "Not available".
7. **Connect X / Add from X / detect** — Flows still work; 409 handling shows appropriate message; no token leakage.
8. **No tokens in UI** — `access_token` and `refresh_token` never rendered or logged in UI/console.
9. **Visual consistency** — Banners and cards match Linkary analytics UI (spacing, rounded-2xl, subtle borders).
10. **Regression** — Auth, `/auth/callback`, persist-social, and API contracts/paths unchanged.

---

## F) Ship-it pass (release squad) — plan and regression

### Plan of changes (executed)

- **A) Runtime safety**
  - `loadSpaces`, `loadSpacesForMonth`, `loadDiscover` accept optional `AbortSignal`; effects create `AbortController` and abort on cleanup so rapid mainNav toggles don’t apply stale responses.
  - When `detailsSpace` becomes null, `editTitle` and link/Replace state are reset in the same effect.
  - All API `spaces` responses normalized with `Array.isArray(data.spaces) ? data.spaces : []`.
- **B) Timezone / date**
  - `spacesByDay` keys use **local** date via `toLocalYMD(new Date(s.scheduled_at))` so calendar and list respect browser timezone (e.g. Europe/Berlin).
  - `getDateLabel(ymd, now?)` and `formatTime(scheduled_at)` in `xspaces/utils.ts`; Today/Tomorrow use local date; optional `now` for tests.
  - Unit tests in `xspaces/utils.test.ts` (Today/Tomorrow, formatTime, ordering, late-night UTC, DST boundary).
- **C) Accessibility**
  - All three modals (Create, Add from X, Event detail): `role="dialog"`, `aria-modal="true"`, `aria-labelledby`; initial focus on first focusable (close button); ESC closes; Tab focus trap inside dialog.
  - Icon-only buttons have `aria-label` (Close, Add to calendar, Share).
  - Calendar list rows and month event pills: `role="button"`, `tabIndex={0}`, Enter/Space with `preventDefault`; `aria-label` on list rows and pills.
- **D) Performance**
  - `handleOpenEventDetail` memoized with `useCallback` and passed to HomeView/ExploreView/CalendarView so children get stable props.
  - `groupedByDateLabel` and `orderedDateLabels` already memoized in CalendarView.
- **E) Observability**
  - `xspaces/utils.ts`: `xspacesDebug()` (only logs when `?debug=1` and non-production); `sanitizeErrorMessage(raw)` strips token-like content and caps length; all user-facing error setters use `sanitizeErrorMessage()` so raw server payloads are never shown.
- **F) Automated checks**
  - **Date tests:** `pnpm --filter web run test:xspaces-dates` (or from `apps/web`: `pnpm run test:xspaces-dates`) runs `utils.test.ts`.
  - **Governance + dates:** `pnpm --filter web run test:xspaces` runs date tests then checks `XSpacesPage.tsx` and `xspaces/*` for forbidden class **tokens** (zinc-, neutral-, amber-, red-, green-, blue-, slate-, gray-, bg-black, text-white, bg-white) so "translate" is not false-positive.

### Final regression checklist (ship-it)

1. **No crashes** — Open /xspaces; switch Home → Explore → Calendar quickly; open event from list; close with ESC; no runtime errors.
2. **Empty states** — No spaces: empty state and CTAs; no discover: Explore shows empty or placeholder; no events in month: "No events this month" in list.
3. **Dates** — Calendar and list show events on correct **local** day; Today/Tomorrow labels correct in list; no day drift in Europe/Berlin (or local TZ).
4. **Modals** — Create, Add from X, Event detail: open → focus in dialog; Tab cycles inside; ESC closes; overlay click closes; no stuck state.
5. **Connect X / Add from X / detect** — Flows work; 409 shows safe message; no token in UI or console.
6. **Governance** — `pnpm --filter web run test:xspaces` passes (no forbidden palette tokens in XSpaces scope).
7. **Auth / API** — No changes to `/auth/callback`, persist-social, or server endpoints/contracts.
8. **Navigation** — Only `mainNav` state; CalendarView `viewMode` internal only.
9. **Errors** — Banners show user-safe messages only (no stack traces or raw API bodies).
10. **Manual smoke** — Create space, add from X, open event, approve/reject speaker (if host), RSVP, link X Space; all without errors.

---

## G) Pre-deploy pass (Release Captain)

### 1) SSR / Next.js safety — what was changed and why it’s SSR-safe

- **`handleModalKeyDown`** — Added `if (typeof document === "undefined") return;` at the top so `document.activeElement` and DOM queries never run during SSR (handler is only invoked on keydown in the browser, but the guard is defensive).
- **`base`** — Already set with `typeof window !== "undefined" ? window.location.origin : ""` so SSR gets `""` and no `window` access.
- **OAuth redirect / history** — All `window.location` and `window.history.replaceState` use is inside `useEffect` or behind `typeof window !== "undefined"`, so they never run on the server.
- **Focus trap / initial focus** — All `requestAnimationFrame`, `querySelector`, and `focus()` calls live inside `useEffect` (modal open effects). React does not run effects during SSR, so no DOM or `document` access on the server.
- **`xspaces/utils.ts`** — `isDev` uses `process.env.NODE_ENV` when `process` exists; `window` is only read inside `typeof window !== "undefined"`; `xspacesDebug` checks `window` before using `window.location`. No unguarded browser globals.
- **AbortController** — Used only inside `useEffect` in the browser; supported in Node 18+ and all target browsers; no polyfill added.

### 2) Error boundary + graceful fallbacks

- **XSpacesErrorBoundary** added in `xspaces/XSpacesErrorBoundary.tsx`: class component with `getDerivedStateFromError` and `componentDidCatch`. Renders a token-based banner (`bg-card`, `border-border`, `text-foreground`, `text-muted-foreground`) and a **Reload** `<Button>`. Displayed message comes from **sanitizeErrorMessage(error?.message)** so no raw payload or stack is shown. XSpacesPage wraps its shell (sidebar + main) in `<XSpacesErrorBoundary>` so a single view crash does not blank the whole app.

### 3) Real E2E smoke (minimal)

- **No Playwright** in the repo. Implemented a **runtime smoke script** instead: `apps/web/scripts/xspaces-smoke.ts`.
- **Behavior:** Starts the production server (`next start -p 3001`) in the background, waits for GET `/xspaces` to return 200 or 302/307, and if 200 asserts the HTML includes "X Spaces" or "Calendar" (sidebar). Then kills the server. No auth, no OAuth, no fixture data.
- **How to run**
  - **Locally (after build):** From repo root: `pnpm run smoke:xspaces` or `pnpm --filter web run smoke:xspaces`. From `apps/web`: `pnpm run smoke:xspaces`.
  - **Full (build + smoke):** `pnpm run smoke:xspaces:full` or `pnpm --filter web run smoke:xspaces:full`.
  - **CI:** Run from repo root: `pnpm run test:xspaces` (fast), then optionally `pnpm run smoke:xspaces:full` (build + smoke). Port is configurable via `XSPACES_SMOKE_PORT` (default 3001).

### 4) Governance enforcement in CI

- **Script:** `scripts/xspaces-regression.ts` runs date tests then governance. **Fail fast:** exits with code 1 and prints the first violating file/line/token; no fix-up.
- **Allowlist:** Added `ALLOWLIST` for known-safe tokens that contain forbidden substrings (e.g. `-translate-x-1/2`, `-translate-y-1/2`) so Tailwind translate classes are not reported as `slate-`.
- **Scope:** Source-only (XSpacesPage.tsx and xspaces/*). No compiled-output check; stable and CI-friendly.
- **CI hook:** From repo root run `pnpm run test:xspaces` in your pipeline (e.g. `test` or `lint` step). Root `package.json` has `test:xspaces`, `test:xspaces-dates`, `smoke:xspaces`, `smoke:xspaces:full` so a single job can run them.

### 5) Bundle + dependency hygiene

- **xspaces/utils.ts** — No imports; only Node/browser globals and pure helpers. No heavy deps.
- **Icons** — Tree-shake friendly: `import { Clock } from "lucide-react"` (and similar) throughout; no default import of the whole library.
- **No new dependencies** — Only existing packages (React, Next, lucide-react, etc.). XSpacesErrorBoundary and smoke script use existing Button and tsx.

---

### PR-style summary: What changed / Why / How to test

**What changed**
- SSR guard in modal keydown handler (`document` check).
- XSpacesErrorBoundary wrapping the XSpaces shell; token-only UI and sanitized error message.
- Runtime smoke script (build, start server, GET /xspaces, assert shell).
- Governance allowlist for translate-style classes; CI-ready commands at repo root.

**Why**
- Safe server render and no DOM access during SSR.
- One view crash does not blank the app; users see a safe message and Reload.
- One automated smoke to verify page load and shell without Playwright or real auth.
- CI can run governance and smoke with clear failures and no false positives.

**How to test**
- `pnpm --filter web run test:xspaces` — date tests + governance (no forbidden tokens).
- `pnpm --filter web run test:xspaces-dates` — date/utils tests only.
- `pnpm --filter web run smoke:xspaces` — smoke (requires prior `pnpm --filter web build`).
- `pnpm --filter web run smoke:xspaces:full` — build then smoke.
- From repo root: `pnpm run test:xspaces`, `pnpm run smoke:xspaces`, etc.

**Confirmations**
- **No auth changes** — `/auth/callback`, persist-social, and auth flows unchanged.
- **No API contract changes** — No server endpoints or request/response shapes changed.
- **No token leaks** — access_token/refresh_token are not rendered or logged; sanitizeErrorMessage and xspacesDebug stay safe.
- **Tokens-only styling preserved** — XSpaces UI and error boundary use only Linkary tokens (bg-card, border-border, text-foreground, etc.); no new palette classes.

---

## Release checklist (copy/paste for deploy PR)

### Commands to run (from repo root)

```bash
pnpm run test:xspaces
pnpm run test:xspaces-dates
pnpm run smoke:xspaces:full
```

### Expected outputs

- **test:xspaces** — `All XSpaces regression checks passed.` (date tests + governance; exit 0).
- **test:xspaces-dates** — `All date/util tests passed.` (exit 0).
- **smoke:xspaces:full** — Build completes, then `[xspaces-smoke] PASS: Page loads or redirects to login (200/302/307).` (exit 0).

### Smoke notes

- **200** = page loaded; body must contain one of: `data-testid="xspaces-shell"`, `data-testid="xspaces-sidebar"`, `data-testid="xspaces-nav-calendar"`, or sidebar text (Home/Explore/Calendar), or `__NEXT_DATA__`/xspaces.
- **302/307** = redirect to login; treated as pass (unauthenticated smoke).
- Env (optional): `XSPACES_SMOKE_PORT`, `XSPACES_SMOKE_URL_BASE` (smoke external server), `XSPACES_SMOKE_PATH` (default `/xspaces`).

### Rollback

- Revert the XSpaces deploy commit(s). No feature flag; routing and API unchanged.
- If needed, revert list: XSpacesPage, xspaces/*, scripts/xspaces-*, docs/XSPACES_UI_REBUILD.md, package.json scripts (test:xspaces, smoke:xspaces, etc.).
