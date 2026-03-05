# XSpaces UI Rebuild — Plan & Checklists

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
  - Graceful "Not provided" for missing data.  
  - No access_token/refresh_token ever rendered.
