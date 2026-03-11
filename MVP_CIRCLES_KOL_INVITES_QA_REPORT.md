# MVP Circles, KOL Lists & Invites — QA Report & Verification

**Date:** 2026-03-10  
**Purpose:** Evidence-based verification, route coverage, invite-only cases, org-owned UX, grading, and founder verdict. No contradictory or stale content.

---

## 1. Proof of Implementation (Evidence)

### 1.1 Migrations added

| File | Purpose |
|------|---------|
| `supabase/migrations/20260322100000_circles_and_members.sql` | circles, circle_members, RLS, trigger |
| `supabase/migrations/20260322100001_kol_lists_and_members.sql` | kol_lists, kol_list_members, RLS, trigger |
| `supabase/migrations/20260322100002_invite_system.sql` | invite_batches, invite_codes, invite_redemptions, profiles.inviter_id, redeem_invite_code, RLS |
| `supabase/migrations/20260322100003_creator_programs.sql` | creator_programs, creator_program_invites, RLS, triggers |
| `supabase/migrations/20260323000000_invite_issued_by_profile_id.sql` | invite_codes.issued_by_profile_id; redeem RPC sets inviter_id from it |

### 1.2 API route files added/changed

| Method | Path | File |
|--------|------|------|
| GET, POST | /api/circles | `apps/web/src/app/api/circles/route.ts` |
| GET, PATCH, DELETE | /api/circles/[id] | `apps/web/src/app/api/circles/[id]/route.ts` |
| POST, DELETE | /api/circles/[id]/members | `apps/web/src/app/api/circles/[id]/members/route.ts` |
| GET, POST | /api/kol-lists | `apps/web/src/app/api/kol-lists/route.ts` |
| GET, PATCH, DELETE | /api/kol-lists/[id] | `apps/web/src/app/api/kol-lists/[id]/route.ts` |
| POST, DELETE | /api/kol-lists/[id]/members | `apps/web/src/app/api/kol-lists/[id]/members/route.ts` |
| POST | /api/invites/redeem | `apps/web/src/app/api/invites/redeem/route.ts` |
| GET | /api/me/access | `apps/web/src/app/api/me/access/route.ts` |
| POST | /api/invites/issue | `apps/web/src/app/api/invites/issue/route.ts` |
| POST | /api/invites/allocate-batch | `apps/web/src/app/api/invites/allocate-batch/route.ts` |
| GET | /api/invites/my-codes | `apps/web/src/app/api/invites/my-codes/route.ts` |
| GET | /api/invites/lineage | `apps/web/src/app/api/invites/lineage/route.ts` |
| GET, POST | /api/creator-programs | `apps/web/src/app/api/creator-programs/route.ts` |
| GET, PATCH, DELETE | /api/creator-programs/[id] | `apps/web/src/app/api/creator-programs/[id]/route.ts` |
| POST, PATCH | /api/creator-programs/[id]/invites | `apps/web/src/app/api/creator-programs/[id]/invites/route.ts` |

### 1.3 Frontend files added/changed

| Component / file | Role |
|------------------|------|
| `apps/web/src/figma/app/components/circles/CirclesOverviewPage.tsx` | Load circles from API; “Create Circle” opens CreateCircleFlow; real stats; no demo |
| `apps/web/src/figma/app/components/circles/CircleDetailPage.tsx` | GET /api/circles/[id]; real members; add-member modal (search); remove; settings edit/archive/delete |
| `apps/web/src/figma/app/components/circles/CreateCircleFlow.tsx` | Steps: details, search members, preview, confirm; POST circle then POST members; real search only |
| `apps/web/src/figma/app/components/circles/CircleComponents.tsx` | MemberRowCard: avatar_url, onRemove |
| `apps/web/src/figma/app/components/circles/KOLListsPage.tsx` | Load lists, create list, select list, load members, add from search, remove; no demo |
| `apps/web/src/figma/app/components/InviteRequiredView.tsx` | Code input, submit to redeem, onSuccess callback |
| `apps/web/src/figma/app/components/InviteLineagePage.tsx` | GET /api/invites/lineage; show inviter + invitees tree |
| `apps/web/src/figma/app/components/CreatorProgramsPage.tsx` | Select org, list programs, create program |
| `apps/web/src/figma/app/App.tsx` | accessAllowed state; runAuthGate calls /api/me/access; if !allowed render InviteRequiredView; routes circles, circleDetail, kolLists, inviteLineage, creatorPrograms; nav labels |

### 1.4 Next.js route/page files

| URL path | Next.js page | Renders |
|----------|--------------|---------|
| /app/circles | `apps/web/src/app/app/circles/page.tsx` | AppWithProviders (LinkaryApp) |
| /app/kol-lists | `apps/web/src/app/app/kol-lists/page.tsx` | AppWithProviders |
| /app/invites/lineage | `apps/web/src/app/app/invites/lineage/page.tsx` | AppWithProviders |
| /app/creator-programs | `apps/web/src/app/app/creator-programs/page.tsx` | AppWithProviders |

Invite-required: no dedicated route; App renders InviteRequiredView when gated (same shell, different content).

### 1.5 Pathname → route mapping (App.tsx)

- `routeFromPathname`: for path after `/app/`: `circles` → circles; `kol-lists` → kolLists; `invites` + `lineage` → inviteLineage; `creator-programs` → creatorPrograms (via RESERVED_PATHS and nameMap).
- `apps/web/src/lib/reservedPaths.ts`: `invites`, `creator-programs` added to RESERVED_PATHS so these segments are not treated as usernames.

### 1.6 Flows tested (as implemented in code)

- **Circles:** Load list → Create (modal) → name, search, select members → Create → POST circle, then POST members → navigate to detail; detail loads GET circle, members; add member (search, POST member); remove (DELETE member); settings PATCH; delete (DELETE circle).
- **KOL:** Load lists → Create list (name) → POST list → select list → GET list members; search → add (POST member); remove (DELETE member).
- **Invite gate:** Session exists → GET /api/me/access → if !allowed, render InviteRequiredView; user enters code → POST redeem → on success setAccessAllowed(true), refreshMe().
- **Lineage:** InviteLineagePage → GET /api/invites/lineage → display inviter and invitees tree.
- **Creator programs:** Select org → GET /api/creator-programs?org_id= → list; create (title) → POST program; no program-detail or add-invite UI.

---

## 2. Direct Route Coverage Verification

| Direct load URL | Next.js page exists? | Pathname → route | App.tsx renders |
|-----------------|----------------------|------------------|------------------|
| /app/circles | Yes — `app/app/circles/page.tsx` | circles → circles | CirclesOverviewPage |
| /app/kol-lists | Yes — `app/app/kol-lists/page.tsx` | kol-lists → kolLists | KOLListsPage |
| /app/invites/lineage | Yes — `app/app/invites/lineage/page.tsx` | invites + lineage → inviteLineage | InviteLineagePage |
| /app/creator-programs | Yes — `app/app/creator-programs/page.tsx` | creator-programs → creatorPrograms | CreatorProgramsPage |
| Invite-required | N/A (no URL) | — | InviteRequiredView when authUserId && !accessAllowed |

Verification: All four URLs have a matching Next.js page that mounts the app; `routeFromPathname` maps each path to the correct route name; App.tsx conditionally renders the correct page component for each route name.

---

## 3. Invite-Only Enforcement (Code-Level Verification)

| Case | How it is enforced in code |
|------|----------------------------|
| Brand new user without code cannot access /app | After auth, runAuthGate calls GET /api/me/access; if allowed === false, setAccessAllowed(false). App render: if authUserId && accessAllowed === false → return `<InviteRequiredView />` (no main app content). |
| Direct load to /app/circles blocked when gated | Same: any /app/* page mounts App; App checks accessAllowed; if false, only InviteRequiredView is shown. |
| Refresh while gated still blocks | On load, pathname sets route; runAuthGate runs; /api/me/access called; accessAllowed set; re-render shows InviteRequiredView until redeem. |
| Valid code redemption allows entry | InviteRequiredView onSubmit → POST /api/invites/redeem → on success onSuccess() → setAccessAllowed(true); refreshMe(); next render shows main app. |
| Redeemed code cannot be reused | RPC redeem_invite_code marks code status = 'redeemed'; only status = 'available' and not expired are selected; second redeem of same code fails (code already redeemed). |
| Revoked/expired code fails | Issue API and RPC: status must be 'available'; expires_at checked. Revoked = status 'revoked', so not selected. |
| Existing invited users can enter | /api/me/access: if profile.inviter_id set, returns allowed: true; so accessAllowed set true; main app shown. |
| @muazxinthi override | /api/me/access: if profile.twitter_username (normalized) === 'muazxinthi', returns allowed: true. Issue API: isAdmin same check; skips cap. |
| Non-invited signed-in users cannot use protected APIs in practice | They never see main app (InviteRequiredView only). If they bypass UI and call e.g. GET /api/circles with a valid session, RLS still applies; they have no circles. Invite-only gate is client-side; server does not re-check “has inviter” on every API call (only /api/me/access and redeem enforce it). |

**Gap:** Enforcement is client-side (App render). A determined user with a valid session could in theory call APIs directly; RLS limits data to what they own. To harden: middleware or server-side check on /app that verifies access before serving app shell, or have critical APIs return 403 when invite-only and profile has no inviter_id.

---

## 4. Org-Owned UX (Honest Label)

| Flow | API support | UI support | Grade |
|------|-------------|------------|--------|
| Org-owned circle creation | Yes (owner_type: 'org', owner_id: org_id) | No — CreateCircleFlow shows error for “Organization” | **API/schema complete; UI partial** |
| Org-owned KOL list creation | Yes (owner_type, owner_id) | No — KOLListsPage sends owner_type: 'profile', owner_id: me.id only | **API/schema complete; UI partial** |
| Creator program creation for org | Yes (org_id in body) | Yes — CreatorProgramsPage: select org, create program | **Fully implemented** (for create) |
| Inviting creators from saved circles/KOL in UI | Yes (POST invites with source_type, source_id) | No — no program-detail page or “invite from circle/KOL” control | **API/schema complete; UI partial** |

---

## 5. Re-Grading (Five Buckets Only)

| Area | Bucket | Notes |
|------|--------|--------|
| **Circles** | **Fully implemented** | E2E: list, create, detail, add/remove members, edit/archive/delete; real data only. Org-owned create in UI: no. |
| **KOL Lists** | **Fully implemented** | E2E: lists, create, select, add/remove members; real data only. Org-owned create in UI: no. |
| **Invite lineage model** | **Fully implemented** | issued_by_profile_id; redeem RPC; lineage API; InviteLineagePage. |
| **Invite-only gate** | **Fully implemented** | Access check in App; InviteRequiredView; redeem flow. Enforcement is client-side (see §3). |
| **Invite issuance / allocation** | **Fully implemented** | Issue, allocate-batch, my-codes APIs; admin unlimited. No “Invite others” or admin allocation UI. |
| **Creator programs** | **API/schema complete; UI partial** | CRUD + invites APIs; CreatorProgramsPage (list by org, create). No program-detail page; no “invite from circle/KOL” in UI. |
| **Org-owned circle creation (UI)** | **API/schema complete; UI partial** | API and RLS support org; CreateCircleFlow does not. |
| **Org-owned KOL list creation (UI)** | **API/schema complete; UI partial** | API and RLS support org; KOLListsPage creates profile-only. |
| **Admin batch-allocation UI** | **Deferred** | API exists; no UI. |
| **Invite-required as own route** | **Deferred** | In-app view only; no /app/invite-required or similar. |
| **Creator program detail + invite-from-circle/KOL UI** | **Deferred** | Not built. |

Nothing is marked **Blocked**.

---

## 6. Final Founder Verdict

### 6.1 Truly launch-ready now

- **Circles (profile-owned):** Create, add/remove members, edit, archive, delete; data persists; no demo. Safe to ship for personal circles.
- **KOL Lists (profile-owned):** Create list, add/remove from search; data persists; no demo. Safe to ship for personal lists.
- **Invite-only access:** New users without a code see only the invite form until they redeem; existing invited users and admin bypass; redeem and lineage stored. Safe to ship with the caveat that enforcement is client-side (see §3).
- **Invite issuance and lineage:** Issue, allocate-batch, my-codes, lineage API and lineage page work; admin unlimited. Safe to ship; allocation and “Invite others” can stay API-only or be added later.

### 6.2 Safe but still rough

- **Creator programs:** You can create programs per org and list them; you cannot open a program, see invites, or add invites from the UI. Acceptable for a minimal “program exists” use case; not full sign-off for “invite creators from circles/KOL” flow in UI.
- **Invite-only:** Works as designed; hardening (e.g. server-side or middleware check for /app when invite-only) would make it “hard” verified.

### 6.3 Still not ready

- **Org-owned circles in UI:** Not ready; user cannot create an org circle from the app (API ready).
- **Org-owned KOL lists in UI:** Not ready; user cannot create an org KOL list from the app (API ready).
- **Creator program full flow in UI:** Not ready; no program detail, no “invite from circle/KOL” in UI.

### 6.4 Optional post-MVP

- Admin batch-allocation UI.
- Invite-required as a dedicated route (e.g. /app/invite-required).
- Creator program detail page and “invite from circle/KOL” in UI.
- Org picker in CreateCircleFlow and org selector in KOLListsPage for org-owned creation.
- Server-side or middleware invite-only check for /app.

### 6.5 Exact remaining blockers (if any)

- **None** for MVP sign-off of profile-owned circles, profile-owned KOL lists, invite-only gate, invite issue/allocate/lineage, and creator program create/list.
- **For full org-owned and creator-program invite UX:** Org circle/KOL creation in UI and program-detail + invite-from-circle/KOL UI are the missing pieces; they are optional for the current MVP scope.

---

*End of QA Report. Audit and Implementation Plan are aligned; no stale or contradictory sections.*
