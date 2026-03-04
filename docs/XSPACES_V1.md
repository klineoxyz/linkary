# XSpaces V1 — Linkary-native hub

**Route:** `/xspaces` (stable; no redirect to overview).

## Summary

- **Phase 1 (shipped):** Linkary-native scheduling, calendar, list, RSVP (interested/going), speaker requests, past stats section. Hosts create spaces; anyone can RSVP and request to speak; hosts approve/reject speaker requests.
- **Phase 2 (future):** X API integration — create/schedule on X, ingest stats and reminder counts when access allows.

## Fix: /xspaces no longer bounces

**Cause:** `xspaces` was missing from `ALLOWED_ROUTES` in `apps/web/src/figma/app/App.tsx`. The route lockdown effect sent any disallowed route to overview.

**Fix:** Add `"xspaces"` to `ALLOWED_ROUTES` (same file). Dev-only log added when redirecting due to disallowed route: `[route] redirect to overview: disallowed route`.

## Data model

- **spaces** — host_profile_id, title, description, scheduled_at, duration_mins, status (planned|scheduled|live|ended|cancelled), x_space_id, x_space_url (optional), created_at, updated_at.
- **space_rsvps** — Linkary RSVP: (space_id, profile_id, status: interested|going). One row per user per space.
- **speaker_requests** — (space_id, requester_profile_id, status: pending|approved|rejected, message optional). Host resolves via POST /api/xspaces/speaker-request/resolve.
- **space_stats** — Past stats per space: listeners_total, peak_listeners, duration_seconds, etc. Phase 2 can backfill from X API.
- **space_participants** — X participant snapshot (x_user_id, role) for audience overlap; unchanged.

RLS: public read upcoming spaces; host update/cancel own space; users create own RSVP and speaker request; only host can resolve speaker requests.

## API routes

| Method | Path | Purpose |
|--------|------|--------|
| GET | /api/xspaces/upcoming | Upcoming spaces (planned/scheduled/live, scheduled_at ≥ now) |
| GET | /api/xspaces/past | Ended spaces + statsBySpaceId from space_stats |
| POST | /api/xspaces/create | Create space (forwards to POST /api/spaces) |
| POST | /api/xspaces/rsvp | Body: { space_id, status: "interested" \| "going" } |
| POST | /api/xspaces/speaker-request | Body: { space_id, message? }. Forwards to POST /api/spaces/[id]/speaker-request |
| POST | /api/xspaces/speaker-request/resolve | Host only. Body: { request_id, status: "approved" \| "rejected" } |

Existing routes still work: GET/POST /api/spaces, PATCH /api/spaces/[id], POST /api/spaces/[id]/speaker-request.

## UI (XSpacesPage)

- **Tabs:** My Spaces, Discover, Past, Overlap Alerts.
- **Views:** List and Month calendar (upcoming).
- **Create Space:** Modal — title, description, scheduled_at, duration, cohosts, optional X Space URL.
- **Space detail drawer:** Title, time, description; host: edit/cancel; non-host: Interested, Going (RSVP), Request speaker.
- **Past:** List of ended spaces with optional stats (listeners, peak, duration) from space_stats.

## Phase 2 integration points (X API)

- **Create/schedule on X:** When OAuth scopes and X API allow, call X endpoints after creating a space in Linkary; set x_space_id and x_space_url from response.
- **Ingest stats:** Cron or webhook: for spaces with x_space_id, fetch space stats from X and insert into space_stats.
- **Reminder counts:** If X API exposes reminder/RSVP counts, surface in UI next to Linkary RSVP counts.

## Migration

- `supabase/migrations/20260305000000_xspaces_v1_rsvp_stats.sql` — adds x_space_url (spaces), message + updated_at (speaker_requests), space_rsvps table, space_stats table, RLS.
