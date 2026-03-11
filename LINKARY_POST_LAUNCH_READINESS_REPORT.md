# Linkary Post–Sign-Off Operational Polish — Readiness Report

**Date:** 10 March 2026  
**Scope:** Operational polish for first 50–200 users. No restructure, no new nav sections, no architecture reopen.

---

## 1. Current delta audit (what was rough before this pass)

| Area | Before | After |
|------|--------|--------|
| **Admin invite ops** | Minimal: allocate + flat list of “my issued” codes only; no breakdown, no filter, no search, no redeemed-by or allocated-to, no export. | Upgraded: code breakdown (available/redeemed/revoked/expired/reserved), filterable/searchable code list, table with allocated-to / issued-by / redeemed-by, Copy as CSV, link to Invite lineage. |
| **Invite redeem errors** | Generic “Invalid or unavailable code” for all failures. | Clear messages: “This code was already used.” for already_redeemed; “Invalid or expired code. Check the code and try again.” for invalid_or_unavailable_code. |
| **Ops visibility** | No single view of invite or recruiting health. | Lightweight ops snapshot on admin page: creator invite counts (invited/accepted/declined), open jobs with zero applicants. |
| **Jobs/Sprints recruiting** | Creator programs had invite-from-circle/KOL; jobs/sprints were applicant-only. | **Decision:** Jobs and Sprints remain applicant-only for this phase. Adding invite-from-circle would require a new job_invites table or extending applications with an “invited” flow; for MVP, one recruiting model (creator programs with full invite flow) and one apply-only model (jobs/sprints) is the cleaner product path. Documented only; no schema change. |
| **Empty states** | Circles, KOL, Org jobs already had usable empty states. | InviteRequiredView error copy improved; Creator program drawer already had “No one invited yet. Use circles or KOL lists below.” No fake data. |

---

## 2. What was implemented

### 2.1 Founder / admin invite operations upgrade

| Item | Detail |
|------|--------|
| **API** | `GET /api/invites/admin-codes` (admin-only, service role). Query: `status`, `search`, `limit`. Returns: `summary` (counts by status), `codes` array with code, status, batch_allocated_to_label, issued_by_label, redeemed_by_username, created_at. |
| **File** | `apps/web/src/app/api/invites/admin-codes/route.ts` |
| **UI** | `AdminInvitesPage.tsx`: Code breakdown section; filter by status; search by code; table (Code, Status, Allocated to, Issued by, Redeemed by, Created); Refresh; Copy as CSV; existing “Open Invite lineage” link. |
| **Evidence** | Admin page loads admin-codes on mount; filter/search trigger reload; copy builds CSV from current codes array. |

### 2.2 Invite redeem error messaging

| Item | Detail |
|------|--------|
| **File** | `apps/web/src/figma/app/components/InviteRequiredView.tsx` |
| **Change** | Map API `error` to user-facing strings: `already_redeemed` → “This code was already used.”; `invalid_or_unavailable_code` → “Invalid or expired code. Check the code and try again.” |

### 2.3 Lightweight ops metrics

| Item | Detail |
|------|--------|
| **API** | `GET /api/invites/admin-stats` (admin-only). Returns: `invite_codes` (counts by status), `creator_invites` (counts by status), `jobs_zero_applicants`, `open_jobs_total`. |
| **File** | `apps/web/src/app/api/invites/admin-stats/route.ts` |
| **UI** | `AdminInvitesPage.tsx`: “Ops snapshot” block with creator invites (pending/accepted/declined) and open jobs with 0 applicants. |

### 2.4 Jobs/Sprints recruiting parity

| Item | Detail |
|------|--------|
| **Decision** | Jobs and Sprints remain applicant-only. Creator programs keep full invite-from-circle/KOL flow. No new tables or API for job invites in this pass. |
| **Rationale** | Single recruiting model with invites (creator programs) and single apply-only model (jobs/sprints) is MVP-clean; adding job invites would require schema and duplicate flows. |

---

## 3. QA report

| Bucket | Items |
|--------|--------|
| **Fully implemented** | Admin invite ops upgrade (breakdown, filter, search, table, allocated-to/issued-by/redeemed-by, Copy as CSV, lineage link). Invite redeem error copy (already_redeemed, invalid_or_unavailable_code). Admin-stats API and Ops snapshot on admin page. Jobs-parity decision documented; no code change. |
| **API/schema complete; UI partial** | N/A. |
| **Deferred** | Per-user “view lineage for this profile” from admin (lineage remains current-user view). Redeemed/revoked code export filters. Top recruiting sources (circle vs KOL vs manual) aggregation. |
| **Deferred (this pass)** | Dedicated bug-bash (direct route loads, drawer state, stale loading, org/admin enforcement) was not run; recommend as a short follow-up if issues appear in first cohort. |
| **Blocked** | None. |

---

## 4. Founder verdict

### What is now smoother for first users

- **Founders:** Admin invite page is operationally usable: see code breakdown, filter by status, search by code, see who a batch was allocated to and who redeemed each code, copy table as CSV, open lineage. Ops snapshot gives at-a-glance creator-invite and zero-applicant job counts.
- **New sign-ups:** Clear invite-required messaging when a code is already used or invalid/expired.
- **Empty states:** Existing empty states (no circles, no KOL lists, no applicants, no invites) remain clear; no fake data.

### What still needs manual handling

- Allocate batch still requires pasting profile/org UUID (no typeahead by username/org name).
- “Who invited whom” is still a single lineage view (no deep-link to a specific user’s chain from admin).
- Jobs/sprints have no invite-from-circle; recruiting there is apply-only.

### Recommended next prompt after this pass

- After first-cohort feedback: consider profile/org search or typeahead in allocate-batch; consider “view lineage for profile X” from admin; consider job/sprint invite-from-circle only if cohort consistently asks for it and schema is agreed.

---

## 5. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/invites/admin-codes/route.ts` | **New.** GET admin-codes: admin check, service role, summary counts, code list with batch/redeemed/issued labels, filter by status, search by code. |
| `apps/web/src/app/api/invites/admin-stats/route.ts` | **New.** GET admin-stats: admin check, service role, invite_codes counts, creator_program_invites counts, jobs with zero applicants. |
| `apps/web/src/figma/app/components/AdminInvitesPage.tsx` | **Rewritten.** Uses admin-codes (breakdown, filter, search, table, copy CSV); loads admin-stats; Ops snapshot block; same allocate form and lineage link. |
| `apps/web/src/figma/app/components/InviteRequiredView.tsx` | Friendlier error messages for already_redeemed and invalid_or_unavailable_code. |

---

## 6. Final sign-off wording

**Operational polish complete for controlled private MVP.** Admin invite ops are usable for onboarding; invite redeem errors are clear; lightweight ops metrics are visible; jobs/sprints stay applicant-only by design. No new sections, no restructure, no overbuild.
