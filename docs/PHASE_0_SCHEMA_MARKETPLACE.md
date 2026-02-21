# Phase 0 — Marketplace schema (discovered)

## 1) public.jobs

| Column      | Type      | Notes |
|------------|-----------|--------|
| id         | uuid      | PK, default gen_random_uuid() |
| org_id     | uuid      | NOT NULL, FK orgs(id) ON DELETE CASCADE |
| type       | text      | NOT NULL, CHECK IN ('job','sprint') |
| title      | text      | NOT NULL |
| budget     | text      | nullable |
| duration   | text      | nullable |
| tags       | jsonb     | default '[]' |
| status     | text      | NOT NULL DEFAULT 'open', CHECK IN ('open','accepted','completed','paid') |
| created_at | timestamptz | NOT NULL default now() |
| updated_at | timestamptz | NOT NULL default now() |

**Indexes:** idx_jobs_org_id, idx_jobs_status  
**RLS:** jobs_select_public (SELECT true), jobs_insert_org_admin, jobs_update_org_admin (org owner/admin via org_members)

---

## 2) public.applications

| Column               | Type      | Notes |
|----------------------|-----------|--------|
| id                   | uuid      | PK |
| job_id               | uuid      | NOT NULL, FK jobs(id) ON DELETE CASCADE |
| applicant_type       | text      | NOT NULL, CHECK IN ('profile','org') |
| applicant_profile_id | uuid      | FK profiles(id), NULL when applicant_type = 'org' |
| applicant_org_id     | uuid      | FK orgs(id), NULL when applicant_type = 'profile' |
| message              | text      | nullable |
| status               | text      | NOT NULL DEFAULT 'pending', CHECK IN ('pending','accepted','rejected','withdrawn') |
| created_at           | timestamptz | NOT NULL |

**Constraint:** applications_applicant_check — exactly one of (applicant_profile_id, applicant_org_id) set per applicant_type.  
**Indexes:** idx_applications_job_id, idx_applications_status, idx_applications_applicant_profile, idx_applications_applicant_org  
**RLS:** applications_select_public (SELECT true), applications_insert_applicant (self as profile or org admin), applications_update_org_admin (org admin of job’s org)

**No unique (job_id, applicant_profile_id)** — duplicate applications possible; handle 409 in code or add partial unique later.

---

## 3) public.deals

| Column          | Type      | Notes |
|-----------------|-----------|--------|
| id              | uuid      | PK |
| profile_id      | uuid      | NOT NULL, FK profiles(id) ON DELETE CASCADE (creator) |
| org_id          | uuid      | NOT NULL, FK orgs(id) ON DELETE CASCADE |
| job_id          | uuid      | nullable, FK jobs(id) ON DELETE SET NULL |
| application_id  | uuid      | nullable, FK applications(id) ON DELETE SET NULL |
| status          | text      | NOT NULL DEFAULT 'active', CHECK IN ('active','completed','disputed') |
| created_at      | timestamptz | NOT NULL |
| updated_at      | timestamptz | NOT NULL |
| delivered_at    | timestamptz | nullable (creator marked delivered) |
| accepted_at     | timestamptz | nullable (org accepted) |
| completed_at    | timestamptz | set by trigger when both delivered_at and accepted_at set; status → 'completed' |

**Indexes:** idx_deals_profile_id, idx_deals_org_id, idx_deals_job_id  
**RLS:** deals_select_party (profile_id = auth.uid() OR org member), deals_insert_org_admin, deals_update_org_admin, deals_update_profile_party (profile can update own for mark-delivered)

---

## 4) public.reviews (deal reviews)

Table name is **reviews**, not deal_reviews.

| Column              | Type      | Notes |
|---------------------|-----------|--------|
| id                  | uuid      | PK |
| reviewer_type       | text      | 'profile' \| 'org' |
| reviewer_profile_id | uuid      | nullable (when org) |
| reviewer_org_id     | uuid      | nullable (when profile) |
| reviewee_type       | text      | 'profile' \| 'org' |
| reviewee_profile_id | uuid      | nullable |
| reviewee_org_id     | uuid      | nullable |
| deal_id             | uuid      | NOT NULL, FK deals(id) |
| rating              | smallint  | 1–5 |
| title               | text      | nullable |
| body                | text      | nullable |
| would_work_again    | boolean   | nullable |
| verified_deal       | boolean   | default false (set by trigger) |
| created_at          | timestamptz | NOT NULL |

**Unique:** idx_reviews_one_per_deal_reviewer (one review per deal per reviewer).  
**Trigger:** reviews_check_deal_and_parties — deal must be completed; reviewer/reviewee must be parties; no self-review.

---

## 5) How “apply” works today

- **Market (App):** `listJobs()` from `@/lib/jobs` (Supabase: jobs + org), then `applyToJobAsProfile(jobId, profileId, message)` or `applyToJobAsOrg(jobId, orgId, message)` from same lib. Both insert into `applications` (client-side Supabase with RLS). After apply, `getOrCreateConversation` and optional first message.
- **Accept:** `POST /api/applications/[id]/accept` — verifies org admin via org_members, creates deal row, sets application.status = 'accepted', job.status = 'accepted'. Agency (org) applicants return 501.

All writes go through existing RLS or the accept API; no mock arrays.
