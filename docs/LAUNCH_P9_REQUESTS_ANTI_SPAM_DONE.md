# Launch P9: Requests anti-spam, duplicates, and “done” status

## Summary

- **One open request per pair:** A requester cannot have more than one request with status `new` to the same target (enforced by unique index + API).
- **Cooldown:** After sending a request to a user, the requester cannot send another to the same user within 24 hours (API check).
- **Status "done":** Either party can close an accepted request by setting status to `done`. Done (and archived) items can be hidden behind a “Show archived” toggle.

## Step 1 — DB migration

**File:** `supabase/migrations/20260280000000_collab_requests_anti_spam_done.sql`

- **Status `done`:** Extend `collab_requests.status` CHECK to allow `'done'` (in addition to `'new'`, `'accepted'`, `'archived'`). Implemented by dropping the existing check constraint (if named `collab_requests_status_check`) and adding a new one.
- **One open per pair:** Partial unique index on `(requester_profile_id, target_profile_id)` WHERE `status = 'new'`, so at most one open request per requester–target pair.
- **Cooldown lookup:** Index on `(requester_profile_id, target_profile_id, created_at DESC)` to efficiently find the most recent request between a pair.

Existing data is unchanged; migration is additive plus constraint/index changes.

## Step 2 — API: POST /api/collab-requests (create)

Before inserting a new request:

1. **Duplicate open:** If there is already a row with the same `requester_profile_id` and `target_profile_id` and `status = 'new'`, return **409** with `{ ok: false, code: "duplicate_open", message: "You already have an open request to this user." }`.
2. **Cooldown:** Query the most recent request (any status) between this requester and target. If `created_at` is within the last **24 hours**, return **429** with `{ ok: false, code: "cooldown", message: "Please wait before sending another request." }`.

Then insert as before. Email/notification behavior is unchanged (still rate-limited by target).

## Step 3 — API: POST /api/collab-requests/update

- **Status `done`:** Allowed in addition to `accepted` and `archived`. Either **target** or **requester** may set `status: "done"` for an accepted request (both can “close” it).
- **Target:** Can set `status` to `accepted` | `archived` | `done` and, when accepting, optional `reply_note`. No change to existing behavior beyond allowing `done`.
- **Requester:** When the request is already `accepted`, can set `requester_followup_note` (unchanged) or set `status: "done"`. Requester cannot set `reply_note` or any other status.

## Step 4 — UI (/work/requests)

- **Done pill:** Status pill shows “Done” (muted style) when `status === 'done'`.
- **Mark done:** In the detail panel for an **accepted** request (both Inbox and Sent), a secondary “Mark done” button is shown. Clicking sends `POST /api/collab-requests/update` with `{ id, status: "done" }`, then refetches inbox and sent lists and updates selection.
- **Show archived toggle:**  
  - **Inbox:** By default the list shows only `new` and `accepted`. If there are any `archived` or `done` items, a “Show archived” link/button is shown; toggling shows or hides archived/done.  
  - **Sent:** Same behavior (default: new + accepted; “Show archived” to include archived + done).  
  - State is local (e.g. `showArchived`); no new API.

## Files changed

- `supabase/migrations/20260280000000_collab_requests_anti_spam_done.sql` — New status value, partial unique index, cooldown index.
- `apps/web/src/app/api/collab-requests/route.ts` — Duplicate-open check (409) and 24h cooldown check (429) before insert.
- `apps/web/src/app/api/collab-requests/update/route.ts` — Allow `status: "done"` for target; allow requester to set `status: "done"` when request is accepted.
- `apps/web/src/figma/app/App.tsx` — `RequestsStatusPill` “Done”; `showArchived` state and filtered list; “Show archived” / “Hide archived” toggle; `markDone` handler; “Mark done” button in Inbox and Sent detail for accepted requests.

## QA checklist

- [ ] **Duplicate open:** Send request A→B; try to send again (without archiving/done). Response **409** with `code: "duplicate_open"`.
- [ ] **Cooldown:** Archive (or mark done) the request, then try to send a new request A→B within 24 hours. Response **429** with `code: "cooldown"`. After 24h, create is allowed.
- [ ] **Mark done:** As target or requester, open an accepted request and click “Mark done”. Status becomes `done`, list refreshes, selection moves appropriately; item moves out of default view until “Show archived” is on.
- [ ] **Show archived:** With some archived/done items, “Show archived” appears; toggling shows or hides them. Default view is only new + accepted.
- [ ] **Done pill:** Requests with status `done` show a muted “Done” pill in the list and detail.
- [ ] Build passes; RLS unchanged aside from existing update policies; no email/notification changes.
