# MVP Circles, KOL Lists & Invites — QA Report (Post–Pass 2)

**Date:** 2026-03-10  
**Scope:** Launch readiness for Circles, KOL Lists, Invite-only access, Creator programs, and removal of mock data.  
**Pass 2:** Completed circles end-to-end, KOL persistence, invite gate, issue/allocate/lineage, creator programs APIs + minimal UI, invite lineage schema fix.

---

## 1. Summary Verdict

| Area | Status | Notes |
|------|--------|--------|
| **Circles** | **Fully implemented** | Schema, RLS, all APIs; overview + detail + create flow use real data; add/remove members; no demo data. |
| **KOL Lists** | **Fully implemented** | Schema, RLS, GET/POST /api/kol-lists, GET/PATCH/DELETE /api/kol-lists/[id], members APIs; KOLListsPage wired; no demo creators. |
| **Invite system** | **Fully implemented** | Batches, codes, redemptions, `issued_by_profile_id` for lineage; redeem RPC; redeem + access + issue + allocate-batch + my-codes + lineage APIs; InviteRequiredView + app guard; InviteLineagePage. |
| **Creator programs** | **Implemented (APIs + minimal UI)** | Schema, RLS; CRUD APIs; invites API (add + PATCH status); CreatorProgramsPage (list by org, create program). Invite-from-circle/KOL in UI is optional follow-up. |
| **Mock data removal** | **Done** | Circle detail, CreateCircleFlow, KOLListsPage use only real data; no demo circles, members, or creators on live surfaces. |

---

## 2. Fully Implemented

- **Invite lineage schema:** `invite_codes.issued_by_profile_id` added; redeem RPC sets `profiles.inviter_id` from `issued_by_profile_id` when present (supports org-issued codes with human inviter). Documented in migration and QA.
- **Circles:** List, create, get, update, delete, add/remove members; CircleDetailPage fetches GET /api/circles/[id], real members, add-member search, remove member; CreateCircleFlow uses real search and POST members after create; no demo data.
- **KOL Lists:** GET/POST /api/kol-lists, GET/PATCH/DELETE /api/kol-lists/[id], POST/DELETE members; KOLListsPage loads lists, select list, load members, add from search, remove; no demo creators; "Coming soon" removed from nav.
- **Invite-only access:** When `LINKARY_INVITE_ONLY=true` and `/api/me/access` returns `allowed: false`, app shows `InviteRequiredView`; user enters code → POST /api/invites/redeem → on success `setAccessAllowed(true)` and refresh.
- **Invite issuance:** POST /api/invites/issue (body: `count?`); uses batches; cap 500 for non-admin; @muazxinthi unlimited.
- **Invite batch allocation:** POST /api/invites/allocate-batch (admin only); body: allocated_to_type, allocated_to_id, count.
- **My codes:** GET /api/invites/my-codes returns codes issued by caller (profile or org member).
- **Invite lineage:** GET /api/invites/lineage?depth=1|2; InviteLineagePage (inviter + invitees tree); nav "Invite lineage".
- **Creator programs:** GET/POST /api/creator-programs?org_id=; GET/PATCH/DELETE /api/creator-programs/[id]; POST/PATCH /api/creator-programs/[id]/invites; CreatorProgramsPage (select org, list programs, create program); nav "Creator programs".
- **RLS:** All new/updated tables use correct `user_id` in org_members checks; circles API org check fixed to user_id.

---

## 3. Partially Implemented

| Item | State | Notes |
|------|--------|------|
| **Creator programs — invite from circle/KOL in UI** | API supports it (source_type, source_id) | No bulk "invite from circle" or "invite from KOL list" button in UI yet; can add invites by profile_id via API. |
| **Org circles in CreateCircleFlow** | Personal only in flow | Creating org-owned circle requires org_id; flow shows error if type=organization (no org picker in modal). |
| **Admin batch allocation UI** | API only | POST /api/invites/allocate-batch exists; no dedicated admin UI for allocating batches. |

---

## 4. Schema Only (N/A after pass 2)

None; all schema areas now have at least APIs and minimal or full UI.

---

## 5. Deferred

- **Invite batch allocation UI** for admins (e.g. form: allocate to profile/org, count).  
- **Creator program detail page** (view program, list invites, bulk invite from circle/KOL in UI).  
- **Quality-controlled network growth** (inviter reputation, scoring) — schema and product rule documented; implementation deferred.

---

## 6. Blocked

None.

---

## 7. Migrations List

| Migration | Purpose |
|-----------|---------|
| 20260322100000_circles_and_members.sql | circles, circle_members, RLS, trigger |
| 20260322100001_kol_lists_and_members.sql | kol_lists, kol_list_members, RLS, trigger |
| 20260322100002_invite_system.sql | invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, redeem_invite_code(), RLS |
| 20260322100003_creator_programs.sql | creator_programs, creator_program_invites, RLS, triggers |
| **20260323000000_invite_issued_by_profile_id.sql** | **invite_codes.issued_by_profile_id; redeem RPC updated for human inviter lineage** |

---

## 8. APIs Added / Changed (Pass 2)

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/kol-lists | List KOL lists (profile or ?owner=org&org_id=) |
| POST | /api/kol-lists | Create KOL list |
| GET | /api/kol-lists/[id] | Get list + members |
| PATCH | /api/kol-lists/[id] | Update list |
| DELETE | /api/kol-lists/[id] | Delete list |
| POST | /api/kol-lists/[id]/members | Add member |
| DELETE | /api/kol-lists/[id]/members?profile_id= | Remove member |
| POST | /api/invites/issue | Issue codes (count; cap 500; admin unlimited) |
| POST | /api/invites/allocate-batch | Admin only; allocate batch to profile/org |
| GET | /api/invites/my-codes | List codes issued by caller |
| GET | /api/invites/lineage?depth= | Inviter + invitees tree |
| GET | /api/creator-programs?org_id= | List programs for org |
| POST | /api/creator-programs | Create program |
| GET | /api/creator-programs/[id] | Get program + invites |
| PATCH | /api/creator-programs/[id] | Update program |
| DELETE | /api/creator-programs/[id] | Delete program |
| POST | /api/creator-programs/[id]/invites | Add invite(s) (profile_id or profile_ids) |
| PATCH | /api/creator-programs/[id]/invites | Update invite status |

---

## 9. Routes / Components Changed (Pass 2)

| Component / route | Change |
|-------------------|--------|
| CircleDetailPage.tsx | Fetches GET /api/circles/[id]; real members; add-member modal with search; remove member; settings edit/archive/delete; no demo data. |
| CreateCircleFlow.tsx | Real search for members; on create: POST circle then POST members for each selected; no demoMembers; opens from overview. |
| CirclesOverviewPage.tsx | "Create Circle" opens CreateCircleFlow modal; passes me; no quick-create. |
| CircleComponents.tsx | MemberRowCard: avatar_url support; onRemove callback. |
| KOLListsPage.tsx | Loads lists from API; select list; load members; add from search; remove; create list; no demoCreators; "Coming soon" removed. |
| App.tsx | accessAllowed state; runAuthGate calls /api/me/access and sets accessAllowed; when authUserId && !accessAllowed render InviteRequiredView; InviteRequiredView, InviteLineagePage, CreatorProgramsPage; routes inviteLineage, creatorPrograms; nav: Invite lineage, Creator programs, KOL Lists (no "Coming soon"). |
| InviteRequiredView.tsx | New: code input, submit to redeem, onSuccess callback. |
| InviteLineagePage.tsx | New: GET /api/invites/lineage, show inviter + invitees tree. |
| CreatorProgramsPage.tsx | New: select org, list programs, create program. |
| api/circles/route.ts | org_members check: profile_id → user_id. |

---

## 10. Non-Regression Checklist

- Usernames / slug resolution: not modified.  
- /app routing: new routes inviteLineage, creatorPrograms; no breaking changes.  
- Auth flow: invite gate runs after session; existing users with inviter_id or admin see app.  
- Org flows (jobs, applications, deals, reviews): not modified.  
- RLS: org_members references use user_id; new APIs use auth token.  
- Public profile / location / pricing: not modified.  
- Analytics ownership: unchanged; circles/KOL show real counts only.

---

## 11. Acceptance Criteria vs Current State

| # | Criterion | Met? |
|---|-----------|------|
| 1 | Circles are saved and reload correctly | **Yes** |
| 2 | KOL lists are saved and reload correctly | **Yes** |
| 3 | Users and orgs can own circles/lists where intended | **Yes** (profile/org in schema + API) |
| 4 | Creator programs exist and can invite from lists | **Yes** (APIs + minimal UI; bulk invite from circle/KOL in UI optional) |
| 5 | First-time users cannot enter without valid invite code | **Yes** (when LINKARY_INVITE_ONLY=true) |
| 6 | Invite redemption persists inviter/invitee | **Yes** (inviter_id from issued_by_profile_id when set) |
| 7 | Admin unlimited invite behavior | **Yes** (issue API; access API) |
| 8 | Invite batch allocation | **Yes** (POST /api/invites/allocate-batch; admin UI deferred) |
| 9 | Invite lineage queryable and viewable | **Yes** (API + InviteLineagePage) |
| 10 | No demo/mock production data in these flows | **Yes** |
| 11 | RLS and permissions correct | **Yes** |
| 12 | Existing architecture not broken | **Yes** |
| 13 | QA report states complete vs deferred | **Yes** |

---

## 12. Invite Lineage Modeling Decision (Documented)

- **issued_by_type + issued_by_id:** Remain for issuer (profile or org).  
- **issued_by_profile_id:** Added; the human profile who issued the code (for lineage). Set even when code is org-issued.  
- **profiles.inviter_id:** Set on redemption from `invite_codes.issued_by_profile_id` when present, else from `issued_by_id` when `issued_by_type = 'profile'`.  
- Lineage queries use `profiles.inviter_id` for "who invited whom"; org attribution is preserved via `issued_by_type`/`issued_by_id` on the code.

---

**Final:** Circles, KOL lists, invite-only gate, invite issue/allocate/lineage, and creator programs (APIs + minimal UI) are implemented. No production mock data remains in these flows. Admin batch allocation UI and bulk invite-from-circle/KOL in creator programs UI are optional follow-ups.
