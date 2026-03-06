# Slice 2: Speaker Applications — Implementation Plan

## 1. Schema changes

- **speaker_requests**
  - Add `pitch text`, `topic text` (first-class application fields).
  - Add statuses `declined` and `withdrawn`; standardize on **declined** (no dual "rejected"/"declined" in API).
  - Migrate existing `rejected` → `declined` in one migration.
  - New constraint: `status IN ('pending','approved','declined','withdrawn')`.
  - Keep `message`, `updated_at`; ensure `updated_at` is set on any status change.
- **Max 10 approved**
  - Enforce in API: before setting status to `approved`, count `WHERE space_id = ? AND status = 'approved'`; if ≥ 10 return 409 with a clear message.
  - Optional hardening: Postgres function `approve_speaker_request(p_request_id uuid)` that (in one transaction) checks host, counts approved, and updates only if count < 10, to avoid race conditions. **Choice:** implement the function so approval is atomic and race-safe.

## 2. API changes

| Route | Change |
|-------|--------|
| **POST /api/spaces/[id]/speaker-request** | Body: `pitch`, `topic` (required or strong optional), `message?`. Upsert (space_id, requester_profile_id): set status = pending, pitch, topic, message. Re-apply allowed when previous was declined/withdrawn (upsert overwrites). |
| **GET /api/xspaces/[id]/speaker-requests** | Select pitch, topic; join or fetch profile: display_name, username, avatar_url for each requester. Return `approved_count` for the space (count of status = 'approved'). RLS unchanged (host sees all, requester sees own). |
| **POST /api/xspaces/speaker-request/resolve** | Accept `status: "approved" \| "declined"`. Map legacy `"rejected"` → `"declined"`. On approve: call RPC or count + update; if already 10 approved return 409. Set `updated_at`. |
| **POST /api/xspaces/speaker-request/withdraw** | New. Body: `request_id`. Requester only; set status = 'withdrawn', updated_at. Return 403 if not requester. |

No changes to auth, OAuth, or other XSpaces APIs except where required for speaker applications.

## 3. UI changes

- **Non-host (applicant)**
  - "Apply as Speaker" opens form: **Topic**, **Pitch**, optional **Message**.
  - After submit: show application status (Pending / Approved / Declined); if Pending, show "Withdraw" button.
  - If already applied, show status and withdraw when pending; do not show full apply form again (or show form disabled with current pitch/topic and withdraw).
- **Host**
  - "Speaker requests" section: list **pending** applications with avatar, display name, username, **topic**, **pitch**, message (if present).
  - Actions: **Approve** / **Decline** (label "Decline" not "Reject").
  - Show **"X / 10 approved"**; when 10 approved, disable Approve and show short reason (e.g. "Maximum speakers reached").
  - Approved speakers block already exists (host-and-speakers); ensure it shows approved count.
- **Slice 1 cleanup**
  - Reusable **displayTitle** in `xspaces/utils`: `linkary_title?.trim() \|\| x_title?.trim() \|\| title ?? ""`. Use in XSpacesPage, CalendarView, EventCard.
  - **linkary_title** validation in PATCH: trim, empty → null, max length 120.
  - Labels in host detail: **"Linkary title"** and **"Original X title"**.

## 4. Risk notes

- **Backward compatibility:** Existing rows with `rejected` are migrated to `declined`; API and UI use "declined" only. Notifications can keep type `speaker_request_rejected` for old payloads; new ones can use same or add `speaker_request_declined` (optional).
- **RLS:** No change; host and requester already have SELECT/UPDATE. Withdraw is UPDATE by requester.
- **Race on max 10:** Mitigated by doing approval inside a Postgres function (count + update in one transaction) or, if not using RPC, accept small race and return 409 on next request.
- **Duplicate apply:** Upsert on (space_id, requester_profile_id) so one active application per user per space; re-apply overwrites (allowed after declined/withdrawn).

---

**Implementation order:** Migration (schema + RPC) → API (POST apply, GET list, resolve with max-10, withdraw) → UI (form, host list, approved count, withdraw) → Slice 1 cleanup (displayTitle, linkary_title validation, labels).
