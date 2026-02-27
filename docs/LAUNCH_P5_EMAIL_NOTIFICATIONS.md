# Launch Readiness P5: Collab Request Notifications (Email MVP + rate limit)

## Overview

When a new collab request is created, the target user is notified by email so requests are not missed. A simple per-user, per-type rate limit prevents spam. No UI redesign; P3/P4 APIs unchanged.

## Constraints

- Use **Supabase Auth email** for the recipient (target user’s email from `auth.users`).
- Use **Resend** for sending email (server-side only).
- Do **not** leak emails in API responses.
- **RLS** on existing tables (e.g. `collab_requests`) stays unchanged.
- Existing P3/P4 collab APIs continue to work; request creation never fails due to email errors.

---

## Step 0 — Auth email source

Recipient email is resolved from **Supabase Auth** (service role):

- `target_profile_id` = profile id = auth user id (in this codebase).
- Server calls `service.auth.admin.getUserById(target_profile_id)` to get `user.email`.
- If no email (edge case), we skip sending and do not fail the request.

---

## Step 1 — Env (server-only)

Set in Railway / Vercel (or local `.env` for server):

| Variable        | Description                          | Example                                  |
|----------------|--------------------------------------|------------------------------------------|
| `RESEND_API_KEY` | Resend API key for sending email     | (from Resend dashboard)                   |
| `EMAIL_FROM`     | Sender identity for transactional mail | `Linkary <noreply@linkary.xyz>`        |

- These must **not** be exposed to the client (no `NEXT_PUBLIC_` prefix).
- Optional: `NEXT_PUBLIC_APP_URL` for CTA link (defaults to `https://linkary.xyz`).

---

## Step 2 — DB: notification rate limit table

**Migration:** `supabase/migrations/20260277000000_notification_log.sql`

- **Table:** `public.notification_log`
  - `id` uuid PK, default `gen_random_uuid()`
  - `created_at` timestamptz default `now()`
  - `user_id` uuid not null (target user / recipient)
  - `type` text not null (e.g. `collab_request_new`)
  - `ref_id` uuid null (e.g. `collab_requests.id`)
- **Index:** `(user_id, type, created_at DESC)` for rate-limit lookups.
- **RLS:** Enabled with a policy that allows no rows for `anon`/`authenticated`; **service_role** bypasses RLS and is the only intended consumer. Table is server-only and private.

---

## Step 3 — Server helper: `apps/web/src/lib/notify.ts`

- **`canSend(supabase, userId, type, windowMinutes?)`**  
  Returns true if there is **no** row in `notification_log` for that `user_id` + `type` within the last `windowMinutes` (default 10). Used to decide whether to send.

- **`logSent(supabase, userId, type, refId?)`**  
  Inserts a row into `notification_log` after a successful send (for rate limiting).

- **`sendCollabRequestEmail(params)`**  
  Sends via Resend SDK.
  - **Subject:** `New collaboration request on Linkary`
  - **Body:** requester name + @handle, category + budget (if provided), first ~160 chars of message, CTA button “View request” → `https://linkary.xyz/profile/inbox` (or `NEXT_PUBLIC_APP_URL/profile/inbox`).

Uses env: `RESEND_API_KEY`, `EMAIL_FROM`.

---

## Step 4 — Trigger on POST /api/collab-requests

In `apps/web/src/app/api/collab-requests/route.ts`:

1. After insert succeeds, create **service_role** client.
2. **Rate limit:** if `canSend(service, target_profile_id, "collab_request_new", 10)` is false, skip sending; still return success.
3. **Recipient email:** `service.auth.admin.getUserById(target_profile_id)` → use `user.email`. If missing, skip sending.
4. **Send:** call `sendCollabRequestEmail(...)` with requester display name/username (from `profiles`), message preview, category, budget, inbox URL.
5. **Log:** on send success, `logSent(service, target_profile_id, "collab_request_new", collab_request_id)`.
6. **Errors:** never fail the request creation; log email/send errors and return success.

---

## Step 5 — QA

- Create request → inbox new count increments (existing P4 behavior).
- Recipient receives one email per request **unless** rate-limited (see below).
- Create multiple requests to the **same** target quickly → only the first triggers an email within the 10-minute window.
- If recipient has no auth email → skip send safely; request still created.
- Build passes (`pnpm build` in `apps/web`).

---

## Rate limit rules

- **Window:** 10 minutes per `(user_id, type)`.
- **Type:** `collab_request_new`.
- At most one “new collab request” email per target per 10 minutes; further requests in that window do not send email but are still stored and visible in inbox.

---

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260277000000_notification_log.sql` | New table + index + RLS policy |
| `apps/web/package.json` | Added `resend` dependency |
| `apps/web/src/lib/notify.ts` | New: `canSend`, `logSent`, `sendCollabRequestEmail` |
| `apps/web/src/app/api/collab-requests/route.ts` | After insert: rate limit, auth email lookup, send email, log |

---

## Security

- Emails are only used server-side and never returned in API responses.
- `notification_log` is not readable by app users (RLS denies all; service_role only).
- Resend API key and `EMAIL_FROM` are server env only.
