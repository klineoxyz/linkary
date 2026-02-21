# Production routes — final list (no “coming soon” sweep)

After the “no coming soon” sweep, only **real, DB-backed or redirect** routes are reachable from the app.

---

## Rule applied

- Any reachable route is either **fully real** (DB-backed, RLS-safe) or **removed from nav and hard-redirect to Overview**.
- No “coming soon”, no mock/demo arrays, no placeholder UI for production routes.

---

## A) Production routes that remain reachable (real)

| Route name      | Nav location           | Tables/APIs/RLS |
|-----------------|------------------------|------------------|
| **landing**     | Home link              | Static landing. |
| **overview**    | Overview               | Header media from DB; demo.me/demo.project for featured CTAs only. |
| **dashboard**   | My Dashboard           | `getMyProfile`, `listOrgsForUser`, orgs. |
| **profile**     | My Profile             | `getMyProfile`, `getProfileProfessions`, `listCaseStudiesForProfile`, `getOrCreateConversation`, `api/profile/me-stats`, X connection. |
| **profileEdit** | Profile Builder        | `getMyProfile`, `updateMyProfile`, `getProfileProfessions`, `setProfileProfessions`. |
| **userProfile** | (links from Overview, etc.) | Public profile by username; DB-backed. |
| **market**      | Jobs & Sprints         | **DB-only:** `listJobs()`; apply via `applyToJobAsProfile` / `applyToJobAsOrg`; conversations. Empty state when no jobs. |
| **messages**    | Messages               | **DB-only:** `listConversationsForUser`, `listMessages`, `sendMessageAsProfile` / `sendMessageAsOrg`, `getOrCreateConversation`. Empty state when no conversations. |
| **analytics**   | Analytics              | Real analytics (DB-backed). |
| **privacy**     | Privacy & Data         | `getMyProfile`, `updateMyProfile`. |
| **integrations**| Integrations (Account) | `getMyProfile`, X connection DB truth, `ensure-x-connection`, `sync-session-x`, `disconnectTwitter`. |
| **rolesSkills** | Roles & Skills (Account) | `getProfileProfessions`, `setProfileProfessions`; professions from DB; add custom profession (dedupe). |
| **wallet**      | Wallet (Profile /settings/wallet) | `api/wallet/balances`, `api/wallet/cdp/status`, etc.; real CDP + external wallets. |
| **login**       | (unauthenticated)      | Supabase auth. |
| **onboarding**  | (post-login)           | `getMyProfile`, `updateMyProfile`, `setProfileProfessions`. |
| **orgDetail**   | (from dashboard/orgs)  | `getOrgById`/`getOrgBySlug`, members, jobs, case studies, RLS. |
| **brandProfile**| (links)                | Org public view. |
| **terms**       | (footer/links)         | Static. |
| **privacyPolicy** | (footer/links)        | Static. |
| **plansBilling** / **billing** / **pricing** | (links) | Plans & billing page. |

---

## B) Routes removed from nav and redirect to Overview

These are **no longer in the sidebar**; direct URL or any in-app link sends users to **Overview**.

| Removed route       | Previous nav              | Redirect target |
|---------------------|---------------------------|------------------|
| **explore**         | Discover → Explore        | Overview |
| **leaderboards**    | Discover → Leaderboards   | Overview |
| **calendar**        | (linked from Overview)   | Overview |
| **circles**         | Circles & Networks → Circles | Overview |
| **circleDetail**    | (from circles)           | Overview |
| **kolLists**        | Circles & Networks → KOL Lists | Overview |
| **capitalPartners** | Circles & Networks → Capital Partners | Overview |
| **createCircle**    | (modal from circles)     | Overview |

**Implementation:**  
- Sidebar: removed “Discover” (Explore, Leaderboards) and “Circles & Networks” (Circles, KOL Lists, Capital Partners).  
- `MOCK_ROUTES_REDIRECT_TO_OVERVIEW` in `App.tsx`: when `route.name` is one of the above, `setRoute({ name: "overview" })` runs.  
- For those route names, the app renders `<OverviewPage />` until the redirect completes, so no mock content is shown.

---

## C) “Coming soon” and placeholders removed

- **comingSoon:** All `setRoute({ name: "comingSoon" })` replaced with `setRoute({ name: "overview" })`.  
- **ComingSoonModal** and **routeToLabel** removed; no “not available yet” overlay.  
- **MarketplacePage:** Uses only `dbJobs` from `listJobs()`; no `demo.marketplace` fallback. Empty state: “No jobs or sprints yet…”.  
- **MessagesPage:** Uses only `conversations` from `listConversationsForUser`; **fallbackConvs** (mock) removed. Empty state: “No conversations yet…”.  
- **Nav badges:** Removed static “3” and “2” from Jobs & Sprints and Messages.

---

## D) Other routes (not in main nav)

- **verification** / **verificationInbox:** Already redirected to Overview (unchanged).  
- **showcase**, **monetizationShowcase**, **monetizationFlowShowcase**, **hostDashboard**, **availability**, **calendarRefined**, **enhancedCalendar**, **agencyProfile**, **creatorProfile**, **publicCreator**, **publicProject**, **publicCompany:** Still in route switch; not in sidebar. Left as-is unless you remove or redirect them in a follow-up.

---

## E) Files touched (summary)

| File | Change |
|------|--------|
| `apps/web/src/figma/app/App.tsx` | Removed Discover + Circles & Networks from sidebar; removed badges; redirect mock routes to overview; render Overview for mock route names; comingSoon → overview; removed ComingSoonModal; MarketplacePage DB-only + empty state; MessagesPage no fallback + empty state. |
| `apps/web/src/figma/app/components/UserProfilePage.tsx` | comingSoon → overview. |
| `docs/PRODUCTION_ROUTES_FINAL.md` | This checklist. |

---

## F) Must-check (verified)

- **Wallet:** Real (WalletShell, balances API, CDP status). No “connect wallet coming soon” in production path; LinkProfilePanel shows only real recovery methods.  
- **Roles & Skills:** Real (professions from DB, add custom, select multiple, save; public profile displays them).  
- **Messages:** Real (list conversations, send, read); RLS and participant checks as per existing `messages` lib.  
- **Market (Jobs & Sprints):** Real (jobs from `listJobs()` only; apply flow and conversations DB-backed).
