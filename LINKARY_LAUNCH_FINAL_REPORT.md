# Linkary Launch — Final Current-State Report

**Date:** 10 March 2025  
**Purpose:** Single source of truth for launch readiness. No future plans; current state and evidence only.

---

## 1. Current state

- **One work system:** Jobs & Sprints and Creator Programs live in the same surface (Market pills; Org Jobs tab with jobs, sprints, creator programs).
- **Circles and KOL lists:** Profile- and org-owned; APIs and UI support create, list, and use in recruiting.
- **Invite-only onboarding:** Issuance, redemption, lineage, and admin allocate exist. Server-side gate runs in middleware when `LINKARY_INVITE_ONLY=true`.
- **Recruiting workflow:** Org opens work item (job/sprint/creator program) from Org Jobs tab; creator programs support invite from Circle/KOL with source and status; jobs/sprints show applicants and accept/reject/close.

---

## 2. Implemented items (with evidence)

### 2.1 Server-side invite-only gate (middleware)

| Item | Detail |
|------|--------|
| **File** | `apps/web/middleware.ts` |
| **Behavior** | When `LINKARY_INVITE_ONLY=true` and path starts with `/app`: read session from cookies (`createServerClient`), load profile (inviter_id, twitter_username) with user JWT; if not allowed (no inviter_id and not admin `muazxinthi`), redirect to `/app` unless path is exactly `/app` or `/app/` (then `NextResponse.next()` so client can show InviteRequiredView). |
| **Redirect-loop fix** | Blocked users on exact `/app` are **not** redirected; they are allowed through so the client renders InviteRequiredView. Blocked users on any other `/app/*` are redirected to `/app` once. |
| **API** | None; uses Supabase session + `profiles` select. |

### 2.2 Work item detail — Creator program

| Item | Detail |
|------|--------|
| **Component** | `apps/web/src/figma/app/components/CreatorProgramDetailDrawer.tsx` |
| **Opened from** | `OrgDetailPage` (Org Jobs tab) → "Manage" on a creator program row → `setSelectedProgramId` → drawer mounts. |
| **APIs** | `GET /api/creator-programs/:id` (program + invites), `GET /api/circles`, `GET /api/circles?owner=org&org_id=`, `GET /api/circles/:id` (members), `GET /api/kol-lists`, `GET /api/kol-lists?owner=org&org_id=`, `GET /api/kol-lists/:id` (members), `POST /api/creator-programs/:id/invites` (profile_ids, source_type, source_id), `PATCH /api/creator-programs/:id/invites` (profile_id, status), `PATCH /api/creator-programs/:id` (status). |
| **User flow** | Org → Org detail → Jobs tab → Creator programs list → Manage → drawer: overview, status, invited creators (status + source), Invite from Circle / Invite from KOL (bulk select, POST invites), status dropdown per invite and for program. |

### 2.3 Work item detail — Job / Sprint

| Item | Detail |
|------|--------|
| **Component** | Inline drawer in `apps/web/src/figma/app/components/OrgDetailPage.tsx` (selectedJobId state). |
| **Opened from** | Org Jobs tab → "Manage" on job/sprint row. |
| **APIs** | Existing job fetch and `listApplicationsForJobs`; accept/reject/close as already implemented. |
| **User flow** | Org → Org detail → Jobs tab → Jobs/Sprints list → Manage → drawer: title, type, description, budget, duration, tags, applicants list with Accept/Reject, View in Marketplace, Close job. |

### 2.4 Invite from Circle / KOL into creator program

| Item | Detail |
|------|--------|
| **Where** | Inside `CreatorProgramDetailDrawer`: "Invite from Circle" and "Invite from KOL list" sections. |
| **APIs** | Circles/KOL as in 2.2; `POST /api/creator-programs/:id/invites` with `source_type: "circle"` or `"kol_list"` and `source_id`. |
| **User flow** | In program drawer → choose Circle or KOL list (org + profile lists) → load members → bulk-select (already-invited excluded) → Invite selected → invites persist with source; list shows source in UI. |

### 2.5 Org-owned circles UI

| Item | Detail |
|------|--------|
| **Components** | `apps/web/src/figma/app/components/circles/CreateCircleFlow.tsx` (org type + org dropdown; `myOrgs` prop); `apps/web/src/figma/app/components/circles/CirclesOverviewPage.tsx` (loads profile circles + per-org `GET /api/circles?owner=org&org_id=`). |
| **APIs** | `POST /api/circles` with `owner_type: "org"`, `owner_id: selectedOrgId`; `GET /api/circles?owner=org&org_id=`. |
| **User flow** | Circles page → Create circle → type "organization" → select org → create; overview shows personal and org circles; org circles used in program drawer "Invite from Circle". |

### 2.6 Org-owned KOL lists UI

| Item | Detail |
|------|--------|
| **Component** | `apps/web/src/figma/app/components/circles/KOLListsPage.tsx` (create modal: "Create as organization list" + org dropdown; loads profile lists + per-org `GET /api/kol-lists?owner=org&org_id=`). |
| **APIs** | `POST /api/kol-lists` with `owner_type: "org"`, `owner_id: createOrgId`; `GET /api/kol-lists?owner=org&org_id=`. |
| **User flow** | KOL Lists page → Create list → create as org + select org → create; list shows personal and org lists; org lists in program drawer "Invite from KOL list". |

### 2.7 Admin invite ops UI

| Item | Detail |
|------|--------|
| **Component** | `apps/web/src/figma/app/components/AdminInvitesPage.tsx` |
| **Route** | `route.name === "adminInvites"` → path `/app/admin/invites`; `apps/web/src/app/app/admin/invites/page.tsx` renders app shell. |
| **Routing** | `routeFromPathname`: `parts[0]==="admin" && parts[1]==="invites"` → `{ name: "adminInvites" }`; `ALLOWED_ROUTES` includes `"adminInvites"`. |
| **APIs** | `POST /api/invites/allocate-batch` (allocated_to_type, allocated_to_id, count); `GET /api/invites/my-codes`. |
| **Access** | Rendered for any user who reaches the route; page checks `me.twitter_username` (normalized) === `"muazxinthi"` and shows "Access restricted" otherwise. |
| **User flow** | Founder → /app/admin/invites → Allocate batch form; My issued codes list; link to Invite lineage. |

### 2.8 Dead code / cleanup

| Item | Detail |
|------|--------|
| **CreatorProgramsPage** | `apps/web/src/figma/app/components/CreatorProgramsPage.tsx` — deprecated (JSDoc); not imported or rendered; creator programs shown via Market with view=creator_programs. |
| **Path map** | `creatorPrograms` removed from `pathFromRoute` in `App.tsx`; `/app/creator-programs` still maps to market view in `routeFromPathname`. |

---

## 3. Partial items

| Item | State |
|------|--------|
| **Admin invite ops** | Allocate batch and my-codes implemented; "who invited whom" is link to existing Invite lineage page. Redeemed/revoked code filters or dedicated list not built. |
| **Invite lineage** | Full page at `/app/invites/lineage`; linked from admin page; no change in this pass. |

---

## 4. Deferred items

| Item | Note |
|------|------|
| Invite-from-circle for **jobs/sprints** | MVP uses applicants only; creator programs have full invite-from-circle/KOL. |
| Deeper admin analytics | Invite quality/activity inspection. |
| Graph/network view polish | Accepted as-is for MVP. |

---

## 5. Route behavior (invite gate)

| Scenario | Middleware | Client |
|----------|------------|--------|
| Path exactly `/app` or `/app/`, signed-in, not allowed | `NextResponse.next()` (no redirect) | App loads; `runAuthGate` → `/api/me/access` → `allowed: false` → `InviteRequiredView` |
| Path `/app/circles` (or any other `/app/*`), signed-in, not allowed | Redirect 302 to `/app` | Next request is `/app` → as above |
| Path `/app` or any `/app/*`, signed-in, allowed (inviter_id set or admin) | `NextResponse.next()` | Normal app; no InviteRequiredView |
| No session | `NextResponse.next()` | Login/landing as per existing flow |

---

## 6. Final verification matrix (code-derived)

| Flow | Verification |
|------|--------------|
| Blocked signed-in user hits `/app` | Middleware: pathname `/app` → allowed false, `isAppRoot` true → return response. No redirect. Client shows InviteRequiredView. |
| Blocked signed-in user hits `/app/circles` | Middleware: allowed false, not app root → redirect to `/app`. Next request `/app` → as above. |
| Blocked signed-in user refresh on `/app` | Same as first row. |
| Invited user (inviter_id set) | Middleware: allowed true → next(). Client accessAllowed true; normal app. |
| Admin (twitter_username muazxinthi) | Middleware: allowed true → next(). Normal app. |
| Direct load `/app/admin/invites` | If allowed: pathname → route adminInvites → AdminInvitesPage. If blocked: redirected to `/app` first. |
| Org-owned circle creation | CreateCircleFlow: type organization, selectedOrgId, POST /api/circles owner_type org, owner_id. CirclesOverviewPage loads org circles. |
| Org-owned KOL list creation | KOLListsPage: createAsOrg, createOrgId, POST /api/kol-lists owner_type org, owner_id. Lists loaded with owner=org&org_id=. |
| Creator program detail / manage | OrgDetailPage Jobs tab → Manage program → CreatorProgramDetailDrawer; GET program + invites; status and invite actions. |
| Invite from Circle into program | Drawer: load circles (incl. org), pick circle, GET members, bulk select, POST invites with source_type circle, source_id. |
| Invite from KOL list into program | Drawer: load KOL lists (incl. org), pick list, GET members, bulk select, POST invites with source_type kol_list, source_id. |
| Work item status persistence | Creator program: PATCH program status, PATCH invite status. Job/sprint: existing accept/reject/close. |
| No mock/demo data in these flows | Components use real APIs and persisted DB; no mock flags in CreatorProgramDetailDrawer, OrgDetailPage, CreateCircleFlow, KOLListsPage, AdminInvitesPage. |

---

## 7. QA evidence (file-level)

- **Middleware:** `apps/web/middleware.ts` — invite block, `isAppRoot` check (lines 142–149).
- **Creator program drawer:** `CreatorProgramDetailDrawer.tsx` — open by programId/orgId; load program, invites, circles, kol-lists; POST/PATCH invites; PATCH program.
- **Org detail:** `OrgDetailPage.tsx` — Manage program → setSelectedProgramId, CreatorProgramDetailDrawer; Manage job → selectedJobId, job drawer; list creator programs and jobs from APIs.
- **Circles:** `CreateCircleFlow.tsx` — formData.type organization, selectedOrgId, myOrgs; POST /api/circles with owner_type/owner_id. `CirclesOverviewPage.tsx` — listMyOrgs, GET /api/circles?owner=org&org_id=, merge with profile circles.
- **KOL:** `KOLListsPage.tsx` — createAsOrg, createOrgId, POST /api/kol-lists; load org lists with owner=org&org_id=.
- **Admin:** `AdminInvitesPage.tsx` — allowed = (me.twitter_username === "muazxinthi"); allocate form POST allocate-batch; GET my-codes; link to invite lineage. `App.tsx` — route adminInvites, path /app/admin/invites, ALLOWED_ROUTES, render AdminInvitesPage.
- **Access:** `App.tsx` — runAuthGate calls GET /api/me/access; authUserId && accessAllowed === false → InviteRequiredView. `apps/web/src/app/api/me/access/route.ts` — inviter_id or admin → allowed.

---

## 8. Founder verdict (sign-off)

| Status | Items |
|--------|--------|
| **Fully implemented** | Server-side invite gate (middleware, no redirect loop); work item detail (creator program drawer + job/sprint drawer); invite from Circle and KOL in program drawer with source and status; org-owned circles create/manage and use in recruiting; org-owned KOL lists create/manage and use in recruiting; admin invite ops page (allocate batch, my codes, lineage link); route /app/admin/invites and access control; dead code isolated (CreatorProgramsPage deprecated, path map cleaned). |
| **API/schema complete; UI partial** | Admin: allocate + my-codes + lineage link; no separate redeemed/revoked code list UI. |
| **Deferred** | Invite-from-circle for jobs/sprints; invite quality/activity analytics; graph polish. |
| **Blocked** | None. |

---

## 9. Middleware verdict and redirect-loop fix

- **Verdict:** Server-side invite gate is correctly implemented and safe for launch.
- **Redirect-loop bug:** Yes. Blocked users on exact `/app` were being redirected to `/app`, causing a loop.
- **Fix:** In `apps/web/middleware.ts`, when the user is not allowed, the code now checks `pathname === "/app" || pathname === "/app/"`. If true, it returns `response` (NextResponse.next()) instead of redirecting, so the request is allowed through and the client shows InviteRequiredView. Blocked users on any other `/app/*` are still redirected to `/app` once.
- **Outcome:** Exact `/app` is allowed through and shows InviteRequiredView client-side; deeper `/app/*` routes redirect to `/app` with no loop.
