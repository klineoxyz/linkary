# Launch Readiness P3: Request Collab pipeline (DB + modal + inbox)

## Overview

"Request collab" on individual public profiles now creates a **collab request** that the profile owner can see and manage in **/profile/inbox**. No complex chat: one table, RLS-protected, token-styled UI, ISR-safe public profile.

## Table: `collab_requests`

| Column                  | Type         | Constraints                          |
|-------------------------|--------------|--------------------------------------|
| id                      | uuid         | PK, default gen_random_uuid()         |
| created_at              | timestamptz  | NOT NULL, default now()              |
| requester_profile_id    | uuid         | NOT NULL, FK → profiles(id) CASCADE  |
| target_profile_id       | uuid         | NOT NULL, FK → profiles(id) CASCADE  |
| message                 | text         | NOT NULL                             |
| category                | text         | NULL (e.g. gig, ambassador, consulting) |
| budget_text             | text         | NULL                                 |
| status                  | text         | NOT NULL, default 'new', CHECK IN ('new','accepted','archived') |

**Indexes**

- `(target_profile_id, created_at DESC)` — inbox listing
- `(requester_profile_id, created_at DESC)` — “my requests” if needed later

**RLS**

- **Insert:** `requester_profile_id = auth.uid()` (only create as requester).
- **Select:** `requester_profile_id = auth.uid() OR target_profile_id = auth.uid()` (requester and target can read).
- **Update:** `target_profile_id = auth.uid()` (only recipient can change status).
- No delete policy; “Archive” is implemented as status update.

---

## Migration SQL (full)

```sql
-- Collab requests: one user requests to collaborate with another (individual profile).
-- Requester creates; target can read and update status.

CREATE TABLE public.collab_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  requester_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  target_profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message text NOT NULL,
  category text,
  budget_text text,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','accepted','archived'))
);

CREATE INDEX idx_collab_requests_target_created ON public.collab_requests (target_profile_id, created_at DESC);
CREATE INDEX idx_collab_requests_requester_created ON public.collab_requests (requester_profile_id, created_at DESC);

ALTER TABLE public.collab_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collab_requests_insert_requester"
  ON public.collab_requests FOR INSERT
  WITH CHECK (requester_profile_id = auth.uid());

CREATE POLICY "collab_requests_select_requester_or_target"
  ON public.collab_requests FOR SELECT
  USING (
    requester_profile_id = auth.uid()
    OR target_profile_id = auth.uid()
  );

CREATE POLICY "collab_requests_update_target"
  ON public.collab_requests FOR UPDATE
  USING (target_profile_id = auth.uid())
  WITH CHECK (target_profile_id = auth.uid());
```

File: `supabase/migrations/20260275000000_collab_requests.sql`

---

## API

### POST /api/collab-requests

**Auth:** Bearer token required.

**Body:** `{ target_username, message, category?, budget_text? }`

- `target_username`: string (resolved via `public_profile_view` by username or twitter_username).
- `message`: string, required, non-empty.
- `category`, `budget_text`: optional strings.

**Response:** `{ ok: true, id: uuid }` or `{ ok: false, code, message }`.

**Errors:** 401 Unauthorized, 400 Bad request (e.g. missing message, self-request), 404 Profile not found.

---

### GET /api/collab-requests/inbox

**Auth:** Bearer token required.

Returns requests where `target_profile_id = auth.uid()`, newest first. Each row includes requester display fields from `public_profile_view` (username, display_name, avatar_url) for list display.

**Response:** `{ ok: true, requests: [...] }`.

---

### POST /api/collab-requests/update

**Auth:** Bearer token required.

**Body:** `{ id, status }` — `status` must be `accepted` or `archived`.

Only the target (recipient) can update. Returns 404 if row not found or caller is not the target.

**Response:** `{ ok: true, id, status }` or `{ ok: false, code, message }`.

---

## UI

### ActionBar (individual profile)

- **Authed:** Primary CTA is a button that opens the **Request collab** modal (no link to profile).
- **Not authed:** “Sign in to contact” link (unchanged) redirects to login with return URL.
- Modal: message (required), category dropdown (optional: gig, ambassador, consulting, other), budget (optional). Submit → POST /api/collab-requests → success toast → modal closes.

### Inbox: /profile/inbox

- **noindex** (metadata in `layout.tsx`).
- Auth required; redirect to login if not signed in.
- Lists requests (requester avatar, display name, username link, message preview, category/budget, relative time).
- Actions for `new` requests: **Accept**, **Archive** (POST update with status).
- Empty state when there are no requests.

---

## Files changed / added

| Path | Change |
|------|--------|
| `supabase/migrations/20260275000000_collab_requests.sql` | New: table, indexes, RLS |
| `apps/web/src/app/api/collab-requests/route.ts` | New: POST create |
| `apps/web/src/app/api/collab-requests/inbox/route.ts` | New: GET inbox |
| `apps/web/src/app/api/collab-requests/update/route.ts` | New: POST update status |
| `apps/web/src/app/(public)/[username]/ActionBar.tsx` | Request collab opens modal when authed |
| `apps/web/src/app/(public)/[username]/RequestCollabModal.tsx` | New: modal form + submit |
| `apps/web/src/app/(public)/Toaster.tsx` | New: Sonner Toaster for public layout |
| `apps/web/src/app/(public)/layout.tsx` | Mount PublicToaster |
| `apps/web/src/app/profile/inbox/page.tsx` | New: inbox list + Accept/Archive |
| `apps/web/src/app/profile/inbox/layout.tsx` | New: robots noindex |
| `docs/LAUNCH_P3_COLLAB_REQUESTS.md` | This doc |

---

## QA

- Signed-in user can open “Request collab” on another user’s individual profile, submit message (and optional category/budget), and see success toast.
- Target user sees the request in /profile/inbox with requester info and can Accept or Archive.
- Non-target cannot read others’ inbox (RLS + API enforce target_profile_id = auth.uid() for inbox and update).
- Build passes.
