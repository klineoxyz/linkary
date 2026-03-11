# MVP Circles, KOL Lists & Invites — Audit (Current State)

**Date:** 2026-03-10  
**Purpose:** Single source of truth for what exists today. No stale or contradictory content.

---

## 1. Executive Summary

| Area | Backend | UI | Notes |
|------|---------|-----|--------|
| **Circles** | Schema, RLS, full CRUD + members APIs | Overview, detail, create flow, add/remove members; all real data | Org-owned circles: API supports; CreateCircleFlow UI is profile-only (org type shows error). |
| **KOL Lists** | Schema, RLS, full CRUD + members APIs | Lists, create, select list, add/remove members from search; all real data | Org-owned: API supports; KOLListsPage creates profile-owned only. |
| **Platform Invites** | Batches, codes, redemptions, `issued_by_profile_id`; redeem RPC; access, issue, allocate-batch, my-codes, lineage APIs | InviteRequiredView when gated; InviteLineagePage | Gate enforced in App when `LINKARY_INVITE_ONLY=true` and `/api/me/access` returns not allowed. |
| **Creator Programs** | Schema, RLS, CRUD + invites APIs | CreatorProgramsPage: select org, list programs, create program | No program-detail page; no “invite from circle/KOL” in UI (API supports it). |

**Architecture preserved:** Usernames namespace, public vs /app URLs, RLS patterns, analytics ownership, org model, auth flow (gate added after session).

---

## 2. Circles

- **Tables:** `circles` (owner_type, owner_id, name, description, visibility, status), `circle_members` (circle_id, profile_id, added_by, notes). RLS: owner (profile or org member) can full CRUD.
- **APIs:** GET/POST `/api/circles`; GET/PATCH/DELETE `/api/circles/[id]`; POST/DELETE `/api/circles/[id]/members`.
- **UI:** CirclesOverviewPage (loads list, create opens CreateCircleFlow); CircleDetailPage (loads by id, members, add via search, remove, settings edit/archive/delete); CreateCircleFlow (name, type, visibility, search members, create then POST members). All use real APIs; no demo data.
- **Org-owned:** API accepts `owner_type: 'org'`, `owner_id: org_id`. CreateCircleFlow does not support org: choosing “Organization” shows error “Use a personal circle for now.”

---

## 3. KOL Lists

- **Tables:** `kol_lists`, `kol_list_members`. RLS: owner (profile or org member) full CRUD.
- **APIs:** GET/POST `/api/kol-lists`; GET/PATCH/DELETE `/api/kol-lists/[id]`; POST/DELETE `/api/kol-lists/[id]/members`.
- **UI:** KOLListsPage: load lists, create list (profile-owned), select list, load members, search and add, remove. No demo creators.
- **Org-owned:** API supports; UI only creates profile-owned lists.

---

## 4. Platform Invites

- **Tables:** `invite_batches`, `invite_codes` (includes `issued_by_profile_id` for human inviter), `invite_redemptions`; `profiles.inviter_id`. RPC `redeem_invite_code` sets `inviter_id` from `issued_by_profile_id` when set, else from `issued_by_id` when issuer is profile.
- **APIs:** POST `/api/invites/redeem`; GET `/api/me/access`; POST `/api/invites/issue`; POST `/api/invites/allocate-batch` (admin); GET `/api/invites/my-codes`; GET `/api/invites/lineage`.
- **Gate:** In App, after auth, GET `/api/me/access`. If `authUserId` set and `allowed === false`, render InviteRequiredView (code input → redeem → then setAccessAllowed(true)). No separate URL for invite-required; it is an in-app view when gated.
- **Admin:** @muazxinthi (twitter_username) bypasses access check and has unlimited issue (no cap in issue API).

---

## 5. Creator Programs

- **Tables:** `creator_programs` (org_id, title, description, program_type, status), `creator_program_invites` (program, profile, source_type, source_id, status).
- **APIs:** GET/POST `/api/creator-programs?org_id=`; GET/PATCH/DELETE `/api/creator-programs/[id]`; POST/PATCH `/api/creator-programs/[id]/invites`.
- **UI:** CreatorProgramsPage: dropdown of user’s orgs, list programs for selected org, create program. No program-detail page; no UI to add invites from a circle/KOL list (API accepts profile_id/profile_ids and source_type/source_id).

---

## 6. Route Coverage (Direct Load)

- **Next.js pages:** `app/app/circles/page.tsx`, `app/app/kol-lists/page.tsx`, `app/app/invites/lineage/page.tsx`, `app/app/creator-programs/page.tsx` — each renders `AppWithProviders` (LinkaryApp).
- **Pathname → route:** `routeFromPathname` in App.tsx: `circles`→circles, `kol-lists`→kolLists; `invites`+`lineage`→inviteLineage; `creator-programs`→creatorPrograms (RESERVED_PATHS includes `invites`, `creator-programs`; nameMap includes `creator-programs`).
- **Invite-required:** No dedicated route; shown as full-screen view when gated inside App.

---

## 7. Reusable Building Blocks

- Search: `/api/search?q=...&filter=people` — used for circle/KOL add-member.
- Connections: `/api/connections/list` — used on Circles overview.
- Org membership: `org_members` (user_id) — used for org-owned circles, KOL lists, creator programs, and invite batch allocation.

---

## 8. What Is Not Done (Honest Gaps)

- **Org-owned circle creation in UI:** CreateCircleFlow has no org picker; org type shows error.
- **Org-owned KOL list creation in UI:** KOLListsPage only sends `owner_type: 'profile'`.
- **Creator program detail UI:** No page to open a program, see invites, or add invites; API supports it.
- **Invite-from-circle/KOL in creator programs UI:** Not implemented; API supports source_type/source_id.
- **Admin batch-allocation UI:** Allocate-batch is API-only.
- **Invite-required as a dedicated route:** Not implemented; gate is in-app view only.

---

*End of Audit. See MVP_CIRCLES_KOL_INVITES_IMPLEMENTATION_PLAN.md and MVP_CIRCLES_KOL_INVITES_QA_REPORT.md for plan and verification.*
