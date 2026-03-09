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

### Pending / manual only

| Item | Status |
|------|--------|
| **P0-3** Applications RLS in production | ⬜ **Manual verification required** (Supabase: confirm no public SELECT; policy `applications_select_private` active; migration `20260239000000` applied). |

### Failed QA

- None identified in code. Full E2E run (release candidate scenarios 2.1–2.14) should be executed once before go-live; any failure there would be logged as failed QA.

### Blocker issues

1. **Applications RLS (P0-3)** — If production has not verified that applications are not publicly readable, **do not launch** until verified or fixed.
2. **Critical path break** — If any of: public profile 404 for published, deal creation on accept, review eligibility, sitemap wrong/missing, or reserved path `work` broken is found in final E2E, treat as blocker until fixed.

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
| P0-3 (applications RLS in prod) | ⬜ Must be verified |
| Critical paths (profile, org, job → apply → accept → deal → review) | ⬜ Run once before launch |
| No open launch blockers (Section 1) | ⬜ Confirm |

**Recommendation:**  
- **Go** if P0-3 is verified in production and the critical E2E pass (see Section 3 and final sign-off sequence) shows no blockers.  
- **No-go** if applications RLS is not verified or any critical path is broken.

---

## 3. Launch closeout checklist

- [ ] **Migrations applied** — Production has: `20260239000000_applications_rls_and_job_admin`, `20260316000000_jobs_description_apply_url_objective_links`, `20260317000000_org_affiliations_ambassadors_insert_allow_owner`, and all prior migrations.
- [ ] **Critical flows verified** — Routing (`/work`, `/work/requests`, `/dashboard`, `/analytics`); public profile (published/unpublished); public org; org create (any authenticated user); org members; job create → apply → accept → deal; deal complete → review; gig create → apply → gig_deal.
- [ ] **Blockers cleared** — P0-3 verified; no public read on applications; sitemap returns homepage + profiles + published orgs; reserved path `work` behaves as expected.
- [ ] **Deferred items listed** — Org public team, org cover/socials, gig draft, application stages, review reporting/moderation, dashboard real-KPI charts, org-scoped jobs API, robots.txt app-path disallow (see Launch Gap Checklist and Execution Plan).

**Critical E2E pass (required before Go):** public profile → public org → org create → job create → apply → accept → deal → review.

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
- [ ] Step 2 (Critical E2E) completed.  
- [ ] Step 3 (Blocker check) completed.  
- **Decision:** **Go** / **No-go** — _______________  
- **Signed:** _______________ **Date:** _______________
