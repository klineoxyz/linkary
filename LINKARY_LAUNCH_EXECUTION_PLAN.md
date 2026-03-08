# Linkary Launch Execution Plan

Concrete build plan derived from the launch audit. Optimized for speed, trust, and shipping.

---

## 1. Launch Decision Lock

Final product decisions for launch. Lock these; do not reopen during P0 execution.

| Decision | Launch choice |
|----------|----------------|
| **Org creation model** | Only **company accounts** (`profiles.account_type = 'company'`) can create orgs. One org per creation; caller becomes owner. Creation via `POST /api/orgs/create` → RPC `create_org_and_membership`. Org is **unpublished** until X is connected and verified (`is_x_verified = true`). |
| **Org roles at launch** | **Three roles only:** owner, admin, member. No editor / analyst / recruiter. Owner = full control + transfer/delete. Admin = full ops (members, jobs, deals, settings) except transfer/delete. Member = can see org and membership; no management. |
| **Public team vs internal admins** | **At launch:** Org **members** (org_members) are **internal only** — who can manage the org. We do **not** ship a public “team” section on org pages for launch. Company **profiles** (profile_type=company) keep using `org_team_members` for public team on profile page; orgs (table) do not show a public team. Defer org public team to P1. |
| **Jobs vs gigs ownership** | **Jobs** = org-owned (`jobs.org_id`). **Gigs** = profile-owned (`gigs.owner_profile_id`). No overlap: orgs post jobs/sprints; profiles (project/company) post gigs. |
| **Sprint vs job distinction** | **Job** and **sprint** are two **org job types** in the same `jobs` table (`type IN ('job','sprint')`). Same application and deal flow. In UI: “Job” = longer-term; “Sprint” = short-term. No schema change. |
| **Review eligibility** | Reviews require a **verified context:** either (1) **org deal** (`reviews.deal_id`, deal must be `status = 'completed'`) or (2) **gig deal** (`reviews.gig_deal_id`, status active or completed). Trigger enforces parties and no self-review. **Collab reviews** stay as unverified; shown on profile but distinguishable. No review reporting/moderation at launch. |
| **Intentionally deferred until after launch** | Org cover image; org public team; org socials (beyond Twitter); editor/analyst/recruiter roles; org member invites (email/link); application stages (shortlist/interview); gig draft status; review reporting/moderation; audit log; YouTube/TikTok analytics; dashboard charts driven by real APIs; org-scoped jobs API (listJobs filter); structured data (JSON-LD); org categories/tags. |

---

## 2. P0 Shipping Tasks

### P0-1: Add `"work"` to RESERVED_PATHS

| Field | Detail |
|-------|--------|
| **Goal** | Reserve the path `work` so `/work` is not claimed as a username and routing stays correct for `/work/requests`. |
| **Why it matters** | Without this, a user could claim username `work` and break expectation that `/work` is app-owned. |
| **Exact files to change** | `apps/web/src/lib/reservedPaths.ts` |
| **Implementation** | Add `"work"` to the `RESERVED_PATHS` Set (e.g. after `"watchlist"`, before the static assets comment). No other code change required; `routeFromPathname` in App.tsx already handles `work/requests` explicitly. |
| **Acceptance criteria** | (1) `isReservedPath("work")` is true. (2) Visiting `/work` (with no second segment) is handled by `[username]` page and treated as reserved (e.g. AppWithProviders or 404), not as a profile. (3) `/work/requests` still works. |
| **Risks** | Low. Optional follow-up: add redirect from `/work` to `/work/requests` in Next.js (e.g. `app/work/page.tsx` that redirects). Not required for P0. |

---

### P0-2: Fix / remove / label Dashboard mock data

| Field | Detail |
|-------|--------|
| **Goal** | Ensure Dashboard does not present mock chart data as real. Either remove mock charts or label them clearly as demo/coming soon. |
| **Why it matters** | Users must not believe placeholder metrics (revenue, engagement, etc.) are their real data. Trust and compliance. |
| **Exact files to change** | `apps/web/src/figma/app/components/DashboardPage.tsx` |
| **Implementation** | **Recommended (fastest):** Add a single **banner** at the top of the Dashboard content (below any global nav): e.g. “Sample metrics below are for preview only. Your real deals and brands are shown in the cards.” Then wrap the **chart sections** that use mock data in a single container with a subheading like “Sample analytics (coming soon)”. Keep using: `emptyStats` / `listMyDeals` / `listOrgsForUser` (real). Mock constants to keep but clearly scoped under the “Sample” section: `categoryDistribution`, `brandPerformanceData`, `brandAudienceData`, `profileViewsData`, `socialPowerGrowth`, `xSpacesData`, `xSpacesStats`, `credibilityGrowth`, `popularityMetrics`. **Alternative (more work):** Remove all chart sections that use the above constants and show only real data (deals, orgs/brands). |
| **Acceptance criteria** | (1) No chart or number is presented as the user’s real data without a clear “sample” or “coming soon” label. (2) Real deals and real orgs/brands remain visible and unchanged. (3) No new errors in build or runtime. |
| **Risks** | Low. If you remove charts entirely, ensure layout still looks intentional (empty state or short copy). |

---

### P0-3: Verify applications RLS in production

| Field | Detail |
|-------|--------|
| **Goal** | Confirm that in the deployed environment, **applications** (job applications) are not readable by the public — only by the applicant and by org admins for that job. |
| **Why it matters** | Prevents leakage of application data (messages, who applied) to unauthenticated or unrelated users. |
| **Exact files to change** | None for code. Use Supabase Dashboard or SQL in production. |
| **Implementation** | (1) In Supabase → Authentication → Policies (or SQL), open `public.applications`. (2) Confirm there is **no** policy with `USING (true)` for SELECT. (3) Confirm policy **applications_select_private** exists and allows SELECT only when: applicant is profile and `applicant_profile_id = auth.uid()`, or applicant is org and caller is admin of that org, or caller is org admin of the job’s org (via `is_job_org_admin(job_id, auth.uid())`). Migration `20260239000000_applications_rls_and_job_admin.sql` already defines this; ensure it is applied in production. (4) Optional: run a quick test as anon and as a random user to SELECT from applications — should get no rows unless they are applicant or job org admin. |
| **Acceptance criteria** | (1) No public SELECT on applications. (2) Applicant can see own applications; org owner/admin for the job’s org can see applications for that job. (3) Migration 20260239000000 is present in production migration history. |
| **Risks** | If the migration was not applied, applications may still be public. Fix by running the migration or applying the same policies manually. |

---

### P0-4: Add published orgs to sitemap

| Field | Detail |
|-------|--------|
| **Goal** | Include all **published** orgs (with non-null slug) in the sitemap so search engines can discover org pages at `/{orgSlug}`. |
| **Why it matters** | Org pages are public and indexable; without sitemap entries they are discovered only by crawl or links. |
| **Exact files to change** | `apps/web/src/app/sitemap.ts` |
| **Implementation** | After the existing block that adds profile URLs (and before `return entries`): (1) Query `orgs` with service client: `.from("orgs").select("slug, updated_at").eq("published", true).not("slug", "is", null).order("slug").limit(BATCH_SIZE)` (or reuse BATCH_SIZE). (2) For each row, `slug = (row.slug || "").trim().toLowerCase()`. If empty, skip. (3) Push `{ url: \`${BASE_URL}/${encodeURIComponent(slug)}\`, lastModified: row.updated_at ? new Date(row.updated_at) : new Date(), changeFrequency: "weekly", priority: 0.8 }`. (4) Keep the same try/catch pattern; if org query fails, sitemap still returns homepage + profiles. |
| **Acceptance criteria** | (1) Visiting `/sitemap.xml` shows homepage, profile URLs, and one URL per published org slug. (2) Org URLs use the same BASE_URL and format as profile URLs. (3) Unpublished orgs or null slug do not appear. |
| **Risks** | Service role must have SELECT on `orgs`. If `orgs` has no `updated_at`, use `created_at` or `new Date()`. |

---

## 3. Org System Final Spec for Launch

- **Who can create an org**  
  Only a user whose profile has `account_type = 'company'`. Enforced in `POST /api/orgs/create`.

- **How an org is created**  
  Client calls `POST /api/orgs/create` with body: `{ name, org_type, slug?, tagline?, website?, twitter_username?, logo_url?, parent_org_id? }`. Backend calls Supabase RPC `create_org_and_membership(payload)`. RPC creates one row in `orgs` (unpublished, `is_x_verified = false`) and one row in `org_members` (caller as `owner`). Slug is from payload or derived from name; uniqueness by suffix.

- **Required fields**  
  `name` (non-empty), `org_type` (one of: company, brand, project, agency). All others optional.

- **Who becomes owner**  
  The authenticated user who calls create is the only owner (orgs.owner_profile_id and org_members.role = 'owner').

- **How admins are added**  
  Owner (or existing admin) adds a member with role `admin` via org member management in the app (Supabase client: insert into `org_members` with role `admin`). RLS allows only owner to insert (per migration 20260235000000: insert by owner). No invite table at launch; “add by username” (or by user id) only.

- **How members are added**  
  Same as admins: owner/admin adds a row to `org_members` with role `member`. No email/link invite at launch.

- **Members public or internal**  
  **Internal only.** org_members is for access control. No public “team” list for orgs at launch.

- **Public team at launch**  
  **None for orgs.** Company **profiles** (profile_type = company) continue to use `org_team_members` for the public team block on the profile page. Orgs (table) do not expose a public team section until P1.

- **Permissions**  
  - **Owner:** Full: update org, publish, add/remove/update members (including other admins), manage jobs, applications, deals, case studies, settings. Can transfer ownership (if implemented) and delete org.  
  - **Admin:** Same as owner except cannot transfer ownership or delete org (and cannot remove owner).  
  - **Member:** Can see the org and their own membership; cannot manage anything.

- **Deferred**  
  Org cover image; org public team; org socials beyond Twitter; editor/analyst/recruiter; org member invites (email/link); billing_owner_id.

---

## 4. Jobs, Gigs, and Sprints Final Spec

- **What an org can post**  
  **Jobs** only. Each job has `org_id`, `type` in (`job`, `sprint`), title, budget, duration, tags, status (e.g. open, accepted, completed, paid). Created by org owner/admin via Supabase (RLS) or via UI that uses createJobClient/listJobs.

- **What a user profile can post**  
  **Gigs** only (for project/company profiles). Gigs have `owner_profile_id`, title, description, gig_type, compensation_type, budget_text, location, remote, is_public, status (open, closed, filled). Created in ProfileEditPage; no draft at launch.

- **Difference between jobs, sprints, and gigs**  
  - **Job:** Org posting; type = `job`; typically longer-term.  
  - **Sprint:** Org posting; type = `sprint`; same table and flow as job; typically short-term.  
  - **Gig:** Profile posting; different table (`gigs`); profile-to-profile opportunity; no org_id.

- **Application lifecycle**  
  - **Jobs:** User (or org as applicant) submits row to `applications` (job_id, applicant_type, applicant_profile_id or applicant_org_id, message, status = pending). Org owner/admin can accept (→ create deal) or reject; applicant can withdraw (status = withdrawn). No shortlist/interview stages at launch.  
  - **Gigs:** Applicant submits row to `gig_applications` (gig_id, applicant_profile_id, message, case_study_ids, status = submitted). Gig owner can accept or reject. Accept → create row in `gig_deals`. Applicant can withdraw.

- **Acceptance flow**  
  - **Job:** `POST /api/applications/[id]/accept` creates a **deal** (profile_id, org_id, job_id, application_id, status = active).  
  - **Gig:** `PATCH /api/gig-applications/[id]/status` with status `accepted`; backend creates **gig_deal** (gig_id, owner_profile_id, participant_profile_id, status = active).

- **Deal creation flow**  
  - **Org deal:** Deal row created on application accept. Creator marks “delivered”; org marks “accepted” → trigger can set completed_at and status = completed.  
  - **Gig deal:** Gig_deal created when gig owner accepts application. Either party can complete; status active → completed.

- **Review flow**  
  - After **deal** is completed: org or profile (the two parties) can insert into `reviews` with deal_id, reviewer/reviewee as the two parties; trigger sets verified_deal.  
  - After **gig_deal** is active/completed: either profile can leave a review with gig_deal_id; trigger validates parties and sets verified_deal.  
  - One review per deal/gig_deal per reviewer (unique constraint). No reporting or moderation at launch.

- **Case study flow**  
  - **Profile:** Case study with owner_type = profile, owner_profile_id; is_public; shown on public profile.  
  - **Org:** Case study with owner_type = org, owner_org_id; is_public; manageable from org detail. No change to case study flow for launch.

---

## 5. Launch Checklist by Day

**Day 1 — Routing and trust**

- Add `"work"` to RESERVED_PATHS (`apps/web/src/lib/reservedPaths.ts`).
- Verify applications RLS in production (Supabase policies / migration history).
- Deploy and smoke-test: `/work/requests` works; `/work` does not resolve to a profile.

**Day 2 — Dashboard**

- Add Dashboard “sample data” banner and label chart section as sample/coming soon in `DashboardPage.tsx`.
- Deploy; confirm real deals and brands still show and no mock data is presented as real.

**Day 3 — SEO**

- Add published orgs to sitemap in `apps/web/src/app/sitemap.ts`.
- Deploy; fetch `/sitemap.xml` and confirm org URLs appear.

**Day 4 — Integration and regression**

- Full pass: create org (company account), add admin/member, post job, apply, accept, create deal, mark delivered/accepted, leave review.
- Confirm public profile and public org pages (by slug) render and sitemap includes them.

**Day 5 — Lock and release**

- Final check: P0 checklist complete; Launch Decision Lock documented and shared.
- Deploy to production; monitor errors and RLS behavior.

---

## 6. Do Not Block Launch With These

- Org cover image or org public team.
- Org socials beyond Twitter.
- Editor / analyst / recruiter roles.
- Org member invites (email/link).
- Application pipeline stages (shortlist, interview, offer).
- Job types (full_time, contract, etc.) beyond job/sprint.
- Gig draft status.
- Review reporting or moderation.
- Audit log.
- YouTube/TikTok analytics.
- Dashboard charts driven by real APIs (labeling mock is enough).
- GET /api/orgs/[orgId]/jobs or listJobs(orgId) optimization.
- robots.txt expansion (disallow /org, /deal, etc.) — can be P1.
- Structured data (JSON-LD).
- Org categories/tags.
- Redirect from `/work` to `/work/requests` (nice-to-have).

---

## 7. Recommended First Code Changes

Execute in this order:

1. **Reserve `work`**  
   - File: `apps/web/src/lib/reservedPaths.ts`  
   - Change: Add `"work"` to the `RESERVED_PATHS` Set.

2. **Dashboard mock data labeling**  
   - File: `apps/web/src/figma/app/components/DashboardPage.tsx`  
   - Change: Insert a short banner at the top of the main Dashboard content stating that sample metrics are for preview only. Wrap the chart sections that use `categoryDistribution`, `brandPerformanceData`, `brandAudienceData`, `profileViewsData`, `socialPowerGrowth`, `xSpacesData`, `xSpacesStats`, `credibilityGrowth`, `popularityMetrics` in a single section with a “Sample analytics (coming soon)” (or similar) heading.

3. **Sitemap: add orgs**  
   - File: `apps/web/src/app/sitemap.ts`  
   - Change: After the profile loop, add a second block: createServiceSupabase(), query `orgs` with `.eq("published", true).not("slug", "is", null)`, then append one sitemap entry per org slug (same BASE_URL, changeFrequency "weekly", priority 0.8). Use the same try/catch so a failure does not break the rest of the sitemap.

4. **Production verification (no code)**  
   - In Supabase production: confirm migration `20260239000000_applications_rls_and_job_admin.sql` is applied and that `applications` has no public SELECT policy.

After these, run the Day 1–5 checklist and ship.
