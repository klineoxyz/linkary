# Launch P7: Requests page polish

## Summary

The `/work/requests` page is polished to match the Messages UI (spacing, empty states, selection UX), with URL-backed selection, one-time mark-seen, and clearer sidebar.

## Changes

### 1. Right panel “nothing selected” and empty states

- **Items exist but none selected:** Right panel shows MessageSquare icon + “Select a request” + subtext “Accept or archive to keep your inbox clean.”
- **Zero items (empty list):**  
  - **Left:** Existing empty card (icon, “No requests yet” / “No sent requests”, CTAs).  
  - **Right:** “How requests work” card with:
    - “Copy public profile link” button
    - “Open my public profile” link (new tab)

### 2. Empty state enhancements (inbox)

- **Left panel inbox empty:**  
  - Kept: “Browse creators”, “Share profile”.  
  - Added: “Open my public profile” (opens profile in new tab).  
  - If user has no socials (x_url, telegram_url, website_url all empty): “Add contact links” CTA → `/profile/edit#basics`.

### 3. List rows match Messages styling

- List items use the same patterns as Messages: `rounded-lg border border-border p-3`, `hover:bg-muted/30`, selected `ring-2 ring-ring bg-muted/20`, `transition-all`. No new colors.

### 4. URL sync for selection (deep link)

- **Supported URLs:**  
  - `/work/requests?tab=inbox&id=<uuid>`  
  - `/work/requests?tab=sent&id=<uuid>`
- **Behavior:**  
  - Clicking a row updates the URL with the request `id` (shallow route update).  
  - On load, if `id` is in the URL and present in the current tab’s list, that request is selected.  
  - After Accept/Archive: same `id` stays selected if still in list; otherwise the next item (or first) is selected and URL is updated.
- **Routing:** `routeFromPathname` and `pathFromRoute` in `App.tsx` now read/write `id` from/to `route.data` and query string.

### 5. mark-seen runs once

- `POST /api/collab-requests/mark-seen` is called only once when the requests view mounts and the user is authed.
- Implemented with a `useRef` flag (`markSeenDoneRef`) so re-renders or effect re-runs do not trigger multiple calls.

### 6. Sidebar cleanup

- “Messages” is replaced with a disabled entry: **“Messages (soon)”** (same icon, disabled button, no navigation). Reduces confusion with “Requests” until Messages is fully working.

## Files touched

- **`apps/web/src/figma/app/App.tsx`**
  - Routing: `routeFromPathname` / `pathFromRoute` support `?id=` for `workRequests`.
  - `WorkRequestsPage`: `markSeenDoneRef`, `selectRequest(id)` for URL sync, right-panel states (nothing selected vs empty list “How requests work”), inbox empty state CTAs (Open profile, Add contact links), list row classes, effect to sync `selectedId` from `route.data?.id`, `updateStatus` refetch + next selection + URL update.
  - Sidebar: Messages → disabled “Messages (soon)” button.
  - Imports: `useRef`; `MessageSquare` already used for placeholder.

## QA checklist

- [ ] `/work/requests` looks visually consistent with Messages (spacing, cards, hover, selection ring).
- [ ] **Right panel – items exist, none selected:** Icon + “Select a request” + “Accept or archive to keep your inbox clean.”
- [ ] **Right panel – zero items:** “How requests work” with Copy public profile link + Open my public profile.
- [ ] **Inbox empty (left):** Browse creators, Share profile, Open my public profile; if no socials, “Add contact links” → `/profile/edit#basics`.
- [ ] **List rows:** Same padding, border, hover and selected styles as Messages list (no new colors).
- [ ] **Selection → URL:** Clicking a request adds/updates `?id=<uuid>` (and keeps `tab=` when on Sent).
- [ ] **Deep link / reload:** Opening or reloading `/work/requests?tab=inbox&id=<uuid>` (or `tab=sent`) selects that request when it’s in the list.
- [ ] **After Accept/Archive:** Selection moves to next (or first) if current request is gone; URL updates; no duplicate mark-seen calls.
- [ ] **mark-seen:** Only one `POST /api/collab-requests/mark-seen` per mount (e.g. refresh and check network).
- [ ] **Sidebar:** “Messages (soon)” is visible, disabled; “Requests” remains the primary way to reach collab requests.
