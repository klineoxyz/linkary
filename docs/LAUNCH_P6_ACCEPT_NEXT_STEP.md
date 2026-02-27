# Launch Readiness P6: Collab Requests “Accept → Next Step”

## Overview

When a target accepts a collab request, they can add an optional reply note. The requester sees accepted status, the reply note, and contact options (X, Telegram, Website) on the Sent page. No chat system.

## Constraints

- No email changes (P5 unchanged).
- RLS: only target can update acceptance + reply; requester can read their own sent rows (unchanged).
- Contact info is only public profile socials (already visible on public profile).

---

## Step 1 — DB migration

**File:** `supabase/migrations/20260278000000_collab_requests_reply_note.sql`

```sql
ALTER TABLE public.collab_requests
  ADD COLUMN IF NOT EXISTS reply_note text;

COMMENT ON COLUMN public.collab_requests.reply_note IS 'Optional note from target when accepting; only set when status = accepted.';
```

---

## Step 2 — API: POST /api/collab-requests/update

**Body:** `{ id, status, reply_note? }`

- `reply_note` is accepted only when `status === "accepted"`.
- Only target can update (existing RLS).
- Max length: 500 characters.
- **Response:** `{ ok: true, id, status, reply_note? }`

---

## Step 3 — API: inbox + sent payloads

### GET /api/collab-requests/inbox

- Include `reply_note` on each request.
- Include **`my_socials`** in the response: `{ x_url, telegram_url, website_url }` for the current user (target), from `profile_socials`, for the Accept modal (“they can reach you via …”).

### GET /api/collab-requests/sent

- Include `reply_note` on each request.
- Include target socials on each `target`: `x_url`, `telegram_url`, `website_url` from `profile_socials` (by `target_profile_id`), so the requester can show contact buttons for accepted requests.

---

## Step 4 — UI: Accept modal (inbox)

On **/profile/inbox**, when the user clicks **Accept** on a “new” request:

- Open a modal with:
  - Title: “Accept request” and requester name + @handle.
  - **Reply note (optional):** textarea, max 500 chars.
  - Short line: “They can reach you via: X, Telegram, Website” when `my_socials` has any of those.
  - **Cancel** and **Accept request** (primary).
- On submit: `POST /api/collab-requests/update` with `{ id, status: "accepted", reply_note }`.
- On success: close modal, refresh list, clear reply note.

---

## Step 5 — UI: Sent requests page

On **/profile/requests** (Sent):

- For **accepted** rows:
  - Show **reply_note** (if present) in a small “Their reply” block.
  - Show **contact** buttons using target socials returned by the API: X, Telegram, Website (each only if URL present).
  - Always show **View profile** link to `/{target.username}`.

---

## Step 6 — QA

- Accept with reply note: target accepts, adds note → requester sees note on Sent.
- Requester sees reply note + X/Telegram/Website (when set) on /profile/requests for accepted requests.
- Non-target cannot set `reply_note` (only target can call update; RLS enforced).
- Build passes.

---

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260278000000_collab_requests_reply_note.sql` | Add `reply_note` column |
| `apps/web/src/app/api/collab-requests/update/route.ts` | Body `reply_note`, return it |
| `apps/web/src/app/api/collab-requests/inbox/route.ts` | Select `reply_note`, return `my_socials` |
| `apps/web/src/app/api/collab-requests/sent/route.ts` | Select `reply_note`, join `profile_socials` for target |
| `apps/web/src/app/profile/inbox/page.tsx` | Accept modal with reply note + my_socials hint |
| `apps/web/src/app/profile/requests/page.tsx` | Show reply_note + contact buttons + View profile |
