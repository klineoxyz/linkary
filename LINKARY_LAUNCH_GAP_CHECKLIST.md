# Linkary Launch Gap Checklist

Checkbox list of missing or incomplete launch-critical items. Grouped by area; each item labeled **P0** / **P1** / **P2**.

---

## Product (IA / Routes / Dashboard)

- [ ] **P0** Add `"work"` to `RESERVED_PATHS` (`apps/web/src/lib/reservedPaths.ts`) to avoid username collision with `/work`
- [ ] **P0** Dashboard: Remove or replace mock chart data (categoryDistribution, brandPerformanceData, profileViewsData, socialPowerGrowth, xSpacesData, credibilityGrowth, popularityMetrics) in `DashboardPage.tsx` — or clearly label as "Demo / Coming soon"
- [ ] **P1** Document route ownership: Dashboard = command center (KPIs, deals, brands); Analytics = only deep analytics; Profile = identity snapshot
- [ ] **P1** Consider redirect from `/work` to `/work/requests` (after adding `work` to reserved paths)
- [ ] **P2** Drive Dashboard KPIs from real APIs (deals count, applications count, analytics summary) instead of placeholders

---

## Org System

- [ ] **P1** Add org cover image: `cover_file_path` or `cover_image_url` on `orgs` + upload flow + public_org_view
- [ ] **P1** Define and implement "public team" for orgs: either `org_members` with `is_public` + `display_title`, or new table `org_public_team` (org_id, name, role, avatar_url, sort_order)
- [ ] **P1** Org socials: add telegram, discord, linkedin (or document "Twitter only for launch") and expose on public org view
- [ ] **P1** Add published orgs to sitemap (`apps/web/src/app/sitemap.ts`) — query `orgs` where published and slug not null
- [ ] **P2** Org categories/tags (beyond org_type) for discovery
- [ ] **P2** Billing owner field or document that owner_profile_id is billing owner

---

## Org Team / Admin / Permissions

- [ ] **P1** Document permission model: owner vs admin vs member; who can add/remove members, update org, manage jobs/deals
- [ ] **P2** Add roles: editor, analyst, recruiter (or permission flags) and RLS + UI
- [ ] **P2** Org member invites: table `org_member_invites` (email/link, accept/revoke) and UI flow

---

## Jobs

- [ ] **P1** Add org-scoped jobs API or `listJobs({ orgId })` so OrgDetailPage doesn’t fetch all jobs and filter client-side (`apps/web/src/lib/jobs.ts`, optional `GET /api/orgs/[orgId]/jobs`)
- [ ] **P2** Job/employment types: add full_time, part_time, contract, advisory, ambassador if product needs
- [ ] **P2** Application pipeline stages: shortlisted, interview, offer, hired (schema + UI) or document "accept = hire"

---

## Gigs

- [ ] **P1** Add `draft` status to `gigs` (status: draft | open | closed | filled) and UI to create as draft / publish
- [ ] **P2** Optional `shortlisted` (or similar) on gig_applications for owner workflow
- [ ] **P2** Explicit "in progress" / "completed" / "confirmed" flow documentation and UI labels

---

## Reviews

- [ ] **P1** Review reporting: add `report_reviews` or generic `reports` table (entity_type, entity_id, reporter_id, reason) and "Report" action on review
- [ ] **P2** Review moderation: allow org/profile admin to hide or delete review (policy + API)
- [ ] **P2** Collab_reviews: document as "unverified" or add verification path

---

## Analytics

- [ ] **P1** Ensure analytics cron/worker runs and backfill completes; document required crons (x-analytics-daily, x-analytics-refresh, etc.)
- [ ] **P1** Simple diagnostics: last snapshot date, queue depth (e.g. in `/api/readiness` or `/api/ops/check`)
- [ ] **P2** YouTube/TikTok analytics (tabs already present but disabled)

---

## Data Model / Database

- [ ] **P0** Verify applications RLS in production: current policy is applications_select_private (applicant or job org admin only) — confirm no public read
- [ ] **P1** Add orgs to sitemap (see Org System)
- [ ] **P2** Audit log table for sensitive actions (profile/org/job/deal/review changes)
- [ ] **P2** Optional: application_stage or job_application_stages for pipeline

---

## Auth / Access / RLS

- [ ] **P0** Applications: confirm in production that applications_select_private is active (applicant + job org admin only; migration 20260239000000)
- [ ] **P1** Document invite/accept/revoke for org members (current "add by username" flow)
- [ ] **P2** Org member invite flow (token/link) if needed

---

## Design / UI / UX

- [ ] **P1** Audit empty states and error states for: profile edit, org settings, job apply, application accept, deal mark delivered/accepted
- [ ] **P1** Audit permission-denied states: org tabs (non-admin), deal actions (non-party)
- [ ] **P2** Mobile: key flows (apply, accept, publish profile) on small viewport
- [ ] **P2** Light/dark token consistency; avoid hardcoded colors for critical UI

---

## SEO / Public Surface

- [ ] **P0** Add published org slugs to sitemap
- [ ] **P1** robots.txt: disallow /org, /deal, /work, /market, /messages, /overview, /settings (and other app-only paths) so only landing and [username] are indexable
- [ ] **P1** Verify canonical and noindex for unpublished profile/org on public [username] page
- [ ] **P2** Structured data (JSON-LD) for profile/org if desired

---

## Performance / Ops

- [ ] **P1** Reduce OrgDetailPage payload: use org-scoped jobs list instead of listJobs() then filter
- [ ] **P1** Monitoring: alerts on analytics queue depth, backfill failures, 5xx rate
- [ ] **P2** Bundle analysis: next build + analyze; lazy-load or code-split heavy charts (e.g. Dashboard recharts)
- [ ] **P2** Structured logging (request id, key actions: application accepted, deal completed)

---

## Summary counts

- **P0:** 4 items (RESERVED_PATHS, Dashboard mock data, Verify applications RLS, Sitemap orgs)
- **P1:** 22 items
- **P2:** 18 items

Use this checklist to track completion; tick boxes as each item is implemented or explicitly deferred.
