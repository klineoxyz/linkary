# MVP Circles, KOL Lists & Invites — Implementation Plan

**Date:** 2026-03-10  
**Purpose:** What was implemented and what remains. Aligned with Audit and QA Report.

---

## 1. Implemented (Current State)

### Schema and migrations

| Migration | Content |
|-----------|---------|
| `20260322100000_circles_and_members.sql` | circles, circle_members, RLS, set_updated_at trigger |
| `20260322100001_kol_lists_and_members.sql` | kol_lists, kol_list_members, RLS, trigger |
| `20260322100002_invite_system.sql` | invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, redeem_invite_code RPC, RLS |
| `20260322100003_creator_programs.sql` | creator_programs, creator_program_invites, RLS, triggers |
| `20260323000000_invite_issued_by_profile_id.sql` | invite_codes.issued_by_profile_id; redeem RPC updated for human inviter lineage |

### APIs

- **Circles:** GET/POST `/api/circles`; GET/PATCH/DELETE `/api/circles/[id]`; POST/DELETE `/api/circles/[id]/members`.
- **KOL:** GET/POST `/api/kol-lists`; GET/PATCH/DELETE `/api/kol-lists/[id]`; POST/DELETE `/api/kol-lists/[id]/members`.
- **Invites:** POST `/api/invites/redeem`; GET `/api/me/access`; POST `/api/invites/issue`; POST `/api/invites/allocate-batch`; GET `/api/invites/my-codes`; GET `/api/invites/lineage`.
- **Creator programs:** GET/POST `/api/creator-programs?org_id=`; GET/PATCH/DELETE `/api/creator-programs/[id]`; POST/PATCH `/api/creator-programs/[id]/invites`.

### Frontend and routing

- **Circles:** CirclesOverviewPage, CircleDetailPage, CreateCircleFlow — real data only; nav “Circles”. Next.js page: `app/app/circles/page.tsx`.
- **KOL:** KOLListsPage — lists, create, members, add/remove; nav “KOL Lists”. Next.js page: `app/app/kol-lists/page.tsx`.
- **Invite gate:** InviteRequiredView rendered in App when `authUserId` and `!accessAllowed`; no separate route.
- **Lineage:** InviteLineagePage; nav “Invite lineage”. Next.js page: `app/app/invites/lineage/page.tsx`. Pathname handling: `invites` + `lineage` → inviteLineage.
- **Creator programs:** CreatorProgramsPage; nav “Creator programs”. Next.js page: `app/app/creator-programs/page.tsx`. RESERVED_PATHS and nameMap: `creator-programs` → creatorPrograms.

### RLS

- Circles, circle_members: owner (profile or org_members.user_id) full CRUD.
- KOL lists, kol_list_members: same.
- Invite batches: select for allocated_to; insert for allocator (admin).
- Invite codes: select/insert/update for issuer (profile or org member).
- Invite redemptions: insert via RPC only; select for redeemer/inviter as needed.
- Creator programs, creator_program_invites: org member CRUD; invitee can update own invite status.

---

## 2. Remaining / Optional (Not Required for MVP Sign-Off)

| Item | Status | Notes |
|------|--------|------|
| Org-owned circle in CreateCircleFlow | Optional | API supports; UI needs org picker and owner_type/owner_id. |
| Org-owned KOL list in UI | Optional | API supports; KOLListsPage could add org selector. |
| Creator program detail page | Optional | View program, list invites, add invites from UI (API exists). |
| Invite-from-circle/KOL in creator programs UI | Optional | API accepts source_type/source_id; UI could offer “Invite from circle” / “Invite from KOL list”. |
| Admin batch-allocation UI | Optional | POST `/api/invites/allocate-batch` exists; no UI. |
| Invite-required as dedicated route | Optional | Current: in-app view when gated. Could add `/app/invite-required` for deep links. |
| GET /api/invites/admin/overview | Optional | Admin overview of batches/codes/redemptions. |

---

## 3. Reference: Design Decisions

- **Invite lineage:** `issued_by_profile_id` on invite_codes stores the human issuer; redeem sets `profiles.inviter_id` from it when present (so org-issued codes still have a clear inviter for the chain).
- **Cap:** Normal users 500 lifetime issued codes; admin (@muazxinthi) unlimited in issue API. Capacity comes from invite_batches; issue consumes from batches.
- **Gate:** Enforced in client after session: GET `/api/me/access`; if not allowed, show InviteRequiredView until redeem succeeds.

---

*End of Implementation Plan. See Audit for current state and QA Report for verification and grading.*
