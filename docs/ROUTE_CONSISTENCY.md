# Linkary route consistency

This document describes the **intentional** mix of URL patterns for authenticated and app routes. No broad redesign is implied.

## Pattern summary

| URL pattern | Purpose | Implementation |
|-------------|---------|----------------|
| **/app/profile** | Figma app shell — self-only dashboard | Next.js route under `app/app/profile/page.tsx`; renders `AppWithProviders` (LinkaryApp). |
| **/app/profile/edit** | Figma app — profile edit (visibility, pricing, content) | `app/app/profile/edit/page.tsx`. |
| **/profile/deals** | Standalone auth page — gig deals list + review/case study CTAs | `app/profile/deals/page.tsx`; same layout pattern (AppWithProviders, auth redirect). |
| **/profile/work** | Standalone auth page — unified My Work (org + gig completed work) | `app/profile/work/page.tsx`; same layout pattern. |
| **/deal/[id]** | Single org deal detail + review flow | `app/deal/[id]/page.tsx`. |

## Why the mix?

- **/app/*** routes are the **figma app** (single-page-style shell). They live under `app/app/` so the pathname is `/app/profile`, `/app/profile/edit`, etc. Navigation and route state are handled inside LinkaryApp.
- **/profile/*** (without the `app` prefix) are **standalone authenticated pages** that still use `AppWithProviders` for theming and context but are full Next.js routes. They are used for focused flows (deals, work) that benefit from a direct URL and clear back link to the app (e.g. “← Profile” to `/app/profile`).
- **/deal/[id]** is the canonical org-deal detail and review page; it is not under `/app` so it can be linked from emails or shared internally without going through the app shell.

## Intended rules

- **Public profile** remains **/{username}** (no change).
- **Internal work-management** surfaces are **/profile/deals** and **/profile/work** (authenticated, no public exposure).
- No product behavior or auth boundaries are changed by this pattern; it is documented for consistency only.
