# Launch Readiness P4: Collab Requests UX polish (Inbox badge, Sent page, new-count badge)

## Overview

Collab requests are discoverable and trackable: Inbox entry with unread/new count badge, Sent Requests page for requesters, and simple read tracking (seen_at) when the recipient opens the inbox. No email in this phase.

## Step 0 — Verified table

`collab_requests` has: id, created_at, requester_profile_id, target_profile_id, message, category, budget_text, status (new|accepted|archived). No read tracking yet.

## Step 1 — DB: add `seen_at`

**Migration:** `supabase/migrations/20260276000000_collab_requests_seen_at.sql`

- Add column: `seen_at timestamptz` (nullable).
- Optional index: `(target_profile_id, status, seen_at NULLS FIRST, created_at DESC)` for inbox new/unseen count and listing.
- RLS: no new policies. Existing update policy allows target to update any column, so target can set `seen_at`.

```sql
-- P4: Read tracking for collab requests (inbox "new" count = unread until seen).
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS seen_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_collab_requests_target_status_seen_created
  ON public.collab_requests (target_profile_id, status, seen_at NULLS FIRST, created_at DESC);
```

## Step 2 — API additions

### GET /api/collab-requests/count

**Auth:** required.

**Response:** `{ ok: true, inboxNew: number, sentTotal: number }`

- `inboxNew`: count where `target_profile_id = auth.uid()` AND `status = 'new'` AND `seen_at IS NULL`.
- `sentTotal`: count where `requester_profile_id = auth.uid()`.

Used for nav badge (SWR, 60s dedupe).

### POST /api/collab-requests/mark-seen

**Auth:** required.

Sets `seen_at = now()` for all rows where `target_profile_id = auth.uid()` AND `status = 'new'` AND `seen_at IS NULL`.

**Response:** `{ ok: true }`.

Called on first load of /profile/inbox so the badge clears.

### GET /api/collab-requests/sent

**Auth:** required.

Returns requests where `requester_profile_id = auth.uid()`, newest first. Each row includes target profile (username, display_name, avatar_url) from `public_profile_view` for list display.

**Response:** `{ ok: true, requests: [...] }`.

## Step 3 — UI: Inbox marks seen

- On first load of /profile/inbox (after auth), call **mark-seen** (best-effort, then fetch inbox list).
- Inbox list: show status pill for every request (**New** / Accepted / Archived) and “Seen &lt;time&gt;” when `seen_at` is set.
- Keep Accept / Archive buttons for status `new`.

## Step 4 — UI: Sent Requests page

- **Route:** `/profile/requests` (noindex via layout).
- Auth required; redirect to login if not signed in.
- List: target avatar, display name, @username link, message preview, category/budget, status pill, relative time.
- Empty state: “No requests sent yet.”

## Step 5 — Nav badge

- In the app profile hub (Sidebar under “Profile”): added **Inbox** and **Sent requests**.
- **Inbox:** link to `/profile/inbox`. If `inboxNew > 0`, show a small badge with the count (capped at 99+).
- **Sent requests:** link to `/profile/requests`.
- Count is fetched via SWR with 60s deduping (`/api/collab-requests/count`).

## Step 6 — QA

- Sending a request increases the recipient’s `inboxNew`.
- Visiting /profile/inbox clears the badge (`seen_at` set via mark-seen).
- Sent requests page shows outgoing requests with statuses.
- RLS unchanged; only requester/target can read; only target can update (status and seen_at).
- Build passes.

## Files changed / added

| Path | Change |
|------|--------|
| `supabase/migrations/20260276000000_collab_requests_seen_at.sql` | New: seen_at column + index |
| `apps/web/src/app/api/collab-requests/count/route.ts` | New: GET count |
| `apps/web/src/app/api/collab-requests/mark-seen/route.ts` | New: POST mark-seen |
| `apps/web/src/app/api/collab-requests/sent/route.ts` | New: GET sent |
| `apps/web/src/app/api/collab-requests/inbox/route.ts` | Select `seen_at`; type includes seen_at |
| `apps/web/src/app/profile/inbox/page.tsx` | mark-seen on load; status pill + Seen time |
| `apps/web/src/app/profile/requests/page.tsx` | New: Sent requests page |
| `apps/web/src/app/profile/requests/layout.tsx` | New: noindex |
| `apps/web/src/figma/app/App.tsx` | SWR for count; Sidebar inboxNew; Inbox + Sent requests links with badge |
| `docs/LAUNCH_P4_COLLAB_UX.md` | This doc |
