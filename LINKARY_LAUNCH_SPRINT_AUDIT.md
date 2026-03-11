# Linkary Launch-Critical Execution — Delta Audit & Plan

**Mode:** Finish real workflow, harden access, clean dead code. No new sections. No product restructure.

---

## 1. Current Delta Audit

### 1.1 What is already usable

| Area | State |
|------|--------|
| **Jobs & Sprints** | Market page with All/Jobs/Sprints/Creator Programs pills. Org Jobs tab lists jobs + sprints with applicants inline; Create job/sprint modals; Accept/Reject/Close job. |
| **Creator programs** | Org Jobs tab has Creator programs section: list + Create program modal. API: GET/POST /api/creator-programs, GET/PATCH/DELETE /api/creator-programs/[id], POST/PATCH /api/creator-programs/[id]/invites (profile_ids, source_type, source_id). |
| **Applications** | applications table (job_id, applicant_type, applicant_profile_id/applicant_org_id, status: pending/accepted/rejected/withdrawn). listApplicationsForJobs, accept/reject in OrgDetailPage. |
| **creator_program_invites** | status: invited, accepted, declined, applied, active, removed. source_type: circle, kol_list, manual. API supports bulk add with source. |
| **Circles API** | GET/POST /api/circles; GET/PATCH/DELETE /api/circles/[id] (returns circle + members with profiles). GET supports ?owner=org&org_id= for org list. POST accepts owner_type/owner_id (org member check). |
| **KOL lists API** | GET/POST /api/kol-lists (?owner=org&org_id=); GET/PATCH/DELETE /api/kol-lists/[id] (list + members with profiles). POST accepts owner_type/owner_id. |
| **Invite system** | issue, redeem, lineage, allocate-batch (admin), my-codes. RLS and batch allocation exist. |
| **Invite-only gate** | Client-side (needs server-side hardening). |

### 1.2 What is missing

| Gap | Detail |
|-----|--------|
| **Work item detail view** | No dedicated detail page/drawer for a single job, sprint, or creator program. Org sees lists only; no single “manage this work item” surface with overview, applicants/invites, status, invite actions. |
| **Invite from Circles/KOL in UI** | API exists (POST creator-programs/[id]/invites with source_type/source_id). No UI: no “Invite from circle” or “Invite from KOL list” in any work surface. |
| **Creator program click-through** | Org Jobs tab shows program title + count only; no link to open program detail or manage invites. |
| **Job/sprint detail** | Job row has “View in Marketplace” and “Close job”; no “Manage” opening a detail view with full description, budget, tags, applicants list, status. |
| **Org-owned circles in UI** | CreateCircleFlow blocks org creation (“Use a personal circle for now”). Circles overview loads GET /api/circles with no org_id, so only profile circles shown. No “Create org circle” or “My org circles” in org context. |
| **Org-owned KOL lists in UI** | KOL list UI likely profile-centric; no org-scoped create/list in org dashboard or dedicated flow. |
| **Admin invite ops UI** | allocate-batch API exists; no UI to allocate batches, view issued/redeemed/revoked codes, or “who invited whom”. |
| **Server-side invite gate** | App entry /app/* not enforced server-side; client can be bypassed. |
| **Dead code** | CreatorProgramsPage component exists but is not rendered in App (route redirects to market). app/app/creator-programs page still mounts app; path map sends creator-programs → market. Stale route name creatorPrograms in path map. |

### 1.3 Schema/API reuse strategy for recruitment statuses and invites

- **Jobs/Sprints:** Keep using **applications** table. Statuses: pending, accepted, rejected, withdrawn. No schema change. UI: expose these in job/sprint detail; no “invite” row for jobs/sprints in MVP (only “applicants”).
- **Creator programs:** Keep using **creator_program_invites**. Statuses: invited, accepted, declined, applied, active, removed. Already support source_type/source_id. No migration. UI: one “Invited creators” list with status and source; “Invite from circle/KOL” calls existing POST with profile_ids + source_type + source_id.
- **Unify in UI only:** Same vocabulary in labels (e.g. “Applicants” for jobs/sprints, “Invited creators” for programs). Status controls per row where API allows (applications: accept/reject; invites: PATCH status). No merging of tables.

### 1.4 Files that need changes (Sprint A–C)

| Sprint | Files / areas |
|--------|----------------|
| **A** | New: WorkItemDetail (or CreatorProgramDetail + JobSprintDetail). OrgDetailPage: link job/sprint/program to detail route or drawer. New or reuse: Work item detail component with tabs/sections (overview, applicants/invites, invite from circle/KOL for programs). App.tsx: route workItemDetail / orgDetail with workItemId + type. |
| **A** | OrgDetailPage: creator program row → “Manage” → open program detail (drawer or route). Creator program detail: fetch GET /api/creator-programs/[id], list invites, “Invite from circle” / “Invite from KOL list” (load circles/kol for org, load members, bulk-select, POST invites). |
| **A** | Job/sprint detail: fetch job by id (from org jobs or new GET if needed), show description/budget/tags, applicants, status. Reuse listApplicationsForJobs / existing PATCH. |
| **B** | CreateCircleFlow: allow org type when user has orgs; pass owner_id = selected org. CirclesOverviewPage: load org circles (e.g. GET with owner=org&org_id for each my org, or add “Org circles” section). Org detail: optional “Circles” tab or link to circles filtered by org. |
| **B** | KOL lists: ensure list/create UI can scope to org (owner_type=org, owner_id=orgId). Add org KOL list creation in org context (e.g. Org detail “KOL lists” or in work item invite flow). |
| **B** | New: Admin invite page (route e.g. /app/admin/invites or founder-only). Allocate batch form; list batches/codes (use existing APIs or add GET list endpoints). “Who invited whom” = lineage already; link or embed. |
| **C** | Middleware or app entry: check invite redemption server-side for /app/* (or key API routes). Remove or isolate CreatorProgramsPage; remove stale creatorPrograms from path map if unused. reservedPaths keep creator-programs for redirect. |
| **C** | QA: direct loads /app/*, work item detail routes, org permissions, invite redemption, empty states. |

---

## 2. Implementation Plan

### Sprint A — Finish the real recruiting flow

1. **Work item detail**
   - Add route (e.g. `workItemDetail` with data: `{ orgId, workItemType: 'job'|'sprint'|'creator_program', workItemId }`) or use org detail + tab + id in state. Prefer **drawer or in-context panel** from Org Jobs tab to avoid new top-level route.
   - **Creator program detail:** Panel/drawer: overview (title, description, program_type, status), org name, invited creators table (profile, status, source_type/source_id), status controls (dropdown or buttons), “Invite from circle” / “Invite from KOL list” (see below).
   - **Job detail:** Panel/drawer: title, type, description, budget, duration, tags, status, applicants list (with accept/reject), “View in Marketplace”, “Close job”.
   - **Sprint detail:** Same as job with sprint-specific fields (duration, objective, links).

2. **Invite from Circles / KOL**
   - In creator program detail only (jobs/sprints use applications only for MVP).
   - “Invite from circle”: Dropdown of circles (org-owned first, then profile; from GET /api/circles and GET ?owner=org&org_id=). On select, GET /api/circles/[id] for members; show list with checkboxes; “Invite selected” → POST /api/creator-programs/[id]/invites with profile_ids and source_type=circle, source_id=circleId.
   - “Invite from KOL list”: Same pattern with GET /api/kol-lists (?owner=org&org_id=), GET /api/kol-lists/[id] for members, POST invites with source_type=kol_list, source_id=listId.
   - Bulk-select: checkboxes per profile; exclude already invited (match by profile_id in current invites).

3. **Status management**
   - Creator program invites: show status; org can PATCH to set status (invited → accepted/declined/removed etc.) via existing API.
   - Jobs/sprints: keep existing accept/reject/close in job detail.

### Sprint B — Org-owned recruiting tools + admin ops

4. **Org-owned Circles UI**
   - CreateCircleFlow: when type is “organization”, require selecting an org (user’s orgs); pass owner_type=org, owner_id=selectedOrgId. Remove the “Use a personal circle for now” block.
   - CirclesOverviewPage: load profile circles (current) and org circles: for each org in myOrgs, GET /api/circles?owner=org&org_id=orgId; merge and show with “personal” vs “organization” badge.

5. **Org-owned KOL lists UI**
   - KOL list create: support owner_type=org, owner_id=orgId (API already does). Add create flow in org context (e.g. from org detail “KOL lists” section or from work item invite step).
   - List: GET /api/kol-lists?owner=org&org_id= when in org context; show in org tab or in “Invite from KOL” dropdown.

6. **Founder / admin invite ops UI**
   - New internal route (e.g. /app/admin/invites) or section visible only to admin (e.g. profile.twitter_username === ADMIN_TWITTER).
   - Allocate batch: form (allocated_to_type, allocated_to_id, count) → POST /api/invites/allocate-batch.
   - List batches / codes: add GET /api/invites/batches or use existing tables; show issued, redeemed, revoked. “Who invited whom”: link to Invite lineage or embed read-only view.

### Sprint C — Security hardening + cleanup + final QA

7. **Server-side invite-only hardening**
   - Option: middleware for /app/* that checks session and invite redemption (or allowlist for public routes). Redirect non-invited users to /invite-required or redeem flow.
   - Alternative: in app layout or app entry, server component or API that returns 403/redirect if user not redeemed and not admin. Prefer minimal surface (one check at app entry or key API).

8. **Dead code cleanup**
   - CreatorProgramsPage: remove file or keep for possible reuse in program detail; ensure no nav or route renders it. Remove creatorPrograms from getPathForRoute map if not needed for redirect (keep redirect in routeFromPathname).
   - Remove unused imports and route names.

9. **Final launch QA**
   - Checklist: direct loads /app/market, /app/circles, /app/kol-lists, /app/invites/lineage, /org/[id]?tab=jobs; work item detail open/close; invite from circle/KOL; org circle create; admin allocate; server gate; no mock data; no duplicate creator-program surface.

---

## 3. Implementation Order

- **A1:** Creator program detail panel/drawer (overview + invites list + status).
- **A2:** Invite from circle / KOL in program detail (dropdowns, load members, bulk-select, POST).
- **A3:** Job/sprint detail panel (overview + applicants + status).
- **B4:** Org circles: CreateCircleFlow org support; CirclesOverviewPage load org circles.
- **B5:** Org KOL lists: create/list in org context.
- **B6:** Admin invite ops page (allocate + list + lineage link).
- **C7:** Invite gate middleware or app entry.
- **C8:** Dead code cleanup.
- **C9:** QA pass and report.

---

## 4. QA Report (post-implementation)

| Bucket | Items |
|--------|--------|
| **Fully implemented** | Work item detail: Creator program drawer (overview, invited creators, status, Invite from Circle/KOL, bulk-select, source visible). Job/sprint drawer (overview, applicants, Accept/Reject, Close, View in Marketplace). Org-owned circles: CreateCircleFlow org type + org dropdown; CirclesOverviewPage loads profile + org circles. Org-owned KOL lists: list/create as org in KOLListsPage; org lists in recruiting dropdown. Admin invite ops: /app/admin/invites (founder-only), allocate batch, my issued codes, link to invite lineage. Server-side invite gate: middleware for /app/* when LINKARY_INVITE_ONLY=true; redirects non-redeemed signed-in users to /app. Dead code: CreatorProgramsPage deprecated comment; creatorPrograms removed from path map; /app/creator-programs still resolves to market view. |
| **API/schema complete; UI partial** | Invite lineage “who invited whom” is linked from admin page; full lineage UI exists at /app/invites/lineage. Redeemed/revoked code list in admin could be extended later (my-codes covers issued). |
| **Deferred** | Jobs/sprints “invite” row (invite from circle for jobs) — MVP uses applicants only; creator programs have full invite-from-circle/KOL. Deep analytics on invite quality/activity. |
| **Blocked** | None. |

---

## 5. Final Founder Verdict

| Verdict | What |
|---------|------|
| **Launch-ready now** | Core recruiting workflow: org → work item (job/sprint/creator program) → open detail → invite from Circles/KOL (programs) → manage applicants/invites and status. Org-owned circles and KOL lists create/manage and use in recruiting. Admin invite allocation and code view. Server-side invite-only gate. No duplicate creator-program surface; no mock data in these flows. |
| **Safe but still rough** | Admin invite UI is minimal (allocate + my codes + lineage link). Empty states and edge messaging could be polished. Direct deep-links to /app/admin/invites depend on pathname sync (already wired). |
| **Not ready** | N/A for MVP scope. |
| **Optional post-MVP** | Invite-from-circle for jobs/sprints (not only programs). Richer admin dashboard (redeemed/revoked filters, export). Graph/network view polish. |

**Founding principle satisfied:** The missing value “org → work item → recruit from circles/KOL → manage invites/applications” is implemented. Access is hardened server-side; dead code isolated; QA pass documented.
