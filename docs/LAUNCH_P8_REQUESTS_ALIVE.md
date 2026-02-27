# Launch P8: Requests “feel alive” — recent sent + requester follow-up

## Summary

- **Part A:** When Inbox is empty, the right panel can show “Recent sent requests” (max 3) so the page doesn’t feel blank; clicking a row switches to Sent tab and selects that request.
- **Part B:** Requester can send one optional follow-up note after a request is accepted. Target sees it in Inbox as “Requester follow-up”.

## Part A — Right panel: recent sent when inbox empty

- **When:** `tab=inbox`, inbox list is empty, and sent list has at least one item.
- **Right panel:** Shows “Recent sent requests” (up to 3 items). Each row: avatar, name, status pill, message preview.
- **Interaction:** Clicking a row switches to Sent tab and selects that request (URL becomes `?tab=sent&id=<uuid>`).
- **When sent is also empty:** Existing “How requests work” card is shown (no change).
- Sent list is already loaded by the existing fetch; no new API.

## Part B — Requester follow-up note

### Step 1: DB migration

**File:** `supabase/migrations/20260279000000_collab_requests_requester_followup_note.sql`

- Add column: `requester_followup_note text null` on `public.collab_requests`.
- New RLS policy: `collab_requests_update_requester_followup` — UPDATE allowed when `requester_profile_id = auth.uid()` and `status = 'accepted'`. API restricts requester to updating only this column.

### Step 2: API

**POST /api/collab-requests/update**

- **Target (recipient):** Unchanged. Can set `status` (`accepted` | `archived`) and optional `reply_note` when accepting. Response includes `requester_followup_note` when present.
- **Requester:** Allowed only when the request already has `status = 'accepted'` and `requester_profile_id` matches the current user’s profile.
  - Body may include `requester_followup_note` (max 500 chars).
  - Requester cannot send `status` or `reply_note`; returns 400 if they do.
  - Update only sets `requester_followup_note`; status and reply_note unchanged.
- Response for both paths: `id`, `status`, `reply_note`, `requester_followup_note` (when present).

**GET /api/collab-requests/inbox**  
- Response items include `requester_followup_note`.

**GET /api/collab-requests/sent**  
- Response items include `requester_followup_note`.

### Step 3: UI

- **Sent tab, accepted request:**
  - If `requester_followup_note` is empty: show textarea “Send a follow-up (optional)”, character count, and “Save” button. Save calls POST update with `requester_followup_note` only; then refetches sent list.
  - If `requester_followup_note` is set: show “Your follow-up” and the note text (no edit in this scope).
- **Inbox tab, accepted request:**
  - If `requester_followup_note` is present: show a block titled “Requester follow-up” with the note.
  - Existing “They can reach you via your profile socials” and reply note behavior unchanged.

### Constraints

- No new colors; design tokens only.
- RLS unchanged except for the new requester-update policy above.
- No email or notification changes.

## Files changed

- `apps/web/src/figma/app/App.tsx` — Part A: right-panel “Recent sent requests” when inbox empty; Part B: follow-up state, `saveRequesterFollowup`, Inbox “Requester follow-up”, Sent “Your follow-up” and follow-up textarea + Save.
- `supabase/migrations/20260279000000_collab_requests_requester_followup_note.sql` — New column and RLS policy.
- `apps/web/src/app/api/collab-requests/update/route.ts` — Target vs requester branches; requester can set only `requester_followup_note` when status is accepted; response includes `requester_followup_note`.
- `apps/web/src/app/api/collab-requests/inbox/route.ts` — Select and return `requester_followup_note`.
- `apps/web/src/app/api/collab-requests/sent/route.ts` — Select and return `requester_followup_note`.

## QA checklist

- [ ] **Part A:** Inbox empty, user has sent requests → right panel shows “Recent sent requests” (max 3). Clicking a row opens Sent tab and selects that request (URL `?tab=sent&id=...`).
- [ ] **Part A:** Inbox and sent both empty → right panel shows “How requests work” (unchanged).
- [ ] **Part B – requester:** On Sent, accepted request with no follow-up → “Send a follow-up (optional)” and Save visible. Saving updates and shows “Your follow-up” with the text.
- [ ] **Part B – requester:** Requester cannot set or change `reply_note` or `status` (only follow-up note).
- [ ] **Part B – target:** Target cannot set `requester_followup_note` (only status and reply_note).
- [ ] **Part B – Inbox:** Accepted request with requester follow-up → “Requester follow-up” block is shown.
- [ ] Build passes; RLS remains strict; no new colors.
