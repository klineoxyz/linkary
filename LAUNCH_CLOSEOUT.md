# Linkary Launch Closeout

**Date:** 2026-03-08  
**Purpose:** Final release status, go/no-go, closeout checklist, and P1 backlog.

---

## 1. Release status

### Passed QA / implemented

| Item | Status |
|------|--------|
| **P0-1** Add `"work"` to RESERVED_PATHS | ✅ Code complete |
| **P0-2** Dashboard: banner + "Sample analytics (coming soon)" | ✅ In place |
| **P0-4** Published orgs in sitemap | ✅ Implemented |
| **QA 1** Org header image fallback (placeholder → X avatar by slug) | ✅ Passed |
| **QA 2** Affiliate invite: search, invite, accept, list shows username | ✅ Fixed (RLS + GET APIs + UI) |
| **QA 3** Ambassador invite: same flow | ✅ Fixed |
| **QA 4** Job modal: title, description, apply_url, tags | ✅ Implemented |
| **QA 5** Sprint modal: duration, budget, objective, links | ✅ Implemented |
| **QA 6** apply_url E2E: Apply opens external URL; modal shows "Open apply link" | ✅ Implemented |
| **Profile case studies** Owner add/remove on Featured Work + Case Studies (App.tsx) | ✅ Implemented |
| **Org case studies** Org detail tab: admin add (existing); list display | ✅ Present |
| **P0-3** Applications RLS in production | ✅ Verified in production (Step 1 complete) |

### Failed QA

- None identified in code. Full E2E run (release candidate scenarios 2.1–2.14) should be executed once before go-live; any failure there would be logged as failed QA.

### Blocker issues (all cleared at sign-off)

1. **Applications RLS (P0-3)** — Cleared: verified in production (Step 1).
2. **Critical path break** — Cleared: critical E2E pass completed with no failures (Step 2); blocker check passed (Step 3).

### Non-blocker issues

- Affiliate/ambassador search uses public profile view; users without public profile may not appear (acceptable for launch).
- Sprint `links` not rendered on public job card (stored and in API only).
- Dashboard charts remain sample data (clearly labeled).
- Org public team, org cover, extra org socials, gig draft, application stages, review reporting: deferred to P1/P2.

---

## 2. Go / No-go

| Condition | Required for Go |
|-----------|------------------|
| P0-1, P0-2, P0-4 | ✅ Done |
| P0-3 (applications RLS in prod) | ✅ Done (Step 1) |
| Critical paths (profile, org, job → apply → accept → deal → review) | ✅ Done (Step 2) |
| No open launch blockers (Section 1) | ✅ Done (Step 3) |

**Outcome:** All conditions met. **Go** signed off (Section 5).

---

## 3. Launch closeout checklist

Aligned with signed-off **Go** (Section 5).

- [x] **Migrations applied** — Production has: `20260239000000_applications_rls_and_job_admin`, `20260316000000_jobs_description_apply_url_objective_links`, `20260317000000_org_affiliations_ambassadors_insert_allow_owner`, and all prior migrations.
- [x] **Critical flows verified** — Routing (`/work`, `/work/requests`, `/dashboard`, `/analytics`); public profile (published/unpublished); public org; org create (any authenticated user); org members; job create → apply → accept → deal; deal complete → review; gig create → apply → gig_deal. (Step 2.)
- [x] **Blockers cleared** — P0-3 verified; no public read on applications; sitemap returns homepage + profiles + published orgs; reserved path `work` behaves as expected. (Steps 1, 3.)
- [x] **Deferred items listed** — Org public team, org cover/socials, gig draft, application stages, review reporting/moderation, dashboard real-KPI charts, org-scoped jobs API, robots.txt app-path disallow (see Launch Gap Checklist and Execution Plan).

---

## 4. Post-launch P1 backlog (grouped)

**UX polish**  
- Empty/error states: profile edit, org settings, job apply, application accept, deal delivered/accepted.  
- Permission-denied states: org tabs (non-admin), deal actions (non-party).  
- Mobile: key flows (apply, accept, publish) on small viewport.

**Org management**  
- Org cover image + upload; optional org socials (telegram, discord, linkedin).  
- Public team for orgs (e.g. org_public_team or org_members + is_public + display_title).  
- Document or refine invite/accept/revoke for org members.

**Jobs / gigs**  
- Org-scoped jobs list (API or listJobs filter) to avoid client-side filter on full list.  
- Gig draft status (draft | open | closed | filled) + UI.  
- Optional: application stages (shortlist/interview) or document “accept = hire”.

**Monitoring / ops**  
- Alerts: analytics queue depth, backfill failures, 5xx rate.  
- Readiness/diagnostics: last snapshot date, queue depth (e.g. `/api/readiness` or `/api/ops/check`).  
- Document required crons (x-analytics-daily, x-analytics-refresh, etc.).

**Analytics**  
- Dashboard KPIs from real APIs (deals count, applications count, summary).  
- Reduce OrgDetailPage payload (org-scoped jobs).  
- Optional: YouTube/TikTok analytics (tabs present, disabled).

---

## 5. Final sign-off sequence

Execute in this exact order before launch:

1. **P0-3 verify** — In production Supabase: confirm migration `20260239000000_applications_rls_and_job_admin` applied; no SELECT policy with `USING (true)` on `applications`; policy `applications_select_private` active; anon SELECT returns no rows (or is denied).
2. **Critical E2E run** — One full pass: public profile (published) → public org → org create (any authenticated user) → job create → apply → accept → deal → review. Log any failure.
3. **Blocker check** — No open blockers: P0-3 verified; no critical path failures from step 2; sitemap and reserved path `work` as expected.
4. **Go / No-go** — If step 3 clear: **Go**. Otherwise: fix blockers, re-verify, then **Go**. Sign below.

- [x] Step 1 (P0-3) completed.  
- [x] Step 2 (Critical E2E) completed.  
- [x] Step 3 (Blocker check) completed.  
- [x] Step 4 (Go / No-go) completed.  
- **Decision:** **Go** / **No-go** — **Go**  
- **Signed:** _______________ **Date:** 2026-03-08

---

## 6. Post-launch (first 24h + P1)

**First 24 hours — monitor:** Error rate / 5xx; auth (login/signup); public profile and org pages loading; job apply and application accept; Supabase dashboard (connections, RLS). Check sitemap.xml and `/work` once.

**Top 5 P1 next:** (1) Empty/error states (profile edit, org settings, job apply, deal flow). (2) Org-scoped jobs API or list filter (reduce OrgDetailPage payload). (3) Monitoring/readiness: alerts on 5xx, analytics queue; `/api/readiness` or ops check. (4) Dashboard KPIs from real APIs (deals count, applications count). (5) Permission-denied and mobile key flows (apply, accept, publish).

**Production risks to watch:** Applications RLS remains strict (no policy drift). Analytics backfill/crons (x-analytics-daily, refresh) — confirm they run; queue depth and failures. Unpublished profile/org not leaking into sitemap or public read.
