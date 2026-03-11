# MVP Circles, KOL Lists & Invites — Repo Audit (Updated Post–Pass 2)

**Date:** 2026-03-10  
**Scope:** Current state of Circles, KOL Lists, Creator Programs, and Platform Invites.  
**Pass 2 completed:** Circles full E2E; KOL APIs + persistence; invite gate + issue/allocate/lineage; creator programs APIs + minimal UI; invite schema `issued_by_profile_id`; mock data removed.

---

## 1. Executive Summary

| Area | Current state | Persistence | Blockers |
|------|----------------|------------|----------|
| **Circles** | **Full** — overview, detail, create flow, add/remove members | **Yes** — circles, circle_members; all APIs | None |
| **KOL Lists** | **Full** — lists CRUD, members, add from search | **Yes** — kol_lists, kol_list_members; all APIs | None |
| **Creator Programs** | **APIs + minimal UI** — list/create programs; add invites by profile_id | **Yes** — creator_programs, creator_program_invites; CRUD + invites APIs | Bulk invite-from-circle/KOL in UI optional |
| **Platform Invites** | **Full** — redeem, access, issue, allocate-batch, my-codes, lineage; invite-required gate | **Yes** — batches, codes, redemptions; issued_by_profile_id for lineage | None |
| **Invite lineage** | **Full** — API + InviteLineagePage (inviter + tree) | **Yes** — profiles.inviter_id; lineage API | None |

**Existing related but different:** Org member invites (`org_members`), org ambassador/affiliate invites (`org_ambassadors`, `org_affiliations`) — these are org relationship invites, not platform-access invites.

---

## 2. Circles — Current Implementation

### 2.1 Routes & entry points

- **Route:** `/app/circles` (App.tsx: `route.name === "circles"` → `CirclesOverviewPage`).
- **Nav:** "Circles (Coming soon)" (App.tsx ~1006).
- **Detail:** `circleDetail` → `CircleDetailPage`; **Create:** `CreateCircleFlow` modal (trigger from Overview goes to `setRoute({ name: "overview" })` — no real create).

### 2.2 Data and persistence

- **CirclesOverviewPage.tsx**
  - `demoCircles`: hardcoded array of 6 circles (c1–c6) with name, type, status, description, membersCount, verifiedCount, powerScore, potentialReach, topGeos.
  - `statsData`: `{ totalCircles: 0, verifiedMembers: 0, totalReach: 0, avgPowerScore: 0, isBeta: true }` — no API.
  - Banner: "Coming soon — Circles are not saved yet. Data below is for preview only."
  - Connections count is **real** (fetch from `/api/connections/list`).
- **CircleDetailPage.tsx**
  - `demoCircleData`: single hardcoded circle; `demoMembers`: hardcoded member list (m1–m4).
  - No fetch by circle id; no save.
- **CreateCircleFlow.tsx**
  - `demoMembers` for "add members" step; `handleCreate` does `console.log` and `setRoute({ name: "circleDetail", data: { id: "new", name: formData.name } })` — nothing persisted.
- **CircleComponents.tsx / KOLComponents.tsx**
  - Presentational only; no API calls.

### 2.3 Database

- **No** `circles` or `circle_members` (or similar) in any migration. Grep of `supabase/migrations` for `CREATE TABLE` shows no circle-related tables.

### 2.4 Conclusion (Circles)

- **Real:** Route, nav, Connections count (separate feature).
- **Preview/mock:** All circle list data, circle detail data, create flow, stats cards. Must be replaced with persisted circles + circle_members and real APIs.

---

## 3. KOL Lists — Current Implementation

### 3.1 Routes & entry points

- **Route:** `/app/kol-lists` (App.tsx: `route.name === "kolLists"` → `KOLListsPage`).
- **Nav:** "KOL Lists (Coming soon)" (App.tsx ~1009).

### 3.2 Data and persistence

- **KOLListsPage.tsx**
  - `demoCreators`: 8 hardcoded creators (id, name, handle, reach, topGeo, verified, roleTags).
  - Search: **real** — `GET /api/search?q=...&filter=people`; results mapped to component shape (no persistence of "selected KOLs" or list).
  - No tables for KOL lists or list members; no save/load of lists.
- **KOLComponents.tsx**
  - Presentational (e.g. CreatorRowCard, KOLSelectionSummaryCard).

### 3.3 Database

- **No** `kol_lists` or `kol_list_members` in migrations.

### 3.4 Conclusion (KOL Lists)

- **Real:** Search API for people; UI for search and selection.
- **Mock:** Demo creator list; no saved lists, no list CRUD. Must add kol_lists + kol_list_members and APIs; selected KOLs must persist.

---

## 4. Creator Programs & Invite Flows (Org → Creators)

### 4.1 Current state

- **HostDashboard.tsx** mentions "creator program" in copy only; no dedicated creator_programs table or flow.
- **Org flows that exist:** jobs, applications, deals (gigs); org_members (invite members); org_ambassadors / org_affiliations (invite ambassadors/affiliates). These are **not** the same as "creator program" (program type, title, description, eligibility, status) + "invite creators from circles/KOL lists."

### 4.2 Conclusion

- No creator program entity or "invite from circle/KOL" flow. Required for MVP: minimal creator_programs (org-owned) and a way to invite creators (e.g. from circle_members or kol_list_members) with state (invited/accepted/declined/applied/active).

---

## 5. Platform Invites (Invite-Only Access)

### 5.1 Auth and first-time access

- **Auth callback** (`apps/web/src/app/auth/callback/page.tsx`): Exchanges code for session, ensures profile, runs post-login-bootstrap, saves X identity. **No check for invite code.** First-time users are allowed in after X sign-in.
- **post-login-bootstrap** (`apps/web/src/app/api/auth/post-login-bootstrap/route.ts`): Inserts profile if missing; no invite validation.
- **App.tsx**: Uses `onboarding_completed_at` for some UX; no "has_valid_invite" or "invite_redemption" check before granting /app access.
- **profiles**: No `inviter_id`, `invite_code_id`, or `invite_redemption_id` in existing migrations. No invite_codes, invite_batches, or invite_redemptions tables.

### 5.2 Conclusion

- Platform is **open** after X sign-in. To make it invite-only: add schema (invite_batches, invite_codes, invite_redemptions), persist inviter↔invitee (e.g. profile.inviter_id or redemption→profile), and gate first-time entry on valid code redemption.

---

## 6. Invite Lineage / Graph

- No tables or APIs for "who invited whom" or downstream tree. No lineage queries. Required for MVP: store redemption (inviter + invitee + code), then support queries for tree/depth and a simple UI (e.g. table or tree view).

---

## 7. Existing Architecture to Preserve

- **Usernames namespace:** `usernames` table; owner_type/owner_id; slug resolution for profile/org. Do not change.
- **Public vs in-app URLs:** `/:username` public; `/app/...` internal. Do not change.
- **RLS:** Existing tables (profiles, orgs, org_members, jobs, applications, deals, etc.) have RLS; new tables must follow same principles.
- **Analytics ownership:** Deep analytics under `/analytics`; profile/insights as snapshot. Do not duplicate full analytics on Circles/KOL pages; use real counts or honest empty states.
- **Org model:** orgs, org_members, org_affiliations, org_ambassadors, jobs, applications, deals, reviews. Do not break.
- **Auth:** Supabase Auth; X OAuth; auth callback and set-session. Invite gate must be added without breaking existing session flow.

---

## 8. Dead / Misleading Code and UI

- **Circles:** `demoCircles`, `statsData` (isBeta), "Coming soon" banner — remove or replace with real data and real empty state when feature is live.
- **Circle detail:** `demoCircleData`, `demoMembers` — replace with fetch by id and real members.
- **CreateCircleFlow:** `handleCreate` no-op; `demoMembers` — wire to create API and real member search/selection.
- **KOL:** `demoCreators` used as initial list; replace with saved list members or empty state. "No KOLs selected" should reflect DB state when lists exist.
- **Stats cards (Circles):** Currently show 0 or "—" with "Circle analytics in beta" — when circles are real, show real counts or explicit empty state; no fake numbers.
- **Nav labels:** "Circles (Coming soon)" / "KOL Lists (Coming soon)" — update when features are persisted and working.

---

## 9. Reusable Building Blocks

- **Search:** `/api/search?q=...&filter=people` — use for circle members and KOL list add (real profiles).
- **Connections:** `/api/connections/list` — already used on Circles page; can stay; circles are separate (curated lists vs connection graph).
- **Profiles:** `profiles` + `public_profile_view` for display of circle/KOL members.
- **Org ownership:** `orgs.id`, `org_members` (role admin/member) — reuse for org-owned circles and KOL lists.
- **RLS patterns:** Owner-based SELECT/INSERT/UPDATE/DELETE; org checks via org_members. Apply same to circles, kol_lists, invite_codes (issuer), invite_redemptions (redeemer + inviter).

---

## 10. Blockers Summary

| # | Blocker | Resolution |
|---|---------|------------|
| 1 | No circles persistence | Add circles + circle_members; CRUD APIs; UI uses real data |
| 2 | No KOL lists persistence | Add kol_lists + kol_list_members; CRUD APIs; UI uses real data |
| 3 | No platform invite system | Add invite_batches, invite_codes, invite_redemptions; profile.inviter_id or FK from redemption; gate first-time access |
| 4 | No invite lineage | Store inviter in redemption; add lineage API + simple UI |
| 5 | No creator programs | Add creator_programs + creator_program_invites (minimal); invite from circle/KOL member |
| 6 | Mock data on live routes | Remove demo data; real data or honest empty states only |
| 7 | Admin unlimited invites (@muazxinthi) | Config or table: allow unlimited for specific profile_id; batch allocation for others (cap 500 lifetime, batch grants) |

---

## 11. Files Touched (Current)

| Area | Files |
|------|--------|
| Circles UI | `apps/web/src/figma/app/components/circles/CirclesOverviewPage.tsx`, `CircleDetailPage.tsx`, `CreateCircleFlow.tsx`, `CircleComponents.tsx`, `index.tsx` |
| KOL UI | `apps/web/src/figma/app/components/circles/KOLListsPage.tsx`, `KOLComponents.tsx` |
| App routing | `apps/web/src/figma/app/App.tsx` (circles, circleDetail, kolLists, nav labels) |
| Routes | `apps/web/src/app/app/circles/page.tsx`, `apps/web/src/app/kol-lists/page.tsx` (or app route structure) |
| Auth | `apps/web/src/app/auth/callback/page.tsx`, `apps/web/src/app/api/auth/post-login-bootstrap/route.ts` |
| No backend | No circle/KOL/invite APIs or migrations today |

---

*End of MVP_CIRCLES_KOL_INVITES_AUDIT.md*
