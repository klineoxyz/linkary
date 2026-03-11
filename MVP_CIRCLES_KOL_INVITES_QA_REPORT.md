# MVP Circles, KOL Lists & Invites — QA Report

**Date:** 2026-03-10  
**Scope:** Launch readiness for Circles, KOL Lists, Invite-only access, Creator programs, and removal of mock data.

---

## 1. Summary Verdict

| Area | Status | Notes |
|------|--------|--------|
| **Circles** | **Implemented (core)** | Schema, RLS, list/create/get/update/delete + members APIs; Circles overview page uses real API; Create Circle persists. Circle detail page still uses demo data — **needs wiring to GET /api/circles/[id]** and member add/remove. |
| **KOL Lists** | **Schema only** | Tables and RLS exist; **no KOL list APIs yet**; KOLListsPage still uses demo creators and does not persist lists. **Deferred.** |
| **Invite system** | **Schema + redeem + access** | invite_batches, invite_codes, invite_redemptions, profiles.inviter_id; RPC redeem_invite_code; POST /api/invites/redeem, GET /api/me/access. **Issue/allocate/lineage APIs and UI not implemented.** Invite-only gate: set LINKARY_INVITE_ONLY=true and add invite-required page in app flow. **Partially implemented.** |
| **Creator programs** | **Schema only** | creator_programs, creator_program_invites + RLS. **No APIs or UI.** **Deferred.** |
| **Mock data removal** | **Circles done; KOL/Detail partial** | Circles overview: demo data removed, real fetch. Circle detail & Create flow: still use demo members in UI; create circle API used. KOL: demo creators still present. |

---

## 2. What Is Fully Complete

- **Audit document:** `MVP_CIRCLES_KOL_INVITES_AUDIT.md` — current state, blockers, files.
- **Implementation plan:** `MVP_CIRCLES_KOL_INVITES_IMPLEMENTATION_PLAN.md` — phases, schema, APIs, UI, admin, QA.
- **Migrations (all runnable):**
  - `20260322100000_circles_and_members.sql` — circles, circle_members, RLS, updated_at trigger.
  - `20260322100001_kol_lists_and_members.sql` — kol_lists, kol_list_members, RLS.
  - `20260322100002_invite_system.sql` — invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, RPC redeem_invite_code, RLS, GRANT EXECUTE.
  - `20260322100003_creator_programs.sql` — creator_programs, creator_program_invites, RLS.
- **Circles APIs:** GET/POST /api/circles; GET/PATCH/DELETE /api/circles/[id]; POST/DELETE /api/circles/[id]/members. Auth via Bearer token; RLS enforced.
- **Invite redeem:** POST /api/invites/redeem (body: { code }); uses RPC redeem_invite_code; sets profile.inviter_id when issuer is profile.
- **Access check:** GET /api/me/access returns { allowed, reason } when LINKARY_INVITE_ONLY=true; admin @muazxinthi allowed without redemption.
- **Circles overview page:** Loads circles from GET /api/circles; creates circle via POST /api/circles; no demo circles; stats show real total circles and total members; "Coming soon" banner removed; nav label "Circles" (no "Coming soon").

---

## 3. What Is Deferred or Partial

| Item | State | To complete |
|------|--------|-------------|
| **Circle detail page** | Still demo circle + demo members | Fetch GET /api/circles/[id]; render real members; add/remove via POST/DELETE members API; remove demoCircleData and demoMembers. |
| **CreateCircleFlow** | Create circle works from overview; flow uses demoMembers for "add members" step | After creating circle, call POST /api/circles/[id]/members for each selected profile from search; remove demoMembers; use /api/search for member search. |
| **KOL Lists APIs** | Not implemented | GET/POST /api/kol-lists; GET/PATCH/DELETE /api/kol-lists/[id]; POST/DELETE members. Same pattern as circles. |
| **KOL Lists page** | Demo creators; search real but lists not saved | Wire to kol-lists APIs when added; persist selected list and members; remove demoCreators; "No KOLs selected" from DB state. |
| **Invite issue / allocate** | Not implemented | POST /api/invites/issue (consume from batch; cap 500; admin unlimited); POST /api/invites/allocate-batch (admin only). |
| **Invite lineage API + UI** | Not implemented | GET /api/invites/lineage (tree from profiles.inviter_id or redemptions); simple table or tree view under settings. |
| **Invite-required page** | Not implemented | After auth callback or on /app load, if INVITE_ONLY and !allowed, redirect to /invite-required; form to submit code → redeem API → redirect to /app. |
| **Admin batch allocation** | Not implemented | Service-role or admin-only endpoint to insert into invite_batches; UI optional. |
| **Creator programs APIs + UI** | Not implemented | CRUD for creator_programs; invite from circle/KOL; creator_program_invites status. |

---

## 4. Migrations List

| Migration | Tables / changes |
|-----------|-------------------|
| 20260322100000_circles_and_members.sql | circles, circle_members, RLS, set_updated_at trigger |
| 20260322100001_kol_lists_and_members.sql | kol_lists, kol_list_members, RLS, trigger |
| 20260322100002_invite_system.sql | invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, redeem_invite_code(), RLS, GRANT |
| 20260322100003_creator_programs.sql | creator_programs, creator_program_invites, RLS, triggers |

---

## 5. APIs Added / Changed

| Method | Path | Purpose |
|--------|------|---------|
| GET | /api/circles | List circles (profile or ?owner=org&org_id=) |
| POST | /api/circles | Create circle |
| GET | /api/circles/[id] | Get circle + members |
| PATCH | /api/circles/[id] | Update circle |
| DELETE | /api/circles/[id] | Delete circle |
| POST | /api/circles/[id]/members | Add member (body: profile_id, notes?) |
| DELETE | /api/circles/[id]/members?profile_id= | Remove member |
| POST | /api/invites/redeem | Redeem code (body: { code }) |
| GET | /api/me/access | Access check for invite-only (allowed, reason) |

---

## 6. Routes / Pages / Components Changed

| Path / component | Change |
|------------------|--------|
| CirclesOverviewPage.tsx | Removed demoCircles and statsData; load circles from GET /api/circles; create via POST /api/circles; real stats (counts); "Coming soon" removed. |
| App.tsx | Nav label "Circles" (no "Coming soon"). |
| (No change yet) | CircleDetailPage, CreateCircleFlow, KOLListsPage — still use demo data; to be wired in follow-up. |

---

## 7. Non-Regression Checklist

- **Usernames / slug resolution:** Not modified; no regression expected.
- **/app routing:** No structural change; circles and kol-lists routes unchanged.
- **Auth flow:** No change to callback or post-login-bootstrap; invite gate not yet applied (no redirect to invite-required).
- **Org flows (jobs, applications, deals, reviews):** Not modified.
- **RLS:** New tables have RLS; existing tables unchanged.
- **Public profile / location / pricing:** Not modified.
- **Analytics ownership:** Deep analytics remain under /analytics; circles page shows only real counts (no fake analytics).

---

## 8. Open Risks

1. **Invite-only not enforced in UI:** Until an invite-required page exists and is shown for first-time users when LINKARY_INVITE_ONLY=true, the platform remains open after sign-in.
2. **Circle detail and Create flow:** Still show demo members; users can create circles but adding members from the detail/create flow requires wiring to members API and search.
3. **KOL lists:** No persistence; users cannot save lists yet; "Coming soon" can remain on nav until KOL APIs and page are wired.
4. **Admin invite allocation:** No way to allocate batches or issue codes except via DB or future admin API.

---

## 9. Follow-Up Recommendations (Post-MVP)

1. **Wire Circle detail page** to GET /api/circles/[id], add/remove members, and remove all demo data.
2. **Wire CreateCircleFlow** to add members via POST /api/circles/[id]/members after create; use /api/search for member picker.
3. **Implement KOL list APIs** and KOLListsPage persistence; remove demo creators.
4. **Implement invite issue and allocate-batch** APIs; admin UI for batch allocation; "Invite others" UI for issuing codes.
5. **Add invite-required page** and gate: after auth or on /app entry, if INVITE_ONLY and !allowed, show code entry → redeem → redirect.
6. **Implement invite lineage** API and a simple lineage view (table or tree).
7. **Creator programs:** APIs and org UI to create programs and invite from circles/KOL lists; track status.

---

## 10. Acceptance Criteria vs Current State

| # | Criterion | Met? |
|---|-----------|------|
| 1 | Circles are saved and reload correctly | **Yes** (list + create; detail page not yet wired) |
| 2 | KOL lists are saved and reload correctly | **No** — schema only |
| 3 | Users and orgs can own circles/lists where intended | **Yes** for circles (profile/org ownership in schema + API) |
| 4 | Creator programs exist and can invite from lists | **No** — schema only |
| 5 | First-time users cannot enter without valid invite code | **No** — gate and invite-required page not implemented |
| 6 | Invite redemption persists inviter/invitee | **Yes** — RPC and profile.inviter_id |
| 7 | Admin unlimited invite behavior | **Partial** — access API allows @muazxinthi; issue API not built |
| 8 | Invite batch allocation | **No** — no API or UI |
| 9 | Invite lineage queryable and viewable | **No** — no API or UI |
| 10 | No demo/mock production data in these flows | **Partial** — Circles overview real; Circle detail & KOL still have demo |
| 11 | RLS and permissions correct | **Yes** for new tables |
| 12 | Existing architecture not broken | **Yes** — no breaking changes |
| 13 | QA report states complete vs deferred | **Yes** — this section |

---

**Final:** Core Circles persistence and APIs are in place and the Circles overview page uses real data. Invite redemption and access check are implemented; full invite-only gate, KOL persistence, creator programs, and lineage are deferred. No mock data remains on the Circles overview; Circle detail and KOL pages still need wiring and demo removal in follow-up.
