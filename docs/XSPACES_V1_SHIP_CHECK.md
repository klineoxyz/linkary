# XSpaces V1 — ship check (8 steps)

Run after deploying code and applying migration `20260305000000_xspaces_v1_rsvp_stats.sql`.

---

## 1. Route stability

- **Action:** Open `/xspaces` in the app (logged in or not).
- **Pass:** Page stays on XSpaces (list/calendar); no redirect to Overview.
- **If fail:** Confirm `"xspaces"` is in `ALLOWED_ROUTES` in `apps/web/src/figma/app/App.tsx`.

---

## 2. Upcoming (list + calendar)

- **Action:** On `/xspaces`, open **My Spaces** or **Discover**. Switch between List and Month.
- **Pass:** Upcoming spaces load; live spaces (status=live) still appear even if `scheduled_at` is in the past.
- **API check:** `GET /api/xspaces/upcoming` returns `spaces` array; no 500.

---

## 3. Create space (host)

- **Action:** Log in as host. Click **Create Space**. Fill title, description, date/time, optional X Space URL. Submit.
- **Pass:** Space is created; it appears in My Spaces and in Discover. Optional `x_space_url` is saved.
- **API check:** `POST /api/spaces` or `POST /api/xspaces/create` with body `{ title, description?, scheduled_at, duration_mins?, x_space_url? }` returns 200 and space `id`.

---

## 4. RSVP (non-host)

- **Action:** Log in as a **different** user. Open Discover, click a space, click **Interested** then **Going** (or vice versa).
- **Pass:** No error; only one row per (space_id, profile_id) in `space_rsvps`; status toggles to last clicked.
- **API check:** `POST /api/xspaces/rsvp` with `{ space_id, status: "interested" | "going" }` returns 200 and the updated row; repeat with the other status to confirm the same row is updated (upsert on `space_id, profile_id`).
- **SQL check:** See “SQL snippets” below: query `space_rsvps` by `profile_id`; duplicate check should return 0 rows.

---

## 5. Speaker request with message

- **Action:** As non-host, open a space detail, optionally enter a message in **Message to host (optional)**, then click **Request speaker**.
- **Pass:** Request is created; host sees it (e.g. HostDashboard or notifications). `speaker_requests` has one row with optional `message`.
- **API check:** `POST /api/spaces/{id}/speaker-request` with `{ message? }` or `POST /api/xspaces/speaker-request` with `{ space_id, message? }` returns 200.

---

## 6. Host approve/reject speaker request

- **Action:** As **host** of that space, open speaker requests (HostDashboard or space management). Approve or reject the request.
- **Pass:** Request status becomes `approved` or `rejected`; `updated_at` is set. Requester can see outcome (e.g. notification).
- **API check:** `POST /api/xspaces/speaker-request/resolve` with `{ request_id, status: "approved" | "rejected" }` as host returns 200 and updated row.

---

## 7. Past tab

- **Action:** On `/xspaces`, open **Past** tab.
- **Pass:** Ended spaces list loads; if any have rows in `space_stats`, listeners/peak/duration show. Empty stats are OK (no errors).
- **API check:** `GET /api/xspaces/past` returns `{ spaces: [...], statsBySpaceId: {...} }`; 200. Works unauthenticated.

---

## 8. No production debug leaks

- **Action:** In production build, visit `/xspaces` and trigger a disallowed-route case (e.g. navigate to an invalid route that would redirect to overview). Check browser console and server logs.
- **Pass:** No `[route] redirect to overview` or other debug logs in production. Redirect logging is gated by `NODE_ENV !== "production"`.

---

## SQL snippets (Supabase SQL Editor)

Paste into Supabase → SQL Editor to validate data. Replace `'<PROFILE_UUID>'` with the signed-in user’s profile id (same as `auth.uid()`).

```sql
-- 1) RSVPs for current user (one row per space; status = interested | going)
SELECT * FROM public.space_rsvps
WHERE profile_id = '<PROFILE_UUID>'
ORDER BY created_at DESC;

-- 2) Duplicate RSVP check (should return 0 rows after migration)
SELECT space_id, profile_id, COUNT(*)
FROM public.space_rsvps
GROUP BY space_id, profile_id
HAVING COUNT(*) > 1;

-- 3) Past spaces (ended) with optional stats
SELECT s.id, s.title, s.scheduled_at, s.status,
       st.listeners_total, st.peak_listeners, st.duration_seconds
FROM public.spaces s
LEFT JOIN LATERAL (
  SELECT listeners_total, peak_listeners, duration_seconds
  FROM public.space_stats
  WHERE space_id = s.id
  ORDER BY captured_at DESC
  LIMIT 1
) st ON true
WHERE s.status = 'ended'
ORDER BY s.scheduled_at DESC
LIMIT 50;

-- 4) Upcoming + live (same logic as GET /api/xspaces/upcoming)
SELECT id, title, scheduled_at, status
FROM public.spaces
WHERE status IN ('planned','scheduled','live')
  AND (scheduled_at >= now() OR status = 'live')
ORDER BY scheduled_at ASC
LIMIT 100;
```

---

## Common SQL mistakes (Supabase)

- **WHERE-only updates:** Always include a filter (e.g. `WHERE space_id = '...'`). Avoid running an update without `WHERE` or you’ll change every row.
- **Placeholder UUID:** Replace `'<PROFILE_UUID>'` with the real profile id (e.g. from `auth.uid()` or your profile row). Do not run queries with the literal placeholder.
- **Missing quotes for UUID:** In raw SQL, UUIDs must be quoted: `WHERE profile_id = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'`. Unquoted or wrong type can cause errors or no rows.
- **PostgREST filters:** In code, use proper quoting for timestamps in `.or()` (e.g. `scheduled_at.gte."2025-03-04T12:00:00.000Z"`). Unquoted ISO strings can break the filter.

---

## Detect flow

- **Single match (confident):** One X Space in the last 15 minutes passes the score threshold (title similarity + scheduled time within 2h). Backend auto-links; UI closes the create modal and refreshes. Space shows `x_space_id` and `x_space_url`; detail drawer shows **Open on X**.
- **Multiple matches (ambiguous):** More than one candidate above threshold. Backend returns `require_selection` and `candidates`; UI shows a **picker**. User selects one → client calls **POST /api/xspaces/link-space** with `space_id` and `x_space_id` → space is updated; UI resets candidates and refreshes.
- **No match:** No X Space in window or none pass the threshold. Backend returns `found: false`; UI shows **paste fallback** so the user can paste the X Space URL.

---

## Cron security check

- **Action:** Call `GET /api/cron/xspaces-stats` or `POST /api/cron/xspaces-stats` without the `Authorization: Bearer <CRON_SECRET>` header (or with a wrong secret).
- **Pass:** 401 Unauthorized (or 503 if `CRON_SECRET` is not set in env). Cron must never run without the correct `CRON_SECRET` header.

---

## Detection QA

- **Two spaces in 15 min:** Create two X Spaces within 15 minutes (different titles/times). In Linkary create a space with “Create on X” and click **Detect my Space**. **Pass:** Picker shows multiple candidates; do not auto-link. User selects the correct one and link succeeds.
- **Mismatched title:** Create Linkary space with title “Alpha Meetup”, then on X create a Space with a completely different title (e.g. “Random Chat”). Click **Detect my Space**. **Pass:** No auto-link (score below threshold); either “No matching Space” or candidates only. Do not link the wrong Space.
- **No token (fallback):** With X not connected (or disconnect for test), open Create Space, enable “Create on X”, create the Linkary space. **Pass:** Step 1 prompts “Connect X first”; Detect is disabled until connected. User can use paste fallback to link via X Space URL.

---

## Quick checklist

| # | Step                    | Pass |
|---|-------------------------|------|
| 1 | /xspaces stable         | ☐    |
| 2 | Upcoming + live visible | ☐    |
| 3 | Create space + x_space_url | ☐  |
| 4 | RSVP one row, toggle     | ☐    |
| 5 | Speaker request + message| ☐    |
| 6 | Host resolve            | ☐    |
| 7 | Past tab loads          | ☐    |
| 8 | No prod debug logs      | ☐    |
| 9 | Detect flow (single/multi/none) | ☐ |
| 10 | Cron requires CRON_SECRET | ☐   |

---

## Final QA checklist (1-page)

| Area | Check | Pass |
|------|--------|------|
| **Route** | /xspaces loads; no redirect to overview | ☐ |
| **Create** | Create Space; optional X URL or Create on X flow | ☐ |
| **Create on X** | Connect X → Open X → Detect; single match auto-links; multiple → picker → link-space; none → paste fallback | ☐ |
| **After link** | Space has x_space_id + x_space_url; detail shows “Open on X” | ☐ |
| **RSVP** | Interested/Going toggles one row; counts + attendee list by role (host full, non-host limited, anon count only) | ☐ |
| **Speaker** | Request with message; host approve/reject; updated_at set | ☐ |
| **Past** | Ended spaces load; stats when present; no crash when absent | ☐ |
| **Upcoming** | Live spaces visible even if scheduled_at in past | ☐ |
| **Security** | No API returns access_token/refresh_token; cron returns 401 without CRON_SECRET | ☐ |
| **Detect safety** | Mismatched title or time >2h → no link; multiple candidates → picker only | ☐ |
| **UI** | Cards/buttons use border-border, bg-card, text-foreground; no one-off zinc-only styles | ☐ |
| **Production** | No debug logs in prod build | ☐ |
