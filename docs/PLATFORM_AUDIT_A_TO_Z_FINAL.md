# Linkary Platform Audit — A to Z (Final, Post–Fix Pack)

**Scope:** Full platform audit. No schema guessing. All claims tied to file paths and code.

**Status:** Pre-launch fix pack (A–D) applied; post–fix pack hardening applied. See **docs/PRE_LAUNCH_FIXES.md** and **docs/LAUNCH_RISK_CHECKLIST.md**.

---

## Production App Shell (source of truth)

**The logged-in product is the figma app.** All app routes that require a logged-in user render the same shell: **AppWithProviders** → **LinkaryApp** (figma).

- **Entry file:** `apps/web/src/app/AppWithProviders.tsx` — renders `LinkaryApp` from `@/figma/app/App` (and CDPReactProvider when `useCdpAppId()` is set).
- **Route → shell:** Every Next.js page under the app that serves the product uses `<AppWithProviders />` (no children), so the **entire UI** is the figma SPA.

**Logged-in routes (all use figma app):**

| Route | Page file | Shell |
|-------|-----------|--------|
| `/`, `/login`, `/onboarding` | `page.tsx` → `AppWithProviders` | LinkaryApp |
| `/dashboard`, `/profile`, `/profile/edit`, `/analytics`, `/connections`, `/notifications`, `/calendar`, `/market`, `/messages`, `/org/[orgId]`, `/deal/[id]`, `/settings/integrations`, `/settings/wallet`, `/settings/roles-skills`, `/home`, `/explore`, `/plans`, `/billing`, `/privacy`, `/terms`, etc. | Same | LinkaryApp |
| `/[username]` (public) | Conditional: AppWithProviders when owner; public layout otherwise | LinkaryApp or public |

**Demo-only / legacy:**

- There is **no** separate “main app” UI competing with figma for logged-in flows. The “main app” is the Next.js file-based routes that **delegate** to figma. Any “demo” is inside figma (e.g. demo data for landing hero before API load); the same figma components are used with real APIs for dashboard, org detail, profile edit, calendar, connections, etc.
- **Where to implement features:** For any logged-in screen (dashboard, org, profile edit, calendar, connections), implement in **figma app** (`apps/web/src/figma/app/`). Do not duplicate in another app layer.

---

## SECTION 1 — Identity & Auth

- **X OAuth:** All login entry points use `signInWithOAuth({ provider: "x" })` (LoginPage, OnboardingPage, IntegrationsPage, OrgDetailPage connect-X). Auth callback: `apps/web/src/app/auth/callback/page.tsx`.
- **OAuth redirect safety:** GET `/api/auth/safe-redirect-url` — host from **AUTH_REDIRECT_ALLOWLIST** or NEXT_PUBLIC_SITE_URL or fallback `https://www.linkary.xyz`. **`next` param hardened:** only relative paths starting with `/`; no `//`, `\`, `http`, `javascript:`; invalid `next` logged and defaulted to `/`. Callback and OAuth initiation (figma LoginPage, OnboardingPage, OrgDetailPage, IntegrationsPage) use this API for redirectTo.
- **Wallet:** CDP wallet via `/api/wallet/cdp/ensure`; no keys in DB. Service role used only after auth for cross-profile check.

---

## SECTION 2 — Reputation Engine

- **Verified gigs in score:** `GET /api/profile/me-stats` (`apps/web/src/app/api/profile/me-stats/route.ts`) computes `verifiedGigsCount` from deals where `profile_id = user.id` and `status = 'completed'`, passes it into `computeLinkaryPower`, and returns `reputationIndex` / `verifiedGigsCount` in the response. Manual verification comment in code.
- **caseStudyDeltas:** Not implemented by design. `case_studies.metrics` is jsonb with no defined numeric delta field. Comment in me-stats: "caseStudyDeltas not implemented (no schema)". No misleading TODO.
- **Analytics init / ensure-backfill:** Failures surfaced in UI and console (auth callback, figma App.tsx, PublicOnePagerWrapper). Rate limit: 20 requests per 10 min per user (reduced chance of "Too many requests" for normal use). Retry button disabled until `resetAt`; message shows "Try again after HH:MM".

---

## SECTION 3 — Influence Graph

- **Connections:** Requester ≠ recipient (validated in `connections/request`). Duplicate pending prevented. Only recipient can accept (`connections/respond`: `recipient_profile_id === user.id`). **Rate limit:** 20 connection requests per day per profile; 20 responses per day per profile (`rate_limits` table via `rateLimit()`). Notifications: connection_request, connection_accepted.
- **Supporters — policy (Option 1):** Only **published** supporters are counted in the influence rollup. `refreshOrgInfluenceRollup` (`apps/web/src/lib/refreshOrgInfluence.ts`) joins org_supporters with profiles and filters `published = true` for `supportersCount`. Breakdown includes `supportersCount` (public) and `supporters_total_count`. GET `/api/orgs/[orgId]/supporters` already returns only published; rollup and list are consistent.
- **Ambassador/affiliate invite notifications:** Implemented. POST `/api/orgs/[orgId]/ambassadors/invite` and `/affiliates/invite` call `createNotification(invitee, "ambassador_invite"|"affiliate_invite", { entity_type: "org", entity_id: orgId, payload: { org_id: orgId } })` only when a new invite row is created or status goes removed → invited. No duplicate on re-invite. Deep links: `/org/{orgId}?tab=ambassadors` / `?tab=affiliates` (figma App.tsx notifLink).

---

## SECTION 4 — Jobs / Deals / Reviews

- Unchanged. Deal lifecycle, review trigger, CV download (signed URL only). No storage URL leak.

---

## SECTION 5 — Notifications

- **Coverage:** All major actions covered, including ambassador_invite and affiliate_invite (see Section 3). application_submitted notifies org (single recipient per job/org); speaker_request_created notifies hostId; no unbounded admin fan-out.
- **Dedup:** `createNotification` (`apps/web/src/lib/notifications.ts`) skips insert if a notification with same `(recipient_profile_id, type, entity_id)` was created in the last 5 minutes.
- **List/mark-read:** GET `/api/notifications` cursor-based; mark-read by ids with recipient = user.id.

---

## SECTION 6 — Media & Storage

- **Private storage:** No client path may render a raw private Supabase storage URL. All render paths use either SignedMediaImage(file_path), or isPrivateStorageUrl guard and only allow non-private URL or placeholder.
- **Sweep (post-hardening):** PublicHeader uses `isPrivateStorageUrl` for avatar/logo; LandingPage, OrgDetailPage, DashboardPage, ProfileEditPage, PublicOnePager already guarded. GET `/api/search` and GET `/api/landing/featured` do not return private storage URLs in `avatar`/`avatar_url`/`logo_url` (stripped server-side). Media upload remains file-based (no image URL input except external embeds and case study proof_url).

---

## SECTION 7 — Routing & App State

- Production shell: figma (see Production App Shell above). Next.js pages are entry points; figma App holds ALLOWED_ROUTES and SPA state. Public routes: `/[username]`, `/login`, `/auth/callback`.

---

## SECTION 8 — Security & Service Role

- Service role usage unchanged; auth or CRON_SECRET before service. connections/request and connections/respond use service client only for rateLimit() after user auth. No profile_id trust from body.

---

## SECTION 9 — Performance & Scaling

- Unchanged. Rate limits on connections and ensure-backfill; indexes and bounded rollups.

---

## SECTION 10 — Production Readiness (updated)

| Dimension            | Score | Notes |
|----------------------|-------|--------|
| **Stability**        | 8     | Auth and core flows consistent; analytics failures visible; rate limits and retry UX in place. |
| **Security**         | 9     | OAuth allowlist + next sanitization; no private URL leak; connection validation and rate limits. |
| **Scalability**      | 6     | Indexes; rollups bounded; connection/ensure-backfill rate limited. |
| **Product completeness** | 8 | Verified gigs in score; invite notifications; supporters policy explicit; caseStudyDeltas documented as not implemented. |

### Risks mitigated

1. ~~Analytics init silent~~ — Logging and UI message; retry disabled until resetAt.
2. ~~OAuth redirect~~ — Safe redirect API + allowlist + `next` sanitization.
3. ~~Verified gigs not in score~~ — me-stats wires verifiedGigsCount.
4. ~~Invitee not notified~~ — ambassador/affiliate invite notifications on invite.
5. ~~Supporters rollup vs list~~ — Rollup counts only published; breakdown has supporters_total_count.
6. Connection spam — Rate limit 20/day per profile for request and respond.
7. Open redirect via `next` — Sanitized; invalid logged.

### Features not implemented (by design)

- **caseStudyDeltas:** No schema for numeric case study deltas; documented in me-stats and audit.

---

**End of audit.** All statements are tied to code paths in the repo.
