# Launch Risk Checklist

Short, actionable list. Each item includes where to check (route/file).

---

## Env (required for production)

- **AUTH_REDIRECT_ALLOWLIST** — Comma-separated hostnames for OAuth and post-login redirect (e.g. `linkary.xyz,www.linkary.xyz`). If unset or host not in list, fallback is NEXT_PUBLIC_SITE_URL or `https://www.linkary.xyz`. See `apps/web/src/app/api/auth/safe-redirect-url/route.ts`.
- **NEXT_PUBLIC_SITE_URL** — Used by safe-redirect when allowlist is empty or for site origin. Set for prod (e.g. `https://www.linkary.xyz`).
- **SUPABASE_SERVICE_ROLE_KEY** (or SERVICE_ROLE_KEY) — Required for ensure-backfill, notifications, connections rate limit, wallet cross-check, cron, etc. Never expose to client.
- **CRON_SECRET** — Protect cron routes (e.g. backfill-x-90d-batch, sync-org-influence-daily). See cron route handlers.
- **NEXT_PUBLIC_SUPABASE_URL**, **NEXT_PUBLIC_SUPABASE_ANON_KEY** — Client and server auth/storage.

---

## Auth & redirect

- OAuth redirect uses **safe-redirect API only** — Check: figma LoginPage, OnboardingPage, OrgDetailPage (connect X), IntegrationsPage call `/api/auth/safe-redirect-url?for=callback` and use returned URL as `redirectTo`. File: `apps/web/src/figma/app/App.tsx` (and related pages).
- Auth callback post-login redirect uses safe-redirect with `next` — Check: `apps/web/src/app/auth/callback/page.tsx` (fetch safe-redirect-url with `next=...`).
- Invalid `next` is rejected and logged — Check: `apps/web/src/app/api/auth/safe-redirect-url/route.ts` (sanitizeNext, default `/`, console.warn).

---

## Score & influence

- Verified gigs affect me-stats score — Check: `apps/web/src/app/api/profile/me-stats/route.ts` (verifiedGigsCount from deals, passed to computeLinkaryPower; response includes verifiedGigsCount).
- Influence rollup counts only **published** supporters — Check: `apps/web/src/lib/refreshOrgInfluence.ts` (join org_supporters → profiles where published = true; breakdown.supportersCount, supporters_total_count).

---

## Connections

- Rate limit: 20 requests/day, 20 responses/day per profile — Check: `apps/web/src/app/api/connections/request/route.ts`, `connections/respond/route.ts` (rateLimit with windowSeconds 86400).
- Requester ≠ recipient; only recipient can accept — Check: same files (recipient id from DB; respond checks recipient_profile_id === user.id).

---

## Notifications

- Invitee notified on ambassador/affiliate invite — Check: `apps/web/src/app/api/orgs/[orgId]/ambassadors/invite/route.ts`, `affiliates/invite/route.ts` (createNotification only on new invite or status removed→invited).
- Dedup: no duplicate (recipient, type, entity_id) within 5 min — Check: `apps/web/src/lib/notifications.ts` (select before insert).

---

## Media

- No private Supabase storage URL in client img src — Check: PublicHeader, LandingPage, OrgDetailPage, DashboardPage, ProfileEditPage, PublicOnePager use isPrivateStorageUrl or SignedMediaImage. Search and landing/featured APIs strip private URLs from avatar/logo. Files: `apps/web/src/components/public/PublicHeader.tsx`, `apps/web/src/app/api/search/route.ts`, `apps/web/src/app/api/landing/featured/route.ts`, and figma components as in audit.

---

## Analytics init

- ensure-backfill failures visible (no silent catch) — Check: auth callback, figma App.tsx, PublicOnePagerWrapper use console.error and set analytics_failed state. File: `apps/web/src/app/auth/callback/page.tsx`, `apps/web/src/figma/app/App.tsx`, `apps/web/src/app/(public)/[username]/PublicOnePagerWrapper.tsx`.
- Rate limit 20 per 10 min per user — Check: `apps/web/src/app/api/analytics/ensure-backfill/route.ts` (limit 20, windowSeconds 600). Reduces "Too many requests" for normal use; Retry disabled until resetAt.

---

## Production shell

- Logged-in app is figma — Check: All app pages render `<AppWithProviders />` which renders `LinkaryApp` from `@/figma/app/App`. File: `apps/web/src/app/AppWithProviders.tsx`; page files under `apps/web/src/app/`.

---

## Build & regression

- **pnpm run build** must pass after any change.
- No feature regressions: calendar (XSpaces), wallet (CDP), login (X OAuth), media upload (file input only; proof_url / external embeds allowed as documented).
