# MVP Circles, KOL Lists & Invites — Implementation Plan

**Date:** 2026-03-10  
**Audience:** Engineering execution. Phased, with schema, APIs, UI, invite gate, admin, and QA.

---

## Pass 2 — Completed (Current State)

- **Invite lineage schema:** Added `invite_codes.issued_by_profile_id`; updated `redeem_invite_code` to set `profiles.inviter_id` from it when present. Migration: `20260323000000_invite_issued_by_profile_id.sql`.
- **Circles E2E:** CircleDetailPage wired to GET /api/circles/[id]; real members; add-member search; remove member; settings edit/archive/delete. CreateCircleFlow: real search; after create, POST members for each selected; opens from overview. All demo data removed.
- **KOL Lists E2E:** GET/POST /api/kol-lists, GET/PATCH/DELETE /api/kol-lists/[id], members APIs; KOLListsPage wired; create list, select list, add/remove members from search; no demo creators.
- **Invite-only gate:** After auth, GET /api/me/access; if !allowed, render InviteRequiredView (code input → redeem → allow). No entry to app without valid redemption when LINKARY_INVITE_ONLY=true.
- **Invite issuance:** POST /api/invites/issue (count; cap 500; admin unlimited); POST /api/invites/allocate-batch (admin); GET /api/invites/my-codes.
- **Invite lineage:** GET /api/invites/lineage?depth=; InviteLineagePage (inviter + invitees tree).
- **Creator programs:** CRUD APIs; POST/PATCH /api/creator-programs/[id]/invites; CreatorProgramsPage (select org, list programs, create program).
- **Mock removal:** Circle detail, CreateCircleFlow, KOLListsPage use only real data.

---

## Phase 1 — Schema & Migrations

### 1.1 Circles

- **circles**
  - `id` uuid PK
  - `owner_type` text NOT NULL CHECK (owner_type IN ('profile','org'))
  - `owner_id` uuid NOT NULL (profile id or org id; no FK to two tables — enforce in app or use polymorphic trigger)
  - `name` text NOT NULL
  - `description` text
  - `visibility` text DEFAULT 'private' CHECK (visibility IN ('private','shareable','invite-only'))
  - `status` text DEFAULT 'active' CHECK (status IN ('active','archived','draft'))
  - `created_at`, `updated_at` timestamptz
- **circle_members**
  - `id` uuid PK
  - `circle_id` uuid NOT NULL REFERENCES circles(id) ON DELETE CASCADE
  - `profile_id` uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `added_by` uuid REFERENCES auth.users(id) ON DELETE SET NULL
  - `notes` text
  - `created_at` timestamptz
  - UNIQUE(circle_id, profile_id)

**Ownership:** Profile-owned: owner_id = profile_id = auth.uid(). Org-owned: owner_id = org_id and caller in org_members with role admin/member (or RLS).

### 1.2 KOL Lists

- **kol_lists**
  - `id` uuid PK
  - `owner_type` text NOT NULL CHECK (owner_type IN ('profile','org'))
  - `owner_id` uuid NOT NULL
  - `name` text NOT NULL
  - `description` text
  - `status` text DEFAULT 'active' CHECK (status IN ('active','archived'))
  - `created_at`, `updated_at` timestamptz
- **kol_list_members**
  - `id` uuid PK
  - `kol_list_id` uuid NOT NULL REFERENCES kol_lists(id) ON DELETE CASCADE
  - `profile_id` uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `notes` text
  - `sort_order` int DEFAULT 0
  - `created_at` timestamptz
  - UNIQUE(kol_list_id, profile_id)

### 1.3 Invite system

- **invite_batches**
  - `id` uuid PK
  - `allocated_to_type` text NOT NULL CHECK (allocated_to_type IN ('profile','org'))
  - `allocated_to_id` uuid NOT NULL
  - `count` int NOT NULL CHECK (count > 0)
  - `allocated_by` uuid REFERENCES auth.users(id) ON DELETE SET NULL (admin)
  - `created_at` timestamptz
- **invite_codes**
  - `id` uuid PK
  - `code` text NOT NULL UNIQUE (e.g. 8–12 char alphanumeric)
  - `batch_id` uuid REFERENCES invite_batches(id) ON DELETE SET NULL
  - `issued_by_type` text NOT NULL CHECK (issued_by_type IN ('profile','org'))
  - `issued_by_id` uuid NOT NULL
  - `status` text NOT NULL DEFAULT 'available' CHECK (status IN ('available','reserved','redeemed','expired','revoked'))
  - `reserved_at` timestamptz
  - `expires_at` timestamptz
  - `created_at` timestamptz
- **invite_redemptions**
  - `id` uuid PK
  - `invite_code_id` uuid NOT NULL REFERENCES invite_codes(id) ON DELETE CASCADE
  - `redeemer_profile_id` uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `redeemed_at` timestamptz NOT NULL DEFAULT now()
  - UNIQUE(invite_code_id) (one redemption per code)
- **profiles**
  - Add `inviter_id` uuid REFERENCES profiles(id) ON DELETE SET NULL (set on first redemption for lineage).

**Logic:** Normal users have lifetime cap 500; invites consumed from batches. Admin profile (@muazxinthi → resolve by twitter_username or fixed profile_id) has unlimited: skip cap check when issuing. Batch allocation: admin creates batch for profile/org; that profile/org can then issue codes up to batch count and lifetime cap.

### 1.4 Invite lineage

- Lineage = inviter ↔ invitee: from `profiles.inviter_id` or from `invite_redemptions` JOIN `invite_codes` (issued_by_id = inviter profile_id) JOIN redeemer_profile_id. Tree/depth: recursive CTE on profiles.inviter_id or on redemptions.

### 1.5 Creator programs (MVP minimal)

- **creator_programs**
  - `id` uuid PK
  - `org_id` uuid NOT NULL REFERENCES orgs(id) ON DELETE CASCADE
  - `title` text NOT NULL
  - `description` text
  - `program_type` text (e.g. 'ambassador','affiliate','campaign')
  - `status` text DEFAULT 'draft' CHECK (status IN ('draft','open','closed','archived'))
  - `created_at`, `updated_at` timestamptz
- **creator_program_invites**
  - `id` uuid PK
  - `creator_program_id` uuid NOT NULL REFERENCES creator_programs(id) ON DELETE CASCADE
  - `profile_id` uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE
  - `source_type` text CHECK (source_type IN ('circle','kol_list','manual'))
  - `source_id` uuid (circle_id or kol_list_id if applicable)
  - `status` text NOT NULL DEFAULT 'invited' CHECK (status IN ('invited','accepted','declined','applied','active','removed'))
  - `invited_at` timestamptz
  - `updated_at` timestamptz
  - UNIQUE(creator_program_id, profile_id)

### 1.6 Migration order

1. `20260322100000_circles_and_members.sql` — circles, circle_members, RLS
2. `20260322100001_kol_lists_and_members.sql` — kol_lists, kol_list_members, RLS
3. `20260322100002_invite_system.sql` — invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, RLS
4. `20260322100003_creator_programs.sql` — creator_programs, creator_program_invites, RLS

---

## Phase 2 — RLS & Permissions

- **circles:** SELECT/INSERT/UPDATE/DELETE for owner (profile: owner_id = auth.uid(); org: owner_id in (SELECT org_id FROM org_members WHERE profile_id = auth.uid() AND role IN ('admin','member'))). Same for circle_members (via circle ownership).
- **kol_lists / kol_list_members:** Same ownership pattern.
- **invite_batches:** SELECT for allocated_to_id = auth.uid() (or org member); INSERT only for service_role or admin (allocation). 
- **invite_codes:** SELECT for issued_by_id = auth.uid() (or org); INSERT for issuer when they have capacity; UPDATE status only by issuer or admin. Redeem: anonymous or session can call redeem RPC that checks code and creates redemption + sets profile.inviter_id.
- **invite_redemptions:** SELECT for redeemer or inviter (via code.issued_by_id); INSERT via redeem RPC only.
- **creator_programs:** Org-scoped; org_members admin/member can CRUD. creator_program_invites: org can CRUD; invitee can SELECT own and UPDATE own status (e.g. accept/decline).

---

## Phase 3 — APIs & Backend

### 3.1 Circles

- `GET /api/circles` — list circles for current user/org (query ?owner=profile|org&org_id=)
- `POST /api/circles` — create (body: name, description, owner_type, owner_id, visibility, status)
- `GET /api/circles/[id]` — get one + members
- `PATCH /api/circles/[id]` — update
- `DELETE /api/circles/[id]` — delete (cascade members)
- `POST /api/circles/[id]/members` — add profile_id
- `DELETE /api/circles/[id]/members/[profileId]` — remove

### 3.2 KOL Lists

- `GET /api/kol-lists` — list for current user/org
- `POST /api/kol-lists` — create
- `GET /api/kol-lists/[id]` — get one + members
- `PATCH /api/kol-lists/[id]` — update
- `DELETE /api/kol-lists/[id]` — delete
- `POST /api/kol-lists/[id]/members` — add profile_id (optional notes, sort_order)
- `DELETE /api/kol-lists/[id]/members/[profileId]` — remove

### 3.3 Invites

- `POST /api/invites/allocate-batch` — admin only: allocate batch to profile/org (body: allocated_to_type, allocated_to_id, count)
- `GET /api/invites/my-codes` — list codes issued by me (and my batches)
- `POST /api/invites/issue` — issue one code (consumes from batch/cap); return code string
- `POST /api/invites/redeem` — body: code; caller = new user after sign-up or session; validate code, create redemption, set profile.inviter_id, mark code redeemed
- `GET /api/invites/lineage` — tree/depth for current user (inviter chain + downstream invitees)
- `GET /api/invites/admin/overview` — admin: batches, codes by status, recent redemptions

### 3.4 Creator programs

- `GET /api/orgs/[orgId]/creator-programs` — list
- `POST /api/orgs/[orgId]/creator-programs` — create
- `GET /api/orgs/[orgId]/creator-programs/[programId]` — get + invites
- `PATCH /api/orgs/[orgId]/creator-programs/[programId]` — update
- `POST /api/orgs/[orgId]/creator-programs/[programId]/invite` — invite from circle or KOL list (body: source_type, source_id, profile_ids or use source list members)

### 3.5 First-time access check

- `GET /api/me/access` or extend `GET /api/profile/me` — return `{ allowed: boolean, reason?: 'invite_required' }` when profile exists but has no inviter_id and no redemption (and platform is invite-only). Frontend: if not allowed, show invite code entry page and do not navigate to /app until redeemed.

---

## Phase 4 — Invite-Only Gate

- **Option A (recommended):** After auth callback, before redirect to /app: call `GET /api/me/access`. If `allowed === false` and reason `invite_required`, redirect to `/invite-required` (or `/onboarding?step=invite`) and show form "Enter invite code". On submit, `POST /api/invites/redeem` with code; then set profile.inviter_id and retry access; then redirect to /app.
- **Option B:** Middleware on /app: if session exists but profile has no inviter_id (and invite-only), redirect to invite-required page. Requires one extra DB hit in middleware or cookie flag.
- **Persistence:** On first successful redemption, set `profiles.inviter_id` to issuer profile_id (from invite_codes.issued_by_id). Do not clear later (durable lineage).

### 4.1 Admin unlimited invites

- Config: `LINKARY_INVITE_ADMIN_PROFILE_ID` or resolve @muazxinthi to profile_id once. In issue logic: if issuer profile_id === admin_id, skip batch/cap check and allow issuing without consuming batch.

---

## Phase 5 — Frontend

### 5.1 Circles

- **CirclesOverviewPage:** Remove demoCircles. Fetch from `GET /api/circles`. Show real list; empty state "No circles yet. Create one." Stats row: real counts (total circles, total members across circles) or "—" and no fake analytics.
- **CircleDetailPage:** Route param or route.data.id. Fetch `GET /api/circles/[id]`. Members from API; add/remove via API. Remove demo data.
- **CreateCircleFlow:** On submit, `POST /api/circles` then add members via `POST /api/circles/[id]/members`. Member search: existing `/api/search?filter=people`. Remove demoMembers.
- Remove "Coming soon" banner when feature is live. Nav: "Circles" (no "(Coming soon)").

### 5.2 KOL Lists

- **KOLListsPage:** Remove demoCreators. Fetch `GET /api/kol-lists`; allow create/list/select list. For selected list, fetch members; add via search (`/api/search`); persist with `POST /api/kol-lists/[id]/members`. "No KOLs selected" when list is empty in DB.
- Nav: "KOL Lists" when feature is live.

### 5.3 Invite flow

- **Invite-required page:** New page or step: input invite code, submit → redeem API; on success redirect to /app.
- **Settings or profile:** "Invite others" → show my codes, issue new (calls issue API). Admin: link to allocate batches (or separate admin page).

### 5.4 Invite lineage

- **Lineage view:** New route e.g. `/app/invite-lineage` or under settings: fetch `GET /api/invites/lineage`, render tree or table (inviter → invitee → depth). Optional: simple graph visualization later.

### 5.5 Creator programs

- Org dashboard or new tab: list creator programs; create; for a program, "Invite from Circle" / "Invite from KOL List" using saved circles/KOL lists; show invited/accepted/declined.

---

## Phase 6 — Admin

- **Allocate batches:** Page or API-only: admin allocates batch to profile_id or org_id (count). 
- **Unlimited admin:** @muazxinthi (or configured profile_id) can issue without batch/cap.
- **View codes/redemptions:** Admin endpoint or page: list codes by status, recent redemptions, who invited whom.

---

## Phase 7 — QA & Regression

- Circles: create, add/remove members, archive, delete; reload; no demo data.
- KOL: create list, add/remove from search, reload; no demo creators on live surface.
- Invite: new user cannot enter /app without code; redeem; inviter_id set; lineage visible.
- Admin: allocate batch; issue codes; unlimited for admin.
- Regression: usernames, /app routes, org flows, jobs/applications/deals, reviews, analytics ownership, public privacy (location/pricing).

---

## Deliverables Checklist

- [ ] Migrations: circles, circle_members, kol_lists, kol_list_members, invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, creator_programs, creator_program_invites.
- [ ] RLS on all new tables.
- [ ] APIs: circles CRUD, KOL CRUD, invite allocate/issue/redeem/lineage, creator programs CRUD + invite.
- [ ] Invite-only gate: first-time user must redeem code; inviter_id persisted.
- [ ] Frontend: Circles and KOL pages use real data; no mock; empty states honest.
- [ ] Nav labels updated when features live.
- [ ] Admin: batch allocation; unlimited for @muazxinthi; lineage view.
- [ ] QA report: MVP_CIRCLES_KOL_INVITES_QA_REPORT.md with pass/fail and deferred items.

---

*End of MVP_CIRCLES_KOL_INVITES_IMPLEMENTATION_PLAN.md*
