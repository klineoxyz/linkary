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
- **API check:** `POST /api/xspaces/rsvp` with `{ space_id, status: "interested" | "going" }` returns 200 and row; repeat with other status updates same row.

---

## 5. Speaker request with message

- **Action:** As non-host, open a space detail, click **Request speaker**. Optionally add a message (if UI supports it). Submit.
- **Pass:** Request is created; host sees it (e.g. HostDashboard or notifications). `speaker_requests` has one row with optional `message`.
- **API check:** `POST /api/spaces/{id}/speaker-request` or `POST /api/xspaces/speaker-request` with `{ space_id, message? }` returns 200.

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
