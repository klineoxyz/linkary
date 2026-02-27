# Phase 2 P1: Profile Insights Snapshot

## Overview

Profile Insights (Snapshot) is a **snapshot-only** page that shows the same Insights UI (ScoreCard, TopFollowers, SocialGraph, etc.) for any user profile, using only cached/social data. It is **separate** from the deep analytics experience at `/analytics`.

## Ownership boundaries

| Route / feature | Owner | Purpose |
|-----------------|--------|---------|
| `/profile/insights` | Insights Snapshot | Own profile snapshot (noindex) |
| `/u/[username]/insights` | Insights Snapshot | Other user snapshot (noindex) |
| `/analytics` | Analytics only | Backfill, rebuild, job status, diagnostics |

**Do not** resurrect `/profile?tab=insights`. Insights are only available as dedicated snapshot routes above.

## Allowed endpoints (Insights Snapshot)

The Insights Snapshot page may use **only** these APIs:

| Method | Endpoint | When |
|--------|----------|------|
| GET | `/api/public/profile/[username]` | Other user: public profile basics |
| GET | `/api/social/insights?provider=x&username=...` | Any: cached social insights (cross-user) |
| GET | `/api/profile/me-stats` | Own profile only |
| POST | `/api/profile/refresh-x-insights` | Own profile only (optional refresh) |

## Forbidden endpoints (Insights Snapshot)

The Insights Snapshot must **not** use any of the following (reserved for `/analytics`):

- `GET /api/analytics/x`
- `GET /api/analytics/init-status`
- `POST /api/analytics/backfill-90`
- `POST /api/analytics/x/rebuild`
- `GET /api/analytics/x/job`

Anything under `analytics/*` is owned by the `/analytics` page only.

## UI rules

- **Base:** `InsightsSnapshot` reuses the same UI as the former Insights tab (ScoreCard, TopFollowersCard, SocialGraphCard, etc.) but is implemented in `InsightsSnapshot.tsx` with **no** analytics API usage.
- **Social graph:** Data for `SocialGraphCard` comes **only** from `insights.series` (followers/score from social insights). If there is no series data, show a simple empty state; **no** fallback to analytics snapshots.
- **Theme:** Light theme only (`variant="light"` and token-based classes). No `text-white` / `border-white` / `bg-white` on this page.

## Navigation

- **Own profile:** Profile page has a “View Insights” link → `/profile/insights`.
- **Other users:** `onAccountClick` (e.g. in RecommendedAccountsCard) routes to `/u/[username]/insights` (route name `userInsights`), not `profile?tab=insights`.
- Watchlist and other profile links continue to go to the profile page; only account-click-from-insights goes to the insights snapshot for that user.

## SEO

- `/profile/insights` and `/u/[username]/insights` are **noindex** (same as other app routes), via layout metadata.

## Performance

- **SWR** with `dedupingInterval: 60_000` (60s) for:
  - `/api/social/insights?provider=x&username=...`
  - `/api/public/profile/[username]`
  - `/api/profile/me-stats` (own profile only)
- Avoid double fetches and request waterfalls; parallel fetches where possible.

## Files

| Path | Role |
|------|------|
| `apps/web/src/app/profile/insights/page.tsx` | Next route: own profile insights |
| `apps/web/src/app/profile/insights/layout.tsx` | noindex metadata for own insights |
| `apps/web/src/app/u/[username]/insights/page.tsx` | Next route: other user insights |
| `apps/web/src/app/u/[username]/insights/layout.tsx` | noindex metadata for user insights |
| `apps/web/src/figma/app/components/profile/InsightsSnapshot.tsx` | Snapshot-only UI and data logic |
| `apps/web/src/figma/app/App.tsx` | Route mapping: `profileInsights` → `/profile/insights`, `userInsights` → `/u/[username]/insights`; renders `InsightsSnapshot` |
