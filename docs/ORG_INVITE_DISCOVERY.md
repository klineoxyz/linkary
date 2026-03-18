# Org invite discovery & unread (creator + org)

Minimal, privacy-safe discovery: **no fake delivery**, **no email/push in this pass**. Unread is grounded in stored timestamps.

## Model

| Surface | Column | Meaning |
|---------|--------|---------|
| Job invite (`org_job_invites`) | `viewed_at` | Set when creator opens **Org invites** (`/app/org-invites`) via batch `POST /api/me/org-invites/mark-inbox-opened`. |
| Program invite (`creator_program_invites`) | `invitee_inbox_seen_at` | Same batch endpoint sets this for all program rows for the creator. |

- **Unread (creator nav / API):** `viewed_at IS NULL` (jobs) or `invitee_inbox_seen_at IS NULL` (programs).
- **Not** “delivered” or “push sent” — only “creator has opened the org-invites inbox since this invite existed.”
- **Applied / active deal:** Still derived from `applications` / `deals`; unchanged.

## APIs

- `GET /api/me/org-invites/unread` → `{ job, program, total }`
- `POST /api/me/org-invites/mark-inbox-opened` → sets all null timestamps for the signed-in profile (idempotent).
- `GET /api/me/org-invites` → includes `invitee_inbox_seen_at` on program invites.

## Creator UI

- Sidebar **Org invites** badge = `total` from unread API (personal workspace only).
- Bell dropdown: row **“N org invites”** → navigates to Org invites (same unread source; not the `notifications` table).
- **Org invites page** sections (after load): **New in your inbox** (unseen), **Awaiting your action** (seen, still needs response), **History** (applied, deal, passed, settled programs). Opening the page triggers mark-inbox-opened (nav badge clears after refresh event).

## Org UI (operators)

`GET /api/orgs/[orgId]/sourcing` `summary` adds:

- `job_invites_unseen_inbox` — job invites where `viewed_at` is null.
- `program_invites_unseen_inbox` — program invites where `invitee_inbox_seen_at` is null.
- `job_invites_responded_no_application` — creator set interest / pass / hide, no application and no active deal yet.

Shown on org sourcing card; does **not** claim the creator “saw” anything except where `viewed_at` / `invitee_inbox_seen_at` are set.

## RLS / authority

- Org members: manage org job invites & program invites as today.
- Creator: read own invites; update own `viewed_at` / `creator_response` on job invites (existing guard); update own program invite status; **invitee_inbox_seen_at** updated only as own row via same invitee UPDATE policy as other invitee fields.

## QA checklist

- [ ] New job invite → creator sidebar shows unread count until they open Org invites.
- [ ] New program invite → counts toward same unread until inbox opened.
- [ ] After opening Org invites, unread API returns 0 (job + program).
- [ ] Job responses (interested / declined / dismissed / undo) still work.
- [ ] Applied and active deal still override pipeline display.
- [ ] Personal vs org workspace: badge only in personal sidebar; org mode unchanged.
- [ ] Sourcing summary unseen counts match DB for test org.
- [ ] No CRM / analytics / invite-onboarding / active-context regressions.

## Later (fuller notifications)

- Optional `notifications` rows on invite create (service role), email/push, per-invite read state, digest — not required for current grounded model.
