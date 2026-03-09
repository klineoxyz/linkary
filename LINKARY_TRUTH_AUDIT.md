# Linkary — Full Product + Backend + Launch-Readiness Truth Audit

**Date:** 2026-03-10  
**Scope:** Core flows, mock data, case studies, analytics, KOL/circles, backend, comparison to prior audits.  
**Source of truth:** Current codebase and referenced audit docs.

---

## Executive Summary

Linkary has **two parallel job/deal systems** (org jobs + gigs), both implemented and working. **Profile and org creation, org ownership, jobs, applications, gig applications, gig deals, deal completion (gig path), and verified reviews (gig path)** are implemented and wired. **Case studies** (profile + org) and **partner programs** (affiliate/ambassador) with **invite and accept** are implemented. **Circles and KOL lists have no backend**: they use only demo/mock data and in-memory state; nothing is saved or reusable. **Dashboard** mixes real data (myOrgs, myDeals, me-stats) with **large amounts of hardcoded chart and KPI data** (category distribution, brand performance, X Spaces, credibility growth, popularity metrics), which is **misleading** if users believe it is theirs. **Analytics** (init-status, backfill, /api/analytics/x) are real for the current user; **Profile Insights** tab still duplicates deep analytics (contrary to prior IA recommendation). **SEO** (robots, sitemap, noindex on public profile) is in place; **design** (dark tokens on light shell on Dashboard/Analytics) and **performance** (bundle, duplicate fetches) recommendations from prior audits are **not** fully implemented. **Org-deal completion** (deals table) uses `mark-accepted` (delivered → accepted) but there is no dedicated “complete” API that sets `status = 'completed'`; **reviews for org deals** are enforced at DB/trigger level but **POST /api/reviews** only implements the **gig_deal** path, so org-deal reviews are not creatable via the main API.

**Verdict:** Core creator/org and gig flows are **launch-capable**. Circles/KOL are **not** (no persistence). Dashboard mock data and Profile Insights duplication are **launch-risk** (misleading/confusing). Fix mock data and clarify or remove Profile Insights before claiming “launch-ready.”

---

## A. Core User and Org Flows — Status

| # | Flow | Status | Evidence |
|---|------|--------|----------|
| 1 | **Personal profiles** | **Working** | Profile created via auth + `profiles` row; `ProfileEditPage` and `/profile/edit`; `GET /api/profile/me-stats`; public profile `(public)/[username]/page.tsx` with real data. |
| 2 | **Org / brand / project profiles** | **Working** | `CreateOrgModal` → `createOrg()` → RPC `create_org_and_membership`; `orgs` + `org_members`; `OrgDetailPage` loads org by id. |
| 3 | **Creator becomes owner/admin** | **Working** | `create_org_and_membership` sets `owner_profile_id = uid` and inserts `org_members(role = 'owner')`; `is_org_admin` checks `orgs.owner_profile_id` and `org_members` owner/admin. |
| 4 | **Orgs publish jobs/sprints** | **Working** | `jobs` table (org_id); OrgDetailPage Jobs tab; `POST /api/orgs/[orgId]/jobs`; `listJobs` from `@/lib/jobs`. |
| 5 | **Users apply to jobs** | **Working** | `applications` table; apply to **org jobs** (applications); **gigs** (profile-owned): `POST /api/gigs/[id]/apply` → `gig_applications`. |
| 6 | **Orgs accept applications and create deals** | **Working** | Org jobs: `POST /api/applications/[id]/accept` → inserts into `deals`, updates application and job. Gigs: `PATCH /api/gig-applications/[id]/status` with `accepted` → inserts into `gig_deals`. |
| 7 | **Deals completed and reviewed** | **Partial** | **Gig deals:** `POST /api/deals/[id]/complete` sets `gig_deals.status = 'completed'`; `POST /api/reviews` requires `gig_deal` and creates verified review. **Org deals:** `POST /api/deals/[id]/mark-accepted` sets `accepted_at`; DB trigger allows reviews when `deals.status = 'completed'`, but there is **no API** that sets `deals.status = 'completed'` and **POST /api/reviews** only implements gig_deal path — org-deal reviews not creatable via this API. |
| 8 | **Projects create/save KOL / creator circles** | **Broken** | No backend. `CirclesOverviewPage` uses `demoCircles`; `CreateCircleFlow` uses `demoMembers`; no table, no API, no persistence. |
| 9 | **Projects list creator / ambassador / affiliate programs** | **Working** | `partner_programs` (profile/org); `org_affiliations`, `org_ambassadors`; OrgDetailPage Affiliates/Ambassadors tabs; public profile and org pages show partner programs. |
| 10 | **Projects invite creators** | **Working** | `POST /api/orgs/[orgId]/affiliates/invite`, `POST /api/orgs/[orgId]/ambassadors/invite` (by handle or profile_id); notifications. |
| 11 | **Invitees accept** | **Working** | `PATCH /api/orgs/[orgId]/affiliates/[id]`, `PATCH /api/orgs/[orgId]/ambassadors/[id]` with `status: 'active'` = accept. |

---

## B. Mock / Fake / Placeholder Data (Summary)

See **LINKARY_MOCK_AND_GAPS_CHECKLIST.md** for the full list. Highlights:

- **DashboardPage.tsx:** `categoryDistribution`, `brandPerformanceData`, `brandAudienceData`, `profileViewsData`, `socialPowerGrowth`, `xSpacesData`, `xSpacesStats`, `credibilityGrowth`, `popularityMetrics` — all **hardcoded**. Personal stats and brand cards use **real** myDeals/meStats/myOrgs, but brand card metrics (revenue, projects, followers, engagement) are **zeros** and charts are **fake**.
- **Circles:** `CirclesOverviewPage` → `demoCircles`; `CreateCircleFlow` → `demoMembers`; `KOLListsPage` → `demoCreators` (search results are real but lists not saved).
- **CreatorProfileDemo.tsx / CreatorProfilePage.tsx:** `demoCreator` / `demoCreatorData` — demo-only components.
- **PublicProfilePage.tsx / PublicStandalonePage.tsx:** `demoPublicProfileData`, `demoProjectProfile` used when `data` not passed — **misleading** if ever rendered without real payload.
- **BrandProfilePage.tsx:** `u.caseStudies` default `[]`; can show real or empty; no fake array in file but component may receive demo data from route.

---

## C. Case Studies Audit

- **Add / edit / remove:** **Working.** Profile: `listCaseStudiesForProfile`, `createCaseStudyForProfile`, delete in `ProfileEditPage`; API `PATCH/DELETE /api/case-studies/[id]` with ownership (profile or org admin). Org: `listCaseStudiesForOrg`, `createCaseStudyForOrg` in OrgDetailPage; same API for org-owned case studies.
- **Feature / visibility:** `is_public` column; public profile and org pages only show `is_public = true`; RLS in `20260285000000_case_studies_rls_select_public_only.sql` and `20260286000000_case_studies_rls_tighten.sql`.
- **Duplication / ownership:** Polymorphic `owner_type`, `owner_profile_id`, `owner_org_id`; no duplication issue; ownership enforced in API and RLS.
- **Launch readiness:** Case studies are **launch-ready** for profile and org; ensure no UI falls back to demo case study arrays on public routes.

---

## D. Analytics Audit

- **Availability:** All authenticated users can call `GET /api/analytics/init-status`, `GET /api/analytics/x`, `GET /api/analytics/x/summary`; `POST /api/analytics/ensure-backfill` (auth callback / app init); `POST /api/analytics/backfill-90` (rate-limited). Data is **keyed by current user** (profile_id from JWT).
- **Real vs mock:** Analytics APIs read from `x_analytics_rollups`, `x_top_drivers`, `profile_analytics_baseline`, `analytics_snapshots`, `x_daily_snapshots`, `x_window_aggregates`, `analytics_jobs` — **real** when backfill/worker has run. No mock inside analytics API routes.
- **By route:** **Dashboard:** fetches `me-stats` only (real); does **not** fetch `/api/analytics/x` for charts; chart data on Dashboard is **hardcoded** (see Mock section). **Analytics page:** uses init-status, /api/analytics/x, backfill-90, rebuild — **real**. **Profile Insights tab:** uses me-stats, /api/analytics/x, /api/social/insights — **duplicate** of Analytics page and still present (IA recommended removal).
- **Initialization / backfill / cache:** ensure-backfill called from auth callback and App init; backfill-90 and worker populate tables; no shared client cache (duplicate fetches when moving Profile → Insights → Analytics as in AUDIT_PERFORMANCE.md).
- **Misleading UI:** Dashboard charts and many KPIs are **not** from analytics APIs — they are static arrays; users may think they are personal metrics. Empty/error states exist on Analytics page (init failed, rate limit).

---

## E. KOL / Creator Circles and Creator Program Audit

- **Create KOL lists / circles:** **No.** No table or API for “circles” or “KOL lists.” `CirclesOverviewPage` and `KOLListsPage` are UI only; data is `demoCircles` and `demoCreators`.
- **Save / reuse:** **No.** Nothing is persisted; no “save list” or “load list.”
- **Invite from lists:** N/A (lists don’t exist). Org invite (affiliates/ambassadors) is separate and **works** via handle/profile_id.
- **IA/UX:** Circles and KOL Lists look like product features but are **demo-only** — **confusing** and **launch-risk** if not labeled or gated.
- **Backend:** No RLS, no APIs, no migrations for circles/KOL lists. Partner programs and org affiliates/ambassadors are implemented and working.

---

## F. Backend Audit (Summary)

- **profiles:** Used; RLS and public views; `owner_profile_id` on orgs references auth user (confirm 1:1 with profile id if applicable).
- **orgs / org_members:** Orgs have `owner_profile_id`; `create_org_and_membership` and `is_org_admin`; RLS and last-owner trigger.
- **jobs / applications / deals:** Org path: jobs → applications → deals; accept creates deal; mark-accepted sets accepted_at; **no dedicated “complete” endpoint** that sets `deals.status = 'completed'`.
- **gigs / gig_applications / gig_deals:** Profile-owned; accept creates gig_deal; complete via `POST /api/deals/[id]/complete`.
- **reviews:** Table supports both `deal_id` (org) and `gig_deal_id` (gig); trigger validates both. **POST /api/reviews** only checks gig_deals and inserts with `gig_deal_id` — org-deal reviews not exposed.
- **case_studies:** Polymorphic owner; RLS select public-only for anon; API ownership checks.
- **analytics tables:** Keyed by profile/owner; analytics APIs use current user.
- **circles / KOL lists:** No tables.
- **partner_programs / org_affiliations / org_ambassadors:** Present; RLS; invite and PATCH accept (active) implemented.

**Risks:** (1) Org deal completion and org-deal reviews not fully exposed in API. (2) Circles/KOL are UI-only. (3) `orgs.owner_profile_id` in migration `20260235000000` references `auth.users(id)` — ensure alignment with profile id (often 1:1).

---

## G. Comparison to Previous Audits

| Audit | Key recommendations | Implemented? | Still open / regressed |
|-------|----------------------|-------------|-------------------------|
| **AUDIT_PERFORMANCE.md** | Dynamic import Dashboard/Analytics; client cache for me-stats and analytics/x; lazy-load charts; Sentry/Web Vitals | Partially | No dynamic import or client cache observed; duplicate fetches and bundle still open. |
| **AUDIT_DATA_ARCHITECTURE.md** | Unified provider interface; cross-user visibility/403 for private; rate-limit contract; chart performance | Partially | X-only deep analytics; TikTok/YouTube cache empty; visibility/rate-limit UX not fully standardized. |
| **AUDIT_INFORMATION_ARCHITECTURE.md** | Single owner of deep analytics = `/analytics`; **remove or snapshot-only Profile Insights**; Dashboard no deep X | **No** | Profile Insights tab **still present** with full duplicate (social graph, top followers, refresh). Dashboard does not fetch /api/analytics/x (good) but uses **mock chart data**. |
| **AUDIT_SEO.md** | robots.ts, sitemap.ts, noindex app routes, landing OG/canonical | **Yes** | `app/robots.ts` and `app/sitemap.ts` exist; public profile noindex when unpublished; landing OG/canonical not re-checked. |
| **LAUNCH_READINESS_REPORT.md** | P0: Remove Profile Insights (or snapshot-only); noindex+robots+sitemap; design light variant; performance; cross-user visibility | Partially | SEO done; **Profile Insights not removed**; design and performance P0 not fully done. |
| **AUDIT_DESIGN_SYSTEM.md** | Light variant for Analytics, Dashboard, SharedComponents; P0 list | Partially | Profile/Insights have light variant; Dashboard, Analytics, SharedComponents still use dark tokens on light shell. |

---

## H. What Is Working

- Auth, profile creation, profile edit, public profile (real data).
- Org creation; creator as owner; org_members and is_org_admin.
- Org jobs and applications; accept → deal creation (deals table).
- Gigs and gig applications; accept → gig_deal creation; deal complete (gig); verified reviews (gig).
- Case studies (profile + org) CRUD and visibility.
- Partner programs (profile/org); org affiliates/ambassadors invite and accept.
- Watchlist (real API and DB).
- Analytics (init-status, x, backfill, ensure-backfill) for current user.
- me-stats (real); public profile and org pages with real case studies, gigs, partner programs.
- SEO: robots, sitemap, noindex for unpublished and app routes.

---

## I. What Is Partially Working

- **Org deals:** Accept and mark-accepted exist; no API that sets `deals.status = 'completed'`; org-deal reviews supported in DB but not in POST /api/reviews.
- **Dashboard:** Real myOrgs, myDeals, meStats; charts and many KPIs are hardcoded (misleading).
- **Analytics:** Real data but duplicate fetches (Profile Insights + Analytics); Profile Insights still duplicates deep analytics.
- **Design:** Light variant on Profile/Insights only; Dashboard/Analytics/SharedComponents still dark-on-light risk.

---

## J. What Is Broken or Missing

- **Circles / KOL lists:** No persistence, no API, no RLS; UI is demo-only.
- **Org deal completion:** No endpoint to set `deals.status = 'completed'` (only mark-accepted).
- **Org-deal reviews:** Cannot be created via current POST /api/reviews (only gig_deal path).

---

## K. What Is Misleading

- **Dashboard:** Charts (category, brand performance, audience, profile views, social power, X Spaces, credibility, popularity) are **hardcoded**; users may believe they are personal metrics.
- **Circles / KOL Lists:** Presented as features but are **not** saved or real.
- **PublicProfilePage / PublicStandalonePage:** Fallback to `demoPublicProfileData` / `demoProjectProfile` when `data` is missing can show fake profiles.
- **CreatorProfilePage / CreatorProfileDemo:** Explicit demo components; ensure they are not linked as “real” profile view.

---

## L. Launch-Blocking

- **Remove or clearly label all Dashboard mock chart/KPI data** — or replace with real endpoints and empty states. As-is, Dashboard is misleading.
- **Circles/KOL:** Either implement persistence and APIs or **remove from main nav / label as “Coming soon”** so users don’t expect saved lists.
- **Profile Insights:** Either remove (per IA) or reduce to snapshot + “See full analytics” link to avoid duplication and confusion.

---

## M. Post-Launch Polish

- Dynamic import and client cache (AUDIT_PERFORMANCE).
- Light variant for Dashboard, Analytics, SharedComponents (AUDIT_DESIGN_SYSTEM).
- Org deal completion API and org-deal review creation in API.
- Sentry, Web Vitals, rate-limit UX consistency.
- Multi-provider analytics (YouTube/TikTok) when prioritized.

---

## N. Recommended Next Audits

See **LINKARY_NEXT_AUDITS_RECOMMENDATION.md** for ordered list. Short list:

1. **Security / RLS audit** — policies and `owner_profile_id` vs profile id.
2. **Permissions audit** — who can do what on org vs profile vs gig vs deal.
3. **Migration integrity** — ensure prod schema and RLS match migrations.
4. **Public/private visibility audit** — profile, org, case studies, analytics.
5. **Analytics trust audit** — labels, empty states, “real vs estimated” where applicable.
6. **Onboarding audit** — first-time creator/org flows.
7. **Jobs-to-deal conversion audit** — org vs gig paths and drop-off.
8. **API consistency audit** — response shapes, errors, pagination.
9. **Performance under real data** — with real backfill and large lists.

---

## Founder Verdict

**Are we actually launch-ready?**  
**No, not as-is.** Core flows (profiles, orgs, jobs, applications, gigs, gig deals, case studies, invites) are implemented and work. But the **Dashboard shows fake charts and KPIs** as if they were the user’s data, and **Circles/KOL** are presented as real features with **no backend** — both are credibility risks. Until Dashboard mock data is removed or replaced with real/empty states and Circles are either built or clearly labeled “Coming soon,” the product can feel more complete than it is and may damage trust.

**What is the real biggest product weakness right now?**  
**Dashboard and Circles.** The Dashboard is the main “command center” but most of it is hardcoded (category pie, brand performance, X Spaces, credibility growth, popularity, etc.). Users will assume those numbers are theirs. Circles and KOL Lists look like real features (create lists, add creators) but nothing is saved — that’s the largest gap between what the UI suggests and what the product does.

**What should I fix next if I want the product to feel truly credible?**  
1. **Dashboard:** Either wire charts to real data (e.g. from me-stats and org metrics) with clear empty states, or remove the fake charts and show a simple “Your brands & deals” view with real counts and a single “See full analytics →” link to `/analytics`.  
2. **Circles/KOL:** Either ship a minimal backend (save/load lists, link to org or profile) or remove them from the main nav and show a “Coming soon” or “Beta” state so users don’t expect persistence.  
3. **Profile Insights:** Remove the full Insights tab or reduce it to a small snapshot (score + follower count + “See full analytics”) and link to `/analytics` so there’s one clear place for deep analytics.

Doing those three will make the product’s capabilities match what users see and avoid the “looks ready but isn’t” trap.

---

*End of LINKARY_TRUTH_AUDIT.md*
