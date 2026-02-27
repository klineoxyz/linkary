# Launch UX: Merge Collab Requests into Messages-Style UI (WORK section)

## Summary

Collab requests (inbox + sent) now live under **Work** in the sidebar and use the same two-panel layout as Messages. Old profile URLs redirect to the new page with the correct tab.

## Files changed

- **`apps/web/src/figma/app/App.tsx`**
  - **Routing:** `routeFromPathname`: handle `work` + `requests` → `{ name: "workRequests", data: { tab } }` (tab from `?tab=` or default `inbox`).
  - **Routing:** `pathFromRoute`: add `workRequests` → `/work/requests` or `/work/requests?tab=sent`.
  - **Sidebar:** Removed "Inbox" and "Sent requests" from Profile. Under Work: added "Requests" link to `/work/requests` with inbox-new badge; active when `route.name === "workRequests"`.
  - **Allowed routes:** Added `workRequests` to `ALLOWED_ROUTES`.
  - **New component:** `WorkRequestsPage` (two-panel layout):
    - Left: Inbox / Sent tabs, then list (avatar, name, @username, time, status pill, preview, category/budget for inbox).
    - Right: Detail (message, meta, status; Accept/Archive for inbox+new; reply_note + contact buttons for sent+accepted; View profile).
    - Empty states inside panels (Browse creators, Share profile for inbox; Browse creators for sent).
    - Accept modal (reply_note, my_socials hint) reused from previous inbox page.
  - **Route render:** `route.name === "workRequests"` → `<WorkRequestsPage setRoute={...} route={...} me={me} />`.
  - **Imports:** `Image` (next/image), `Compass`, `Share2` (lucide-react).

- **`apps/web/src/app/work/requests/page.tsx`** (new)
  - Client page that renders `<AppWithProviders />` so the app shell and pathname `/work/requests` drive the route and `WorkRequestsPage`.

- **`apps/web/src/app/profile/inbox/page.tsx`**
  - Replaced with server component: `redirect("/work/requests?tab=inbox")`.

- **`apps/web/src/app/profile/requests/page.tsx`**
  - Replaced with server component: `redirect("/work/requests?tab=sent")`.

## APIs used (unchanged)

- `GET /api/collab-requests/inbox` — inbox list + `my_socials`
- `GET /api/collab-requests/sent` — sent list
- `GET /api/collab-requests/count` — badge (inboxNew); already used in sidebar, key `null` when logged out
- `POST /api/collab-requests/mark-seen` — called when loading inbox
- `POST /api/collab-requests/update` — Accept/Archive (body: `id`, `status`, optional `reply_note`)

## QA steps

1. **`/work/requests`**
   - Loads with app shell and two-panel layout (left list, right detail).
   - Tabs "Inbox" and "Sent" at top of left panel; switching updates URL (`?tab=sent`) and list.

2. **Inbox tab**
   - List: requester avatar, display name, @username, time, status pill (New/Accepted/Archived), message preview (line-clamp), category/budget.
   - Select item → right panel shows full message, meta, status.
   - Status **New**: Accept (primary) and Archive (secondary). Accept opens modal (reply note, “They can reach you via” hint); submit updates list.
   - Status **Accepted**: show “They can reach you via your profile socials” (no contact buttons in inbox view).
   - Empty state: “No requests yet” + “Browse creators” (→ `/explore`) and “Share profile” (copy link).

3. **Sent tab**
   - List: target avatar, display name, @username, time, status pill, message preview.
   - Detail: message, status, created time. If **Accepted**: reply_note block; contact buttons (X, Telegram, Website) from target socials; “View profile” link.
   - Empty state: “No sent requests” + “Browse creators” (→ `/explore`).

4. **Badge**
   - Sidebar “Requests” shows count only when `inboxNew > 0`. Logged-out: no count fetch (key null).

5. **Redirects**
   - `/profile/inbox` → `/work/requests?tab=inbox`.
   - `/profile/requests` → `/work/requests?tab=sent`.
   - Both via server-side `redirect()`.

6. **No regressions**
   - `/` and `/{username}` load without white screens; no new colors or custom CSS; existing design tokens and /messages-style components only.
