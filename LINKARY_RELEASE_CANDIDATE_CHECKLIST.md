# Linkary Release Candidate Checklist

Final pre-launch QA and release checklist. Use after P0 work is complete.

---

## 1. P0 completion confirmation

| # | P0 item | Code complete | Notes |
|---|---------|---------------|--------|
| 1 | Add `"work"` to RESERVED_PATHS | ✅ | `apps/web/src/lib/reservedPaths.ts` |
| 2 | Dashboard: banner + "Sample analytics (coming soon)" | ✅ | `DashboardPage.tsx` |
| 3 | Verify applications RLS in production | ⬜ | **Manual only** — see below |
| 4 | Add published orgs to sitemap | ✅ | `apps/web/src/app/sitemap.ts` |

**Manual production verification (P0-3):**

- [ ] In Supabase production: migration `20260239000000_applications_rls_and_job_admin.sql` is applied.
- [ ] Table `public.applications`: no SELECT policy with `USING (true)` (no public read).
- [ ] Policy `applications_select_private` exists and restricts SELECT to applicant or job org admin.
- [ ] Optional: as anon, `SELECT * FROM public.applications` returns 0 rows (or is denied).

---

## 2. End-to-end QA scenarios

### 2.1 Routing and reserved path behavior

1. Open app; go to `/work/requests` — page loads (work requests inbox/sent).
2. Go to `/work` (no trailing path) — does **not** resolve to a user profile; either app shell, redirect, or 404.
3. Go to `/dashboard` — Dashboard with banner and sample analytics section.
4. Go to `/analytics` — Analytics (X charts).
5. Go to `/profile` — Own profile (when logged in).
6. Go to `/overview` — Overview home.

### 2.2 Public profiles

1. Log out or use incognito; open `/{username}` for a **published** profile (known username).
2. Page loads with profile info, bio, links, case studies, reviews (if enabled), gigs (if project/company).
3. No deep analytics; optional link to “full analytics” or similar.
4. Open `/{username}` for an **unpublished** profile (not owner) — 404 or “not found” style page.
5. As owner, open own unpublished profile — preview or same URL with “unpublished” notice.

### 2.3 Public org pages

1. Open `/{orgSlug}` for a **published** org (slug not a profile username).
2. Page loads with org name, tagline, logo, jobs/case studies as per public org view.
3. Open `/org/{orgId}` when logged in — org detail (tabs: dashboard, members, jobs, etc.).

### 2.4 Org creation

1. Log in as a user whose profile has **account_type = company**.
2. From Dashboard or org flow, trigger “Create Org”.
3. Submit with required: name, org_type (company/brand/project/agency); optional slug, tagline, website, Twitter.
4. Org is created; user is owner; org is **unpublished** until X is connected and verified.
5. Log in as **non-company** account — Create Org is unavailable or returns 403.

### 2.5 Org member / admin management

1. As org **owner**, open org detail → Members (or equivalent).
2. Add a member by username (or user id) with role **admin** — row appears; user can manage org (no transfer/delete).
3. Add a member with role **member** — row appears; user can see org but not manage.
4. As **admin**, add/remove members (except owner); cannot transfer ownership or delete org.
5. As **member**, open org — can see org and own membership; no add/remove or settings.

### 2.6 Job creation

1. As org owner or admin, open org detail → Jobs (or equivalent).
2. Create a job: type **job** or **sprint**, title, optional budget, duration, tags.
3. Job appears in list with status **open**.
4. Job is visible on public org page / marketplace as applicable.

### 2.7 Job application

1. As a **profile** user (or org with permission), open job listing and apply.
2. Submit application (message optional).
3. Application appears in “My applications” or equivalent; org sees it in job applications list.
4. Applicant can **withdraw**; status becomes withdrawn.

### 2.8 Application acceptance

1. As org owner/admin, open job applications; choose **Accept** for one application.
2. A **deal** is created (profile_id, org_id, job_id, application_id, status active).
3. Applicant and org can see the deal (e.g. deal detail page).

### 2.9 Deal flow

1. Open deal detail as **profile** (creator); use “Mark delivered” (or equivalent).
2. Open deal detail as **org**; use “Mark accepted” (or equivalent).
3. When both are done, deal status becomes **completed** (and completed_at set if applicable).
4. Either party can leave a **review** once deal is completed.

### 2.10 Review eligibility

1. As profile or org party to a **completed** deal, submit a review (rating, optional text).
2. Review is saved with **verified_deal** true; appears on reviewee’s public profile (if show_reviews).
3. Attempt to review **before** deal is completed — rejected (validation/trigger).
4. Attempt **self-review** or wrong party — rejected.

### 2.11 Gig creation

1. Log in as **project** or **company** profile; open profile edit (or gigs section).
2. Create a gig: title, description, gig_type, compensation_type, optional budget_text, etc.
3. Gig is **open** and **public** (if is_public); appears on public profile.

### 2.12 Gig application and gig_deal flow

1. As a profile user, open a public gig and apply (message, optional case studies).
2. Gig owner sees application; **accepts** one.
3. A **gig_deal** is created (owner_profile_id, participant_profile_id, status active).
4. Either party can complete; then either can leave a **profile-to-profile** review (gig_deal_id).

### 2.13 Dashboard trust labeling

1. Open **Dashboard** (logged in).
2. A **banner** at or near the top states that chart metrics are sample/preview and real deals/brands are in the cards.
3. A **section heading** (e.g. “Sample analytics (coming soon)”) appears above the chart blocks.
4. **My Orgs** and **Active Deals** (and any other real-data cards) are present and unchanged.

### 2.14 Sitemap validation

1. Open production `/sitemap.xml`.
2. **Homepage** URL is present.
3. **Profile** URLs: one entry per published profile with non-null username (up to limit).
4. **Org** URLs: one entry per published org with non-null slug (up to limit).
5. Unpublished profiles/orgs do **not** appear.

---

## 3. Expected results

| Scenario | Expected result |
|----------|------------------|
| **Routing / reserved** | `/work/requests` loads; `/work` does not show a user profile; dashboard and analytics load. |
| **Public profile (published)** | Full one-pager with profile data, links, case studies, reviews (if on), gigs (if applicable). No full analytics. |
| **Public profile (unpublished)** | Non-owner: 404/not found. Owner: preview with “unpublished” indication. |
| **Public org** | Org page at `/{slug}` or org detail at `/org/{id}` shows org info and public content. |
| **Org creation** | Company account can create; non-company gets 403 or no access. New org unpublished until X verified. |
| **Org members** | Owner/admin can add admin and member; member has no management; admin cannot transfer/delete. |
| **Job creation** | Owner/admin can create job/sprint; job appears open and where designed (org page/market). |
| **Job application** | Profile (or allowed org) can apply; application visible to applicant and org; applicant can withdraw. |
| **Application accept** | Accept creates one deal; both parties can see deal. |
| **Deal flow** | Creator can mark delivered; org can mark accepted; when both done, deal completed; then reviews allowed. |
| **Review eligibility** | Only after completed deal; parties only; no self-review; verified_deal true. |
| **Gig creation** | Project/company profile can create open public gig; appears on public profile. |
| **Gig apply / gig_deal** | Apply → owner accepts → gig_deal created; completion and profile-to-profile review possible. |
| **Dashboard labeling** | Banner and “Sample analytics (coming soon)” visible; real cards (orgs, deals) present. |
| **Sitemap** | Homepage + published profiles + published orgs; no unpublished entities. |

---

## 4. Launch blockers

- **Applications RLS** — If applications are publicly readable in production, do not launch until fixed and re-verified.
- **Public profile 404 for published** — If a published profile with valid username returns 404 for non-owner, fix before launch.
- **Deal creation broken** — If accepting an application does not create a deal (or deal is not visible to both parties), fix before launch.
- **Review trigger bypass** — If reviews can be submitted without a completed deal/gig_deal or by non-parties, fix before launch.
- **Sitemap missing or wrong** — If sitemap is missing, errors, or exposes unpublished profiles/orgs, fix before launch.
- **Reserved path `work`** — If `work` is not reserved and a profile can claim it, fix before launch.

---

## 5. Can launch even if imperfect

- Dashboard charts still use sample data (as long as banner and “Sample analytics” section are present).
- Org public team not implemented (members internal only).
- No org cover image or extra org socials.
- No review reporting or moderation.
- No gig draft status.
- No application stages (shortlist/interview); accept = hire.
- No org-scoped jobs API optimization (client-side filter acceptable).
- `/work` does not redirect to `/work/requests` (optional).
- robots.txt does not yet disallow all app paths (can be post-launch).
- Minor UI/empty states or copy tweaks that don’t affect security or core flows.

---

## 6. Final go / no-go gate

**Founder review before release:**

- [ ] P0-1 through P0-4: code complete; P0-3 (applications RLS) verified in production.
- [ ] Critical paths tested: public profile, public org, org create, job create → apply → accept → deal → review, gig create → apply → accept → gig_deal.
- [ ] No launch blocker (Section 4) is open.
- [ ] Sitemap and reserved path behavior confirmed.
- [ ] Decision: **Go** = ship; **No-go** = fix blockers and re-run this checklist.

**Signed off:** _________________ **Date:** _________
