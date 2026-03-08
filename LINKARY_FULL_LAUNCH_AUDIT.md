# Linkary Full Launch Audit

**Product:** Reputation infrastructure platform for Web3 work.  
**Scope:** Pre-launch product + technical audit.  
**Date:** 2026-03-08.

---

## 1. Information Architecture / Routing

### 1.1 Current route model

- **Next.js app router** defines physical paths (e.g. `app/overview/page.tsx` → `/overview`, `app/(public)/[username]/page.tsx` → `/[username]`, `app/org/[orgId]/page.tsx` → `/org/[orgId]`).
- **Client-side route names** live in `apps/web/src/figma/app/App.tsx`: a single SPA shell with `route.name` (e.g. `overview`, `dashboard`, `profile`, `analytics`, `orgDetail`, `workRequests`) and URL sync via `pathFromRoute` / `routeFromPathname`.
- **Root:** `/` renders `AppWithProviders` (wraps the Figma `App`). Most “app” pages are the same shell; only `(public)/[username]` and a few others are distinct server-rendered pages.

### 1.2 Route ↔ path mapping (from App.tsx)

| Route name        | Path(s) |
|-------------------|---------|
| landing           | `/` |
| overview          | `/overview` |
| dashboard         | `/dashboard` |
| profile           | `/profile` (query: tab, username) |
| profileEdit       | `/profile/edit` |
| profileDeals      | `/profile/deals` |
| profileApplications | `/profile/applications` |
| profileInsights   | `/profile/insights` |
| userProfile       | `/[handle]` (username) |
| userInsights      | `/u/[username]/insights` |
| market            | `/market` |
| messages          | `/messages` |
| workRequests      | `/work/requests` (tab, id) |
| analytics         | `/analytics` |
| orgDetail         | `/org/[orgId]` (tab) |
| dealDetail        | `/deal/[dealId]` |
| brandProfile      | `/brand` (data.orgId) |
| terms / privacyPolicy / plans / billing / pricing | `/terms`, `/privacy-policy`, `/plans`, `/billing`, `/pricing` |
| circles, xspaces, kolLists, capitalPartners, connections, watchlist | Same-name paths |
| integrations, rolesSkills, wallet | `/settings/integrations`, `/settings/roles-skills`, `/settings/wallet` |

**Special:** `routeFromPathname` maps `/profile/dashboard` → **analytics** (not a separate “profile dashboard”). So “Dashboard” in nav is `/dashboard` (DashboardPage), and “Analytics” is `/analytics` (AnalyticsPage).

### 1.3 Page responsibility summary

| Area        | Primary route/path        | Responsibility |
|------------|----------------------------|----------------|
| Command center (work, deals, KPIs) | `/dashboard` (DashboardPage) | **Partially:** shows brands (orgs), deals; **most charts are mock data** (categoryDistribution, brandPerformanceData, profileViewsData, socialPowerGrowth, xSpacesData, credibilityGrowth, popularityMetrics). Real: listMyDeals, listOrgsForUser. |
| Deep analytics              | `/analytics` (AnalyticsPage) | **Correct.** X-only charts (follower growth, engagement, posting cadence), KPIs from `/api/analytics/x`. YouTube/TikTok tabs present but disabled. |
| Identity + credibility     | `/profile` (ProfilePage)    | **Correct.** Own profile tabs; links to “View full analytics” → `/analytics`. Profile does not duplicate full charts. |
| Identity snapshot (public) | `/[username]`               | **Correct.** Server-rendered; profile + relations, case studies, reviews, gigs, team (company). No deep analytics. |
| Org command center         | `/org/[orgId]` (OrgDetailPage) | **Correct.** Tabs: dashboard, insights, members, affiliates, ambassadors, jobs, case_studies, settings. |
| Work / collab requests     | `/work/requests` (WorkRequestsPage) | Collab requests (inbox/sent); deal creation from accepted requests. |

### 1.4 Duplication and issues

- **Dashboard vs Analytics:** Dashboard shows many **placeholder charts** (revenue, category distribution, audience, profile views, social power, X Spaces stats, credibility, popularity). Only deals and org list are real. **Recommendation:** Either drive Dashboard charts from real APIs (deals, analytics summary) or clearly label as “Coming soon” and remove/swap with real KPIs (e.g. deal count, application count).
- **Profile “Insights”** (`/profile/insights` and `InsightsSnapshot`): Snapshot only (scores, top followers, social graph). Links to full Analytics. **No duplication** with `/analytics`.
- **`/profile/dashboard`** redirects to analytics in `routeFromPathname`; path exists in map as `profileInsights` for `/profile/insights`. Slight naming confusion (dashboard vs insights) but behavior is consistent.

### 1.5 Dead / redundant routes

- **`/app`** → `app/app/page.tsx` redirects to `/`. No dead route; just redirect.
- **`/profile/dashboard`** → resolves to **analytics**; no separate profile dashboard page. Acceptable if documented.
- **Reserved path gap:** `work` is **not** in `RESERVED_PATHS` (`apps/web/src/lib/reservedPaths.ts`). So `/work` is treated as username. **Recommendation:** Add `"work"` to `RESERVED_PATHS` and, if desired, add a redirect from `/work` to `/work/requests`.

### 1.6 Recommended launch sitemap (IA)

- **Public, indexable:** `/`, `/[username]` (profile or org by slug), `/terms`, `/privacy-policy`, `/login`, `/onboarding` (if you want signup indexed).
- **App (noindex, behind auth):** `/overview`, `/dashboard`, `/profile`, `/profile/edit`, `/analytics`, `/market`, `/messages`, `/work/requests`, `/org/[orgId]`, `/deal/[id]`, settings, circles, xspaces, etc.
- **Canonical:** Public profile/org by **canonical slug** (username or org slug); redirect twitter_username → username for profiles (already done in `[username]/page.tsx`).

---

## 2. Individual Profile System

### 2.1 Implemented

- **Creation:** On signup/auth, profile row exists (auth.users → profiles). Onboarding flow (`/onboarding`), claim username, account type.
- **Editing:** `ProfileEditPage` at `/profile/edit`; saves to `profiles`, `profile_socials`, `profile_links`, `profile_skills`, `profile_achievements`, `profile_relations`, `profile_media`, `profile_professions`, case studies, gigs; CV upload via `/api/profile/cv/*`.
- **Publishing:** `profiles.published`; RLS and `public_profile_view` restrict public read to published or own row.
- **Public profile:** `app/(public)/[username]/page.tsx` — server-rendered, resolves slug/twitter/wallet; fetches `public_profile_view`, socials, reviews, case_studies, links, relations, skills, achievements, team (org_team_members for company), gigs, partner_programs, collab_reviews; canonical redirect; metadata + OG.
- **Featured work:** Case studies (and featured_case_study_id in public_layout); gigs on public page for project/company.
- **Reviews:** `reviews` (deal/gig_deal verified) + `collab_reviews`; `show_reviews` toggle; average, count, latest on public page.
- **Scores:** ethos_score, xscore, rep_score, reputation_index (computed); shown on public profile.
- **Links:** `profile_links` (is_public); **case_studies** is_public.
- **Profile types:** individual, project, company (profile_type); company uses org_team_members for public team.

### 2.2 Gaps / launch blockers

- **Profile fields:** Document in ProfileEditPage vs public page mapping is in `[username]/page.tsx` comments. Possible gaps: **discord** in socials (schema may have it; confirm display), **public_location** / **public_pricing** (meta.jsonb) — implemented.
- **Visibility:** Unpublished profiles 404 for non-owner; owner sees preview. Good.
- **Missing:** No **audit log** for profile changes (who changed what when). Optional for launch but recommended for trust.

---

## 3. Organization Profile System

### 3.1 Existence and first-class status

- **Orgs are first-class:** Table `orgs` (id, slug, name, tagline, website, twitter_username, logo_url, logo_file_path, org_type, parent_org_id, created_by, owner_profile_id, published, is_x_verified, x_account_*, is_crypto_project, has_token, token_symbol, dexscreener_url, xscore, public_layout, etc.). Public read via `public_org_view` (published, slug/name not null).

### 3.2 Creation flow

- **Who:** Only **company accounts** (`profiles.account_type = 'company'`) can create orgs (`POST /api/orgs/create` checks this).
- **How:** `create_org_and_membership` RPC (SECURITY DEFINER): creates org (unpublished, is_x_verified=false), inserts org_members (caller as owner). Slug from payload or auto from name; unique by suffix.
- **Publish gate:** `orgs.published` can be true only when `is_x_verified = true` (constraint). So org must connect X before going public.

### 3.3 Schema (orgs)

- **Slug, logo, cover, bio, website, socials, categories, verification, billing owner, visibility:** Slug ✓. Logo: logo_url + logo_file_path ✓. **Cover:** No `cover_image_url` or `cover_file_path` on orgs — **missing**. **Bio:** tagline only; no long bio — **partial**. Website, twitter_username ✓. **Socials:** Only twitter on orgs; no org-level telegram/discord/linkedin — **partial**. **Categories:** org_type (company, brand, project, agency); no tags/categories array — **partial**. **Verification:** is_x_verified, x_account_* ✓. **Billing owner:** Not explicit; owner_profile_id / org_members.owner used for access — **no dedicated billing_owner_id**. **Visibility:** published ✓.

### 3.4 Public org page

- **URL:** Orgs are reachable at `/[orgSlug]` when slug is not a profile username (resolved via `getPublicEntityByUsername` in `[username]/page.tsx`). Also linked as `orgDetail` → `/org/[orgId]` inside app.
- **Public team:** `org_members` is **internal** (who can manage org). **Public “team” for orgs:** Not a dedicated public table. For **company profiles** (profiles with profile_type=company), `org_team_members` (org_profile_id → profiles.id) shows public team on **profile** page. For **orgs table**, there is no equivalent “public team” view — only members (admin). **Gap:** If orgs should show a public team (names/roles), need either org_team_members tied to org_id or a new “org_public_team” concept.
- **Reviews, gigs, jobs, case studies, analytics:** Org **case_studies** (owner_type=org) ✓. **Jobs** belong to org ✓. **Reviews:** reviewee can be org ✓. **Gigs:** Profile-owned only; orgs don’t “own” gigs. **Analytics:** Org-level analytics (e.g. org X score) exist (xscore on orgs); no dedicated org analytics hub like profile.

### 3.5 Recommendations

- Add **org cover** (cover_file_path or cover_image_url) if design requires.
- Add **org socials** (e.g. telegram, discord, linkedin) or document “twitter only” for launch.
- Define **public team for orgs:** either reuse org_members with a “public” flag and display title, or add org_public_team (org_id, name, role, avatar_url, sort_order).
- Add **org categories/tags** (array or junction) if needed for discovery.

---

## 4. Org Team / Admin / Permissions

### 4.1 Current support

- **Ownership:** `orgs.owner_profile_id` + `org_members` with role `owner`. RLS uses owner_profile_id to avoid recursion.
- **Admins:** `org_members.role` IN ('owner','admin','member'). Admin can update org, manage members (depending on policy), manage jobs/applications/deals.
- **Members:** Listed in OrgDetailPage; can be invited (by owner/admin). **Invites:** Org affiliations and ambassadors have invited/active; org_members add is via “add member” (username + role) — no formal invite table for **org_members** (invite flow may be “add by username”).
- **Access control:** RLS on orgs (update: owner or admin), org_members (select own; insert/update/delete by owner), applications (update by org admin), deals (insert/update by org admin), case_studies (org owner/admin).

### 4.2 Public team vs internal

- **Public team:** For **company profiles**, `org_team_members` (profile_id) is public-facing. For **orgs**, no separate public team table — only org_members (internal).
- **Internal permissions:** owner, admin, member. No editor/manager/analyst/recruiter roles.

### 4.3 Recommended permission model (launch / post-launch)

| Role       | Typical use              | Select org | Update org | Members CRUD | Jobs/Apps/Deals | Case studies | Analytics |
|------------|--------------------------|------------|------------|--------------|-----------------|--------------|-----------|
| owner      | Billing, transfer, delete | ✓          | ✓          | ✓            | ✓               | ✓            | ✓         |
| admin      | Full ops                 | ✓          | ✓          | ✓ (no owner) | ✓               | ✓            | ✓         |
| editor/manager | Content, jobs          | ✓          | ✓ (limited?) | ✗          | ✓               | ✓            | ✓         |
| analyst    | View analytics           | ✓          | ✗          | ✗            | ✗               | ✗            | ✓         |
| recruiter  | Jobs + applications      | ✓          | ✗          | ✗            | ✓               | ✗            | ✗         |
| member     | View                     | ✓          | ✗          | ✗            | ✗               | ✗            | ✗         |

**Current schema:** Only owner, admin, member. **Recommendation:** Add roles `editor`, `analyst`, `recruiter` (or map to member with permission flags) and enforce in RLS and UI. If deferred, document “owner + admin only” for launch.

### 4.4 Invites and tables

- **Org member invites:** No `org_member_invites` table found. Adding members is “add by username”. For launch, optional; for scale, add invites (email/link, accept/revoke).
- **Required:** Keep `org_members`; ensure RLS covers new roles if added; add policies for “editor can update jobs” etc.

---

## 5. Gigs / Sprints

### 5.1 Current implementation

- **Gigs table:** `gigs` (owner_profile_id, title, description, gig_type, compensation_type, budget_text, location, remote, is_public, status: open|closed|filled). **Profile-owned only.**
- **Gig applications:** `gig_applications` (gig_id, applicant_profile_id, message, case_study_ids, status: submitted|accepted|rejected|withdrawn). RLS: applicant CRUD own (withdraw); owner read/update (accept/reject).
- **Gig deals:** `gig_deals` (gig_id, owner_profile_id, participant_profile_id, status: active|completed|cancelled). Created when owner accepts application. Used for verified profile-to-profile reviews.

### 5.2 Lifecycle

- **Intended lifecycle:** draft → open → applied → shortlisted → assigned → in progress → completed → confirmed → reviewed.
- **Implemented:** open / closed / filled on gig; submitted / accepted / rejected / withdrawn on application; active / completed / cancelled on gig_deal. **Missing:** No explicit “draft”, “shortlisted”, “in progress” on gig or application. “Assigned” is implied by accepted application + gig_deal. “Confirmed” and “reviewed” are not first-class (review exists separately).

### 5.3 Who can do what

- **Create gig:** Profile (owner_profile_id); in UI only project/company profiles (ProfileEditPage).
- **Apply:** Profile (applicant_profile_id). API: `POST /api/gigs/[id]/apply`.
- **Accept/Reject:** Gig owner. API: `PATCH /api/gig-applications/[id]/status`.
- **Complete/Confirm:** Gig deal status updated to completed; no separate “confirm” step. **Review:** After gig_deal completed/active, either party can leave review (reviews.gig_deal_id).

### 5.4 Recommendations

- Add **draft** status to gigs (e.g. status: draft|open|closed|filled) so creators can prepare before listing.
- Optionally add **shortlisted** to gig_applications for owner workflow.
- Add **in_progress** to gig_deals or keep “active” and use “completed” as done; document flow.
- Ensure **reviews** only after gig_deal completed (trigger already enforces active/completed for gig reviews).

---

## 6. Jobs

### 6.1 Separation from gigs

- **Jobs:** `jobs` table (org_id, type: 'job'|'sprint', title, budget, duration, tags, status: open|accepted|completed|paid). **Org-owned.**
- **Applications:** `applications` (job_id, applicant_type: profile|org, applicant_profile_id|applicant_org_id, message, status: pending|accepted|rejected|withdrawn).
- **Deals:** `deals` (profile_id, org_id, job_id, application_id, status: active|completed|disputed; delivered_at, accepted_at, completed_at). Created when org accepts an application.

**So:** Jobs = org hiring; gigs = profile-owned opportunities. Both can lead to deals (org↔profile deal vs profile↔profile gig_deal). **Separation is clear.**

### 6.2 Job model

- **Types:** job, sprint only. No full-time/part-time/contract/advisory/ambassador enum. **Recommendation:** Add job_type or employment_type (full_time, part_time, contract, advisory, ambassador) if product needs it; else keep job/sprint for launch.

### 6.3 Application pipeline

- **Stages:** pending → accepted/rejected/withdrawn. No “shortlist”, “interview”, “hire” stages in schema. **Recommendation:** Either add application_stage (shortlisted, interview, offer, hired) or document “accept = hire” for launch.

### 6.4 APIs and UI

- **List jobs:** `listJobs()` in `lib/jobs.ts` — **no org filter**; fetches all jobs then OrgDetailPage filters by org_id client-side. **Recommendation:** Add `listJobs({ orgId })` or server API `GET /api/orgs/[orgId]/jobs` for efficiency.
- **Create job:** OrgDetailPage uses `createJobClient(orgId, payload)`. RLS allows org owner/admin.
- **Apply:** `POST /api/jobs/[jobId]/apply`. Accept: `POST /api/applications/[id]/accept` (creates deal). **Implemented.**

---

## 7. Reviews / Reputation

### 7.1 Eligibility and anti-fake

- **Deal-linked:** Reviews require either `deal_id` (org deal) or `gig_deal_id` (profile gig deal). Trigger `reviews_check_deal_and_parties` enforces: deal/gig_deal exists, status completed (or active/completed for gig_deal), reviewer/reviewee are parties, no self-review. **verified_deal** set true.
- **Collab reviews:** `collab_reviews` (target_profile_id, reviewer_profile_id) — separate from deal; used on public profile alongside legacy reviews. No strict “verified collaboration” for collab_reviews; **weaker trust signal.**

### 7.2 Moderation / reporting

- **Moderation:** No review moderation (hide/delete by admin) in schema or APIs found. **Reporting:** No report_review or report_entity table. **Recommendation:** Add reporting (report_type, entity_type, entity_id, reporter_id, reason) and optional moderation (hide, delete) for launch or P1.

---

## 8. Analytics

### 8.1 Isolation

- **Single deep hub:** `/analytics` (AnalyticsPage) — X-only charts and KPIs. **Correct.**
- **Profile:** InsightsSnapshot at `/profile/insights` and `/u/[username]/insights` — snapshot/summary only; links to Analytics. **No duplication.**
- **Dashboard:** DashboardPage has many **mock** charts; not driven by same analytics API. So no “duplicate analytics” from Profile; Dashboard is the one with placeholder data.

### 8.2 Provider architecture

- **X:** social_accounts, x_daily_snapshots, x_window_aggregates, analytics_jobs; backfill via ensure-backfill; cron for refresh. **Caching:** x_insights_cache (top followers, mentions, feed); x_insights_refresh_state.
- **YouTube/TikTok:** Tables exist (youtube_profile_cache, tiktok_profile_cache); Analytics UI tabs disabled. **Launch-safe:** X only; YouTube/TikTok later.

### 8.3 Diagnostics and rollups

- **analytics_jobs** table; worker processes jobs. Readiness check in `/api/readiness` mentions queue. **Recommendation:** Ensure cron/worker runs and backfill completes; add simple diagnostics endpoint (e.g. last snapshot date, job queue depth) for ops.

---

## 9. Data Model / Database

### 9.1 Coverage

| Entity            | Table(s) | Notes |
|-------------------|----------|--------|
| Users             | auth.users, profiles | ✓ |
| Profiles          | profiles, profile_socials, profile_links, profile_skills, profile_achievements, profile_relations, profile_media, profile_documents, profile_professions, usernames, profile_slug_history | ✓ |
| Orgs              | orgs, org_metrics, org_members | ✓ |
| Org team (public) | org_team_members (for company **profiles** only) | Partial for orgs |
| Jobs              | jobs | ✓ |
| Job applications  | applications | ✓ |
| Gigs              | gigs | ✓ |
| Gig applications  | gig_applications | ✓ |
| Deals             | deals, gig_deals | ✓ |
| Reviews           | reviews, collab_reviews | ✓ |
| Case studies      | case_studies (owner profile/org, is_public) | ✓ |
| Analytics         | analytics_snapshots, x_daily_snapshots, x_window_aggregates, social_accounts, analytics_jobs, x_insights_* | ✓ |
| Org relationships| org_relationships, org_affiliations, org_ambassadors, org_follows, org_supporters, org_influence_rollups | ✓ |
| Collab requests   | collab_requests | ✓ |
| Audit logs        | notification_log, rate_limits | No full entity audit log |

### 9.2 Missing or weak

- **Org public team:** For orgs table, no table for “display team” (only org_members for access).
- **Application stages:** No shortlist/interview/hire on applications.
- **Gig draft:** No draft status.
- **Audit log:** No generic audit_log (table, row, action, by_user, at).
- **Jobs list by org:** listJobs() fetches all; add org filter or API.

---

## 10. Auth / Access / RLS

### 10.1 User auth

- Supabase Auth; session used in App and API routes. Callback, safe redirect, post-login bootstrap (ensure-backfill, ensure-social-x). **Good.**

### 10.2 Org auth and permission checks

- **Org membership:** RLS uses org_members and orgs.owner_profile_id. APIs (e.g. org create, org update, applications accept) check session and sometimes re-check org role (e.g. isOrgAdmin). **Good.**

### 10.3 Visibility rules

- **Profiles:** public_profile_view for published or own. **Orgs:** public_org_view for published. **Case studies:** is_public for anon. **Gigs:** is_public and status=open for public select. **Reviews:** SELECT public. **Good.**

### 10.4 Invite / accept / revoke

- **Org members:** Add by username; no invite token flow. **Affiliates/ambassadors:** invited/active/removed. **Recommendation:** Document; add invite flow post-launch if needed.

### 10.5 Risks

- **Applications SELECT:** Policy was “applications_select_public” (true) in MVP — **anyone can read all applications.** For launch, consider restricting to applicant, job owner org members, or both. **No change needed** (see migration 20260239000000).
- **Rate limits:** ensure-backfill and org create are rate-limited. **Good.**

---

## 11. UI / UX / Design System

### 11.1 Consistency

- Shared components (SharedComponents, GlassCard, StatCard, etc.); Figma-derived pages. Dashboard, Analytics, Profile, Org, Market, Work Requests share the same shell and sidebar. **Generally consistent.**

### 11.2 Tokens and states

- **Light/dark:** Theme tokens used; confirm one source of truth (e.g. CSS variables) and no hardcoded #hex for critical UI.
- **Empty states:** Present in lists (e.g. no jobs, no applications). Verify all critical lists have empty + error state.
- **Error states:** ClientErrorBoundary; API errors surfaced in places (e.g. analytics init failed banner). Ensure forms show inline errors.
- **Rate-limit states:** Analytics banner shows rate limit reset time. **Good.**
- **Permission states:** OrgDetailPage hides/shows sections by admin. Ensure “you don’t have permission” message where needed.

### 11.3 Mobile and CTA

- Sidebar collapses to mobile menu. **Recommendation:** Audit key flows (apply to job, accept application, publish profile) on mobile.
- **CTA hierarchy:** Primary actions (e.g. Apply, Accept) should be clearly primary; secondary (Cancel, Withdraw) secondary.

### 11.4 Launch blockers

- **Dashboard mock data:** Replace or clearly label placeholder charts so users are not misled.
- **Missing “work” in RESERVED_PATHS:** Add to avoid username “work” conflicting with future /work.

---

## 12. SEO / Public Surface

### 12.1 Public vs internal

- **Public/indexable:** `/`, `/[username]` (profile or org), `/terms`, `/privacy-policy`. Sitemap includes homepage + **profiles only** (published, username not null). **Orgs:** Not in sitemap; orgs are reachable at `/[orgSlug]` when slug doesn’t match a profile — **add org slugs to sitemap** for discovery.
- **Noindex:** robots disallow /profile, /dashboard, /analytics, /u, /api, /auth, /login. **Recommendation:** Also disallow /org, /deal, /work, /market, /messages, and other app paths.

### 12.2 Metadata and canonical

- **Public profile/org:** generateMetadata in `(public)/[username]/page.tsx` — title, description, canonical, OG, Twitter card, robots (noindex if unpublished). **Good.**
- **Canonical:** Redirect twitter_username → username for profiles. **Good.**

### 12.3 Sitemap and robots

- **sitemap.ts:** Homepage + profiles (limit 5000). **Missing:** Orgs (published, slug not null).
- **robots.ts:** Sitemap URL and disallow list. Add /org, /deal, /work, /market, /messages, /overview, /settings, etc., if you want only landing and [username] indexed.

---

## 13. Performance / Monitoring / Ops

### 13.1 Bundle and loading

- **Bundle:** No audit run; recommend `next build` and analyze bundle for large deps (e.g. recharts on Dashboard).
- **Charts:** Recharts on Dashboard and Analytics; lazy-load or code-split if needed.
- **Duplicate fetches:** OrgDetailPage fetches listJobs() then filters client-side; reduce payload with org-scoped jobs API.
- **Lazy loading:** Confirm heavy components (e.g. Analytics charts) are not blocking first paint.

### 13.2 Caching

- **ISR:** Public profile revalidate 300s. **Good.**
- **Analytics:** Caching in x_insights_* and snapshot tables. **Good.**

### 13.3 Logging and monitoring

- **Structured logging:** Not consistently present; add request id and key actions (e.g. application accepted, deal completed) for debugging.
- **Monitoring/alerts:** readiness endpoint exists; add alerts on queue depth, backfill failures, error rate.

### 13.4 Cron / background

- **Crons:** x-analytics-daily, x-analytics-refresh, sync-org-influence-daily, sync-x-tweets-weekly, etc. **Document** which are required for launch and ensure they run (e.g. Railway/Vercel cron or worker).

---

## 14. Launch Readiness Summary

### 14.1 Done

- Profile create/edit/publish, public profile page, featured work, reviews, scores, links, case studies, relations, team (company), gigs.
- Org create (company only), publish gate (X verified), org detail page with tabs (members, jobs, applications, deals, case studies, settings).
- Jobs and applications (org); gigs and gig applications (profile); deals and gig_deals; review triggers (deal/gig_deal verified).
- Analytics isolated to /analytics; X provider, backfill, caching; Profile insights as snapshot only.
- Auth, RLS for profiles/orgs/members/jobs/applications/deals/reviews/case_studies/gigs.
- Public SEO: metadata, canonical, OG, sitemap (profiles), robots.
- Work requests (collab), deal creation from accepted applications.

### 14.2 Partially done

- **Dashboard:** Real deals and orgs; most charts mock. Replace or label.
- **Org:** No cover image; no public team for orgs; no org socials beyond Twitter; no extra roles (editor/analyst/recruiter).
- **Jobs:** No application stages (shortlist/interview); listJobs not org-scoped.
- **Gigs:** No draft status; lifecycle not fully staged.
- **Sitemap:** Orgs missing; robots could disallow more app paths.
- **Applications RLS:** Confirm SELECT policy (currently may be public).

### 14.3 Missing

- Org cover; org public team; org socials (beyond Twitter).
- Dashboard real KPIs or “coming soon” for charts.
- Application stages (optional); gig draft.
- Review reporting/moderation.
- Full audit log for sensitive changes.
- “work” in RESERVED_PATHS.

### 14.4 P0 (blockers before launch)

1. **Dashboard:** Remove or replace mock chart data so users are not misled (or clearly label “Demo”).
2. **Applications SELECT:** Already restricted (applications_select_private in migration 20260239000000). **Verify in production; no code change required.**
3. **Sitemap:** Include published orgs (slug) for discovery.
4. **RESERVED_PATHS:** Add `"work"` to avoid username collision.

### 14.5 P1 (soon after launch)

- Org cover and public team; org socials.
- listJobs by org (API or param); optional application stages.
- Gig draft; optional shortlisted state.
- Review reporting (and optional moderation).
- Robots: disallow /org, /deal, /work, /market, /messages, etc.
- Monitoring: queue depth, backfill health.

### 14.6 P2 (longer term)

- Editor/analyst/recruiter roles; org_member_invites.
- Full audit log; YouTube/TikTok analytics.
- Dashboard fully driven by real APIs.

### 14.7 Recommended implementation order

1. P0: RESERVED_PATHS + work → Dashboard mock data → Sitemap orgs. (Applications RLS already correct.)
2. P1: Org (cover, public team, socials) → Jobs API org filter → Gig draft → Review reporting → Robots + monitoring.
3. P2: Roles, invites, audit log, multi-platform analytics.

### 14.8 Rough effort (by area)

| Area              | Effort (rough) |
|-------------------|----------------|
| Dashboard (real or label) | 1–2 d |
| Applications RLS | 0.5 d |
| Sitemap + robots + reserved | 0.5 d |
| Org cover + public team + socials | 2–3 d |
| Jobs org filter   | 0.5 d |
| Gig draft         | 0.5 d |
| Review reporting  | 1–2 d |
| Monitoring        | 1 d |

---

*End of audit.*
