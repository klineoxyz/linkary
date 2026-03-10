# Linkary — Permissions Audit

**Date:** 2026-03-10  
**Scope:** Who can create, edit, delete, publish, accept, reject, complete, review, invite, remove, and view each entity; alignment of UI, API, and RLS; creator-owned vs org-owned flows; edge cases.

---

## 1. Permission matrix by entity

Legend: **Owner** = profile owner (auth.uid() = profile id) or org owner (orgs.owner_profile_id); **Admin** = org_members role owner or admin; **Party** = profile or org that is a party to the deal/application; **Public** = anyone (including anon where applicable).

| Entity | Create | Edit | Delete | Publish | View |
|--------|--------|------|--------|---------|------|
| **profiles** | Self (id = auth.uid()) | Self | — | Self (published flag) | Public if published; else self |
| **orgs** | Authenticated via RPC only (owner_profile_id = caller) | Admin | — | Admin (requires is_x_verified) | Public (list) |
| **org_members** | Admin | Admin (role change); self (leave) | Admin or self | — | Self (own memberships); Admin (org’s members) |
| **jobs** | Admin | Admin | — | — | Public |
| **applications** | Applicant (profile or org admin for applicant_org_id) | Applicant (withdraw); Admin (accept/reject) | — | — | Applicant or job org Admin |
| **deals (org↔profile)** | Admin (on accept) | Profile party (mark delivered); Admin (mark accepted) | — | — | Profile or org party |
| **gigs** | Owner | Owner | Owner | Owner (is_public) | Public if is_public & open; else owner |
| **gig_applications** | Applicant (not own gig) | Applicant (withdraw); Owner (accept/reject) | — | — | Applicant or gig Owner |
| **gig_deals** | Created by system when gig owner accepts | Owner (complete/cancel) | — | — | Owner or participant |
| **reviews** | Party to completed deal/gig_deal (profile or org) | — | — | — | Public |
| **case_studies** | Owner (profile or org Admin) | Owner | Owner | Owner (is_public) | Public if is_public; else owner |
| **partner_programs** | Owner (profile or org Admin) | Owner | Owner | — | Owner or public when owner published |
| **org_affiliations** | Admin (invite) | Invitee (accept); Admin or invitee (remove) | — | — | Admin; invitee (own); public when active |
| **org_ambassadors** | Admin (invite) | Invitee (accept); Admin or invitee (remove) | — | — | Admin; invitee (own); public when active/invited |
| **watchlists** | Owner | — | Owner | — | Owner |

| Entity | Accept | Reject | Complete | Review | Invite | Remove |
|--------|--------|--------|----------|--------|--------|--------|
| **applications** | Admin | Admin | — | — | — | — |
| **deals (org)** | Admin (mark-accepted) | — | Trigger when delivered+accepted | Profile or org party (after completed) | — | — |
| **gig_applications** | Owner | Owner | — | — | — | — |
| **gig_deals** | — | — | Owner | Both parties (after completed) | — | — |
| **org_affiliations** | Invitee (PATCH status=active) | — | — | — | Admin | Admin or invitee |
| **org_ambassadors** | Invitee (PATCH status=active) | — | — | — | Admin | Admin or invitee |
| **org_members** | — | — | — | — | Admin | Admin or self |

---

## 2. PASS / PARTIAL / FAIL by flow

| Flow | Result | Notes |
|------|--------|------|
| Profile CRUD + publish | **PASS** | RLS and API: own profile only. UI: profile edit / settings. |
| Org create | **PASS** | RPC only; UI uses create org API → RPC. |
| Org update / publish | **PASS** | API/RLS: is_org_admin. UI: OrgDetailPage settings gated by `admin`. |
| Org members list / invite / role change / remove | **PASS** | API: is_org_admin or self for leave. UI: members tab shows invite/role/remove for admin. |
| Jobs create / update / close | **PASS** | API: is_org_admin(orgId). UI: jobs tab, create job modal, close job for admin. |
| Applications create (profile or org) | **PASS** | API: applicant or org admin for applicant_org_id; RLS matches. UI: apply from job/gig. |
| Applications accept / reject | **PASS** | API: org owner/admin for job. UI: OrgDetailPage jobs tab, Accept/Reject for admin. |
| Org deal: view / mark delivered / mark accepted | **PASS** | API: party checks. UI: /deal/[id] shows buttons from canMarkDelivered/canMarkAccepted. |
| Org deal: leave review | **FAIL** | API requires `verified_deal: true`; UI at /deal/[id] does **not** send it → 400. Gig deal review from /profile/deals sends verified_deal. |
| Gigs CRUD / close | **PASS** | API: owner_profile_id = caller. UI: gigs from profile, PATCH/DELETE/close. |
| Gig apply / withdraw | **PASS** | API: applicant or owner. UI: apply on gig page; withdraw in applications. |
| Gig application accept / reject | **PASS** | API: gig owner. UI: OrgDetailPage or gig applications (owner). |
| Gig deal complete / cancel | **PASS** | API: owner only for complete/cancel. UI: /profile/deals Complete/Cancel for owner. |
| Gig deal leave review | **PASS** | API: reviewee_profile_id + verified_deal: true. UI: /profile/deals sends verified_deal. |
| Case studies (profile + org) | **PASS** | API/RLS: owner (profile or org admin). UI: OrgDetailPage case studies (admin); profile overview remove. |
| Partner programs (profile + org) | **PASS** | API: ownerType/ownerId ownership. UI: partners from profile/org context. |
| Affiliate / ambassador invite | **PASS** | API: is_org_admin. UI: OrgDetailPage affiliates/ambassadors invite for admin. |
| Affiliate / ambassador accept / remove | **PASS** | API: invitee for accept; admin or invitee for remove. UI: Accept button for invitee; remove for admin or self. |
| Watchlist | **PASS** | API/RLS: owner only. UI: add/remove from profile. |
| Reviews (read) | **PASS** | Public. Shown on public profile and deal page. |

---

## 3. Mismatches between UI, API, and DB

### 3.1 Launch blocker: Org deal review missing `verified_deal`

- **Where:** `apps/web/src/app/deal/[id]/page.tsx` — submitReview sends `{ deal_id: id, rating, body }` only.
- **API:** `POST /api/reviews` requires `verified_deal: true`; otherwise returns 400: "Only verified reviews are allowed. Pass verified_deal: true and either reviewee_profile_id (gig) or deal_id (org deal)."
- **Result:** User completing an org deal and clicking "Leave review" on the deal page always gets 400; review is never submitted.
- **Fix:** In the deal page, include `verified_deal: true` in the review POST body when submitting an org deal review.

### 3.2 No other UI/API/RLS mismatches found

- Org admin in UI is derived from `isOrgAdmin(userId, orgId)` (lib/orgs); APIs use `is_org_admin` RPC. Aligned.
- Deal page `canMarkDelivered` / `canMarkAccepted` / `canLeaveReview` come from GET /api/deals/[id]; logic matches API and RLS.
- Profile deals page (gig deals) sends `verified_deal: true` for gig-deal reviews; aligned.

---

## 4. Creator-owned vs org-owned flows

| Aspect | Creator-owned | Org-owned |
|--------|----------------|-----------|
| **Resources** | profiles, gigs, gig_applications, gig_deals, watchlists, profile case_studies, profile partner_programs | orgs, org_members, jobs, applications, deals (org↔profile), org case_studies, org partner_programs, org_affiliations, org_ambassadors |
| **Who can act** | profile id = auth.uid() | org owner or org_members role owner/admin |
| **RLS** | owner_profile_id = auth.uid() or profile id = auth.uid() | is_org_admin(org_id, auth.uid()) or party to deal |
| **API pattern** | Check gig/profile owner by owner_profile_id or user.id | Check is_org_admin(orgId) or deal party |
| **UI pattern** | "Your gigs", "Your deals", profile overview; buttons when me.id = owner | OrgDetailPage tabs; admin state from isOrgAdmin(); buttons when admin |

**Consistency:** Clear. Creator-owned uses profile id / owner_profile_id; org-owned uses org_id + is_org_admin or deal/job party. Naming and checks are consistent across RLS, API, and UI (except org deal review body above).

---

## 5. Ambiguous states and edge cases

### 5.1 Org deal review from deal page (blocker)

- **State:** Deal completed; user is profile or org party; clicks "Leave review."
- **Issue:** Request body omits `verified_deal: true` → 400. Feels like a bug to the user.
- **Severity:** Launch blocker for org deal reviews from that page.

### 5.2 Member role "owner" in PATCH

- **API:** `PATCH /api/orgs/[orgId]/members/[userId]` allows body `role: 'member' | 'admin' | 'owner'` in the docstring, but implementation only accepts `admin` or `member`. Transfer of ownership is a separate flow.
- **UI:** OrgDetailPage only offers role dropdown admin/member and transfer-owner for owner; no way to set role to "owner" via this PATCH. So no user-facing ambiguity; docstring is slightly misleading.

### 5.3 Last-owner guardrail

- **State:** Only one owner left; that owner tries to leave or demote self.
- **Backend:** Trigger raises "Organization must have at least one owner."
- **UI:** Remove/leave and role change call API; error message can be shown. No special "last owner" warning in UI before action (acceptable; message is clear).

### 5.4 Applicant withdraw vs org reject

- **Withdraw:** Applicant can set status to withdrawn (RLS + API).
- **Reject:** Only org owner/admin. UI shows both Accept and Reject for admin; applicant sees only withdraw where implemented. Clear.

### 5.5 Deal page requires auth

- **GET /api/deals/[id]:** Returns 401 without Bearer. Deal page is not usable when logged out; user sees "Sign in to view this deal." Intentional; no ambiguity.

### 5.6 Affiliate/ambassador "Accept" vs "Remove"

- **Accept:** Only invitee (profile_id = user.id), status invited → active.
- **Remove:** Admin or the affiliate/ambassador (self). UI shows "Accept" for invitee when status = invited; "Remove" (or equivalent) for admin or self. Aligned.

---

## 6. Launch blockers vs non-blocking issues

### Launch blocker

1. **Org deal review body**  
   Deal page (`/deal/[id]`) must send `verified_deal: true` when posting a review for an org deal. Until then, org deal reviews from that page always fail with 400.

### Non-blocking

- **PATCH members docstring:** Says role can be 'owner'; implementation only allows 'admin' | 'member'. Recommend updating the comment to match behavior (or document transfer-ownership separately).
- **Last-owner:** No pre-emptive UI warning; backend error is sufficient for launch.
- **Deal page auth:** By design; no change needed.

---

## 7. Final verdict

**Permission model is clear enough for launch** once the single blocker is fixed.

- **Strengths:** Permission matrix is consistent across RLS, API, and (with one exception) UI. Creator-owned vs org-owned is clear. Accept/reject/complete/invite/remove rules are enforced in API and RLS and surfaced correctly in the UI.
- **Required fix:** Add `verified_deal: true` to the org deal review request body in `apps/web/src/app/deal/[id]/page.tsx` so that leaving a review from the deal page succeeds.
- **Recommendation:** Fix the deal page review payload before launch so org deal reviews work as intended; no other permission or alignment blockers identified.

---

*End of LINKARY_PERMISSIONS_AUDIT.md*
