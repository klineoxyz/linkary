# Linkary — Security and RLS Audit

**Date:** 2026-03-10  
**Scope:** Privilege escalation, unauthorized read/write, broken ownership, privacy leaks, API/RLS mismatches. Adversarial stance: assume a malicious authenticated user and unauthenticated access.

---

## Executive summary

- **Overall:** Security posture is **strong** for launch. RLS and API checks are aligned on core flows (profiles, orgs, jobs, applications, deals, gigs, reviews). A few **non-blocking** gaps and one **recommended** RLS hardening were found.
- **Anon access:** Correctly restricted. Public data is gated by `published` and views; private tables (applications, deals, org_members, analytics caches) are not readable by anon.
- **Authenticated abuse:** Org ownership uses `owner_profile_id` and `is_org_admin` consistently. Application accept, deal complete, review create, and invite flows enforce party/admin checks in API and (where applicable) in DB triggers.
- **Service role:** Used only where necessary (job apply insert, CV download signed URL, analytics jobs, invite-by-email lookup, cron). Callers are still constrained by auth and explicit permission checks before service is used.
- **Launch blocker:** None identified. **Recommendation:** Harden `orgs` INSERT RLS so direct client inserts cannot set `owner_profile_id` to another user (see below).

---

## PASS / PARTIAL / FAIL by area

| Area | Result | Notes |
|------|--------|--------|
| Anon read access | **PASS** | Profiles/orgs gated by `published`; applications/deals/org_members private; case_studies is_public; analytics caches no policies (service only). |
| Profile ownership | **PASS** | profiles: insert id=auth.uid(), update own; RLS and API use auth.uid() / getProfileIdForAuthUser (profile id = auth id). |
| Org owner/admin/member | **PASS** | is_org_admin (owner_profile_id + org_members owner/admin); org_members policies use it; APIs check membership before mutations. |
| Jobs / applications / deals | **PASS** | Applications SELECT private (applicant or job org admin); accept API checks org admin; deals SELECT by party; mark-accepted/complete enforce party/owner. |
| Gigs / gig_applications / gig_deals | **PASS** | Owner vs participant RLS; API enforces owner for complete/update/delete. |
| Reviews | **PASS** | INSERT RLS + trigger (deal/gig_deal completed, parties only, no self-review); API validates deal/gig_deal and party. |
| Case studies | **PASS** | SELECT is_public or owner; INSERT/UPDATE/DELETE owner only. |
| Partner programs / org_affiliations / org_ambassadors | **PASS** | Read: public when owner published or owner/admin; write: owner or org admin. |
| Watchlists | **PASS** | Owner-only SELECT/INSERT/DELETE; no UPDATE policy (not needed). |
| Analytics tables | **PASS** | x_daily_snapshots / x_window_aggregates: own or published profile; x_top_followers_cache etc. no policies (service only); init-status/backfill-90 scoped to user. |
| Public profile / org routes | **PASS** | Use public views or service only for owner; reviews/case studies filtered by reviewee/owner. |
| Orgs INSERT (direct client) | **PARTIAL** | RLS allows any authed user; WITH CHECK only auth.uid() IS NOT NULL. App uses RPC only; direct insert could set owner_profile_id to another user (confusion/DoS, not full takeover). **Recommend:** add WITH CHECK (owner_profile_id = auth.uid()). |

---

## Table-by-table RLS assessment

### profiles
- **SELECT:** `published = true OR auth.uid() = id` (20260218000000). Anon sees only published; user sees own.
- **INSERT:** `auth.uid() = id` (20260217000000). Users can only create their own profile row.
- **UPDATE:** `auth.uid() = id`. Own row only.
- **Evidence:** `supabase/migrations/20260217000000_rls_and_constraints.sql`, `20260218000000_mvp_orgs_reputation_marketplace.sql`.
- **Verdict:** PASS.

### orgs
- **SELECT:** `true` (public list of orgs).
- **INSERT:** `auth.uid() IS NOT NULL` (20260218000000). No constraint on `owner_profile_id`; app creates via `create_org_and_membership` RPC which sets `owner_profile_id = uid`.
- **UPDATE:** `is_org_admin(id, auth.uid())` (20260236000000). Owner or org admin only.
- **Gap:** A malicious user with Supabase client could `insert` into `orgs` with `owner_profile_id = <victim_id>`, creating an org that appears “owned” by victim (victim would see it; attacker would not be in org_members). Recommend: add INSERT WITH CHECK `owner_profile_id = auth.uid()` (and ensure RPC sets it so RPC still succeeds).
- **Evidence:** `20260218000000_mvp_orgs_reputation_marketplace.sql`, `20260235000000_org_creation_rls_verification.sql`, `20260236000000_org_members_admin_fn_and_rls.sql`.
- **Verdict:** PARTIAL (recommended hardening).

### org_members
- **SELECT:** `user_id = auth.uid() OR is_org_admin(org_id, auth.uid())` (20260236000000). Own memberships or org admin.
- **INSERT:** `is_org_admin(org_id, auth.uid())` and role in (owner, admin, member). Only existing org admins can add; RPC adds first owner.
- **UPDATE/DELETE:** Admin or self. Last-owner trigger prevents removing/downgrading last owner.
- **Evidence:** `20260235000000_org_creation_rls_verification.sql`, `20260236000000_org_members_admin_fn_and_rls.sql`.
- **Verdict:** PASS.

### jobs
- **SELECT:** `true` (public job list).
- **INSERT/UPDATE:** Org admin only (via org_members).
- **Evidence:** `20260218000000_mvp_orgs_reputation_marketplace.sql`.
- **Verdict:** PASS.

### applications
- **SELECT:** Applicant (profile or org admin for applicant_org_id) or job org admin (`is_job_org_admin`) (20260239000000). No public read.
- **INSERT:** Applicant only (profile = auth.uid() or org admin for applicant_org_id).
- **UPDATE:** Job org admin (any status) or applicant (withdraw only, status = 'withdrawn').
- **Evidence:** `20260239000000_applications_rls_and_job_admin.sql`.
- **Verdict:** PASS.

### deals (org↔profile)
- **SELECT:** `profile_id = auth.uid() OR org member of org_id`.
- **INSERT:** Org admin only.
- **UPDATE:** Org admin or profile party (20260232000000 `deals_update_profile_party` for mark-delivered). Trigger sets status = completed when delivered_at and accepted_at set.
- **Evidence:** `20260218000000_mvp_orgs_reputation_marketplace.sql`, `20260232000000_reviews_deal_enforcement.sql`.
- **Verdict:** PASS.

### gigs
- **SELECT:** Owner full access; public when `is_public = true AND status = 'open'`.
- **INSERT/UPDATE/DELETE:** Owner only (`owner_profile_id = auth.uid()`).
- **Evidence:** `20260270000000_gigs_and_applications.sql`.
- **Verdict:** PASS.

### gig_applications
- **SELECT:** Applicant or gig owner. **INSERT:** Applicant only. **UPDATE:** Applicant (own) or gig owner (accept/reject).
- **Evidence:** `20260270000000_gigs_and_applications.sql`.
- **Verdict:** PASS.

### gig_deals
- **SELECT:** Owner or participant. **ALL (INSERT/UPDATE/DELETE):** Owner only. Participant cannot mutate.
- **Evidence:** `20260271000000_gig_deals.sql`.
- **Verdict:** PASS.

### reviews
- **SELECT:** `true` (reviews are public once written).
- **INSERT:** Reviewer = profile (reviewer_profile_id = auth.uid()) or org (caller is org admin for reviewer_org_id). Trigger enforces: deal or gig_deal exists, completed (or active for gig), parties match, no self-review; sets verified_deal.
- **No UPDATE/DELETE policies:** Reviews immutable.
- **Evidence:** `20260232000000_reviews_deal_enforcement.sql`, `20260271100000_reviews_gig_deal.sql`.
- **Verdict:** PASS.

### case_studies
- **SELECT:** `is_public = true` or owner (profile or org member) (20260285000000).
- **INSERT/UPDATE/DELETE:** Owner only (profile or org admin).
- **Evidence:** `20260218000000_mvp_orgs_reputation_marketplace.sql`, `20260266000000_case_studies_is_public.sql`, `20260285000000_case_studies_rls_select_public_only.sql`.
- **Verdict:** PASS.

### partner_programs
- **SELECT:** Owner (profile or org admin) or public when owner (profile/org) is published.
- **INSERT/UPDATE/DELETE:** Owner only.
- **Evidence:** `20260248000000_partner_programs.sql`.
- **Verdict:** PASS.

### org_affiliations / org_ambassadors
- **SELECT:** Active (or invited) or profile_id = auth.uid() or org admin. **INSERT:** Org admin. **UPDATE:** Profile or org admin. No DELETE policies (status updated to 'removed').
- **Evidence:** `20260218000000_mvp_orgs_reputation_marketplace.sql`.
- **Verdict:** PASS.

### watchlists
- **SELECT/INSERT/DELETE:** `owner_profile_id = auth.uid()`.
- **Evidence:** `20260259000000_watchlists.sql`.
- **Verdict:** PASS.

### Analytics-related
- **x_daily_snapshots / x_window_aggregates:** SELECT own (owner_type/owner_id) or published profile (20260228000000). No anon read of private analytics.
- **x_top_followers_cache, x_mentions_weekly_cache, x_account_feed_cache:** RLS enabled, no policies; service role only (20260260000000).
- **analytics_jobs:** RLS enabled; no policies for anon/auth; service/worker only.
- **Evidence:** `20260228000000_social_accounts_and_analytics_backfill.sql`, `20260260000000_x_insights_cache_tables.sql`.
- **Verdict:** PASS.

---

## Route / API permission assessment

| Route / flow | Auth | Permission check | Service role use | Verdict |
|--------------|------|-------------------|------------------|--------|
| POST /api/orgs/create | Bearer | N/A (creates for self) | Uses service to call RPC | PASS (RPC sets owner) |
| POST /api/orgs/[orgId]/members/invite | Bearer | is_org_admin RPC | For rate limit + email lookup only | PASS |
| GET/POST /api/orgs/[orgId]/members | Bearer | is_org_admin; list/update by admin | Service for profile list when needed | PASS |
| POST /api/jobs/[jobId]/apply | Bearer | Job exists, open; apply-as-org => org admin | Service for insert (applicant_profile_id = user.id enforced in code) | PASS |
| POST /api/applications/[id]/accept | Bearer | Org owner/admin for job.org_id | Anon client | PASS |
| POST /api/deals/[id]/mark-accepted | Bearer | Org owner/admin for deal.org_id | Anon client | PASS |
| POST /api/deals/[id]/complete | Bearer | Gig deal owner only (owner_profile_id) | Anon client | PASS |
| POST /api/reviews | Bearer | Party to deal/gig_deal; completed; no self-review (API + trigger) | Anon client | PASS |
| GET /api/profile/me-stats | Bearer | profile.id = user.id; reviews/deals/gig_deals by profile id | Anon client | PASS |
| GET /api/applications/[id]/cv-download | Bearer | Org owner/admin for application’s job | Service for signed URL only | PASS |
| GET /api/analytics/init-status | Bearer | owner_id = user.id in all queries | Service for profile + analytics_jobs (scoped to user.id) | PASS |
| POST /api/analytics/backfill-90 | Bearer | user.id only; rate limit | Service for profile + job enqueue (owner = user.id) | PASS |
| GET /api/public/profile | Optional | Uses public views / getPublicEntityByUsername (published only) or service for owner | Service for owner path and skills/achievements | PASS |
| GET /api/overview/stats | None | N/A | Service; returns only aggregate counts | PASS (no PII) |
| PATCH/DELETE /api/gigs/[id] | Bearer | assertOwner(supabase, gigId, ownerProfileId) | No | PASS |
| Affiliates/ambassadors invite | Bearer | is_org_admin | Service for profile lookup by email | PASS |

---

## Concrete exploit scenarios

### 1. Org INSERT with someone else’s owner_profile_id (PARTIAL – recommended fix)
- **Scenario:** Attacker uses Supabase anon client: `supabase.from('orgs').insert({ slug: 'x', name: 'Y', org_type: 'project', owner_profile_id: victim_profile_id })`.
- **Result:** Row inserted (RLS only checks auth.uid() IS NOT NULL). Victim’s org list would show an org they didn’t create; attacker is not in org_members so cannot act as admin.
- **Impact:** Confusion, possible DoS; not privilege escalation.
- **Fix:** Add INSERT WITH CHECK `owner_profile_id = auth.uid()` (and ensure RPC sets owner_profile_id so it still passes).

### 2. Accept application / mark deal accepted as non-admin
- **Scenario:** Attacker sends POST to accept or mark-accepted with valid application/deal id.
- **Result:** API checks org_members for job.org_id / deal.org_id and role owner/admin; 403 if not admin.
- **Verdict:** Mitigated.

### 3. Create review for deal one is not party to
- **Scenario:** Attacker POSTs review with deal_id of another user’s deal.
- **Result:** API validates deal exists, status = completed, and caller is profile or org party; trigger re-validates parties and completed status. Insert fails or 403.
- **Verdict:** Mitigated.

### 4. Read another user’s applications
- **Scenario:** Attacker uses Supabase client to select from applications.
- **Result:** RLS applications_select_private: only applicant or job org admin sees rows. Attacker sees no one else’s applications.
- **Verdict:** Mitigated.

### 5. Read private analytics (x_daily_snapshots, x_window_aggregates) for another profile
- **Scenario:** Attacker queries with owner_id = victim.
- **Result:** RLS allows SELECT only if owner_id = auth.uid() (profile) or org member, or profile is published. Unpublished victim’s analytics not visible.
- **Verdict:** Mitigated.

### 6. Complete someone else’s gig deal
- **Scenario:** Attacker POSTs /api/deals/[id]/complete for a gig_deal where they are not owner.
- **Result:** API checks owner_profile_id === getProfileIdForAuthUser(user.id); 403. RLS allows UPDATE only for owner.
- **Verdict:** Mitigated.

---

## Exact files / migrations / routes involved

- **RLS and policies:**  
  `supabase/migrations/20260217000000_rls_and_constraints.sql`,  
  `20260218000000_mvp_orgs_reputation_marketplace.sql`,  
  `20260232000000_reviews_deal_enforcement.sql`,  
  `20260235000000_org_creation_rls_verification.sql`,  
  `20260236000000_org_members_admin_fn_and_rls.sql`,  
  `20260239000000_applications_rls_and_job_admin.sql`,  
  `20260248000000_partner_programs.sql`,  
  `20260259000000_watchlists.sql`,  
  `20260266000000_case_studies_is_public.sql`,  
  `20260270000000_gigs_and_applications.sql`,  
  `20260271000000_gig_deals.sql`,  
  `20260271100000_reviews_gig_deal.sql`,  
  `20260285000000_case_studies_rls_select_public_only.sql`,  
  `20260228000000_social_accounts_and_analytics_backfill.sql`,  
  `20260260000000_x_insights_cache_tables.sql`,  
  `20260234000000_public_views_privacy.sql`.

- **APIs (auth + permission checks):**  
  `apps/web/src/app/api/orgs/create/route.ts`,  
  `apps/web/src/app/api/orgs/[orgId]/members/invite/route.ts`,  
  `apps/web/src/app/api/jobs/[jobId]/apply/route.ts`,  
  `apps/web/src/app/api/applications/[id]/accept/route.ts`,  
  `apps/web/src/app/api/deals/[id]/mark-accepted/route.ts`,  
  `apps/web/src/app/api/deals/[id]/complete/route.ts`,  
  `apps/web/src/app/api/reviews/route.ts`,  
  `apps/web/src/app/api/profile/me-stats/route.ts`,  
  `apps/web/src/app/api/applications/[id]/cv-download/route.ts`,  
  `apps/web/src/app/api/analytics/init-status/route.ts`,  
  `apps/web/src/app/api/analytics/backfill-90/route.ts`,  
  `apps/web/src/app/api/public/profile/route.ts`,  
  `apps/web/src/app/api/gigs/[id]/route.ts`.

- **Helpers:**  
  `apps/web/src/lib/profiles.ts` (getProfileIdForAuthUser),  
  `apps/web/src/lib/publicData.ts` (getPublicEntityByUsername, getPublicEntityForOwner).

---

## Launch blockers vs non-blocking issues

- **Launch blockers:** None. No privilege escalation or unauthorized access to private data identified in current code paths.
- **Non-blocking (recommended):**
  - **Orgs INSERT:** Add RLS WITH CHECK so `owner_profile_id` must equal `auth.uid()` on insert. Prevents direct client abuse; app continues to use RPC.

---

## Owner_profile_id consistency

- **Usage:** `orgs.owner_profile_id` is set by `create_org_and_membership` (RPC) to `auth.uid()`. Used in:
  - `org_members` INSERT policy (only owner can add first members; RPC does that).
  - `is_org_admin(org_id, uid)`: true if `orgs.owner_profile_id = uid` or org_members role in (owner, admin).
  - `orgs` UPDATE: `is_org_admin(id, auth.uid())`.
- **Consistency:** All org admin checks go through `is_org_admin` or explicit org_members lookup; `owner_profile_id` is the single source for “org owner” and avoids recursion in RLS.
- **Verdict:** Used consistently and safely.

---

## Unpublished / private resources

- **Profiles:** Anon sees only `published = true` (profiles_select_public and public_profile_view). Own profile always visible to user.
- **Orgs:** public_org_view and org list only `published = true`.
- **Case studies:** SELECT requires `is_public = true` or ownership (profile or org member).
- **Applications:** No public SELECT; applicant or job org admin only.
- **Deals:** Party only.
- **Analytics (snapshots/aggregates):** Own or published profile only; private caches (top followers, mentions, feed) have no SELECT policies (service only).
- **Verdict:** Unpublished/private resources are private.

---

## Final verdict

**Safe to proceed to launch QA from a security/RLS perspective.**

- No privilege escalation or unauthorized read/write of sensitive data found.
- RLS and API checks align on core flows; triggers backstop review and deal completion.
- Service role is used narrowly and only after auth and permission checks.
- **Recommendation before or soon after launch:** Add `orgs` INSERT WITH CHECK `(owner_profile_id = auth.uid())` so direct client inserts cannot assign org ownership to another user.

---

*End of LINKARY_SECURITY_RLS_AUDIT.md*
