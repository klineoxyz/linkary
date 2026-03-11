# Linkary One Work System — Current State Audit

**Strike team:** Product, Fullstack, Supabase/Postgres, Backend/API, Frontend/Next.js, Design Systems, RLS/Security, QA/Launch Readiness  
**Date:** 2025-03-10  
**Scope:** Creator Programs consolidation, Jobs & Sprints surface, Network map view

---

## 1. Current State Summary

### 1.1 Schema

| Asset | Location | Purpose |
|-------|----------|---------|
| **jobs** | `supabase/migrations/20260218000000_mvp_orgs_reputation_marketplace.sql` | org_id, type IN ('job','sprint'), title, budget, duration, tags, status. Org-owned work. |
| **applications** | Same migration | job_id, applicant_type (profile/org), applicant_profile_id / applicant_org_id, status. Apply to jobs/sprints. |
| **creator_programs** | `supabase/migrations/20260322100003_creator_programs.sql` | org_id, title, description, program_type (ambassador, affiliate, campaign, other), status (draft, open, closed, archived). Separate org-owned “program” entity. |
| **creator_program_invites** | Same | creator_program_id, profile_id, source_type (circle, kol_list, manual), source_id, status. Invitees to a program. |

**Overlap:** Jobs/sprints are “work”; creator_programs are also org-owned work with invites. Two parallel systems.

### 1.2 APIs

| API | File | Behavior |
|-----|------|----------|
| Jobs (list/create) | `@/lib/jobs.ts`, `/api/orgs/[orgId]/jobs`, `/api/jobs/[id]/apply` | List all jobs; org creates job/sprint; profile/org applies. |
| Creator programs | `apps/web/src/app/api/creator-programs/route.ts` | GET requires `org_id` (list for org). POST creates program (org member). |
| Creator program by id | `apps/web/src/app/api/creator-programs/[id]/route.ts` | GET/PATCH/DELETE single program. |
| Creator program invites | `apps/web/src/app/api/creator-programs/[id]/invites/route.ts` | POST add invite(s), PATCH status. |
| Invite lineage | `apps/web/src/app/api/invites/lineage/route.ts` | GET ?depth=1|2|3 — inviter + invitees tree for current user (profiles.inviter_id). |

**Gap:** No public/market list for creator programs (only org-scoped list). Circles/KOL as recruiting sources: API supports source_type/source_id on invites; no UI to “invite from circle/KOL” yet.

### 1.3 Routes & Nav

| Route name | Path | Component | Nav |
|------------|------|-----------|-----|
| market | /app/market | MarketplacePage (Jobs & Sprints) | “Jobs & Sprints” (sidebar) |
| creatorPrograms | /app/creator-programs | CreatorProgramsPage | **Removed from sidebar** (prior change); still in route map and org tab |
| inviteLineage | /app/invites/lineage | InviteLineagePage | “Invite lineage” (sidebar) |
| orgDetail | /org/[id] | OrgDetailPage | Via dashboard/links |
| Org tabs | (query tab=) | dashboard, insights, members, affiliates, ambassadors, **jobs**, **creator_programs**, case_studies, settings | Creator programs is a **separate tab** on org — duplicates “work” surface. |

**Redundancy:** Standalone creator-programs route + org “Creator programs” tab duplicate the work system next to Jobs.

### 1.4 UI Components

| Component | Location | Behavior |
|----------|----------|----------|
| MarketplacePage | App.tsx (inline) | Pills: All, Jobs, Sprints. Lists jobs + sprints from listJobs(). Apply flow. No creator programs. |
| CreatorProgramsPage | CreatorProgramsPage.tsx | Org selector (or orgId prop), list programs, create program. Used as standalone page and as org tab content. |
| OrgDetailPage | OrgDetailPage.tsx | Tabs include “Jobs” and “Creator programs”. Jobs tab: list org jobs, create job. Creator programs tab: embeds CreatorProgramsPage with orgId. |
| InviteLineagePage | InviteLineagePage.tsx | Tree UI: “Invited by” + “You invited” (nested). No graph/map. |

### 1.5 Circles & KOL

- **Circles / KOL lists:** Exist; used for grouping creators. API for creator_program_invites accepts source_type/source_id (circle_id, kol_list_id).
- **Recruiting flow:** Not implemented in UI — no “Invite from circle” / “Invite from KOL list” in creator program or job flows.

### 1.6 Invite Lineage

- **Data:** profiles.inviter_id; API returns inviter + recursive invitees (depth 1–3).
- **UI:** Text tree with expand/collapse. No graph/map.

---

## 2. What Should Be Removed

- **Standalone “Creator programs” product surface:** No separate nav item (already removed). No separate org tab “Creator programs” — fold into Jobs tab.
- **Direct route /app/creator-programs as primary UX:** Redirect to market with creator-programs view; do not expose as main nav destination.
- **Duplicate “work” entry points:** One place to see and create work: Jobs & Sprints (market) + org Jobs tab (jobs, sprints, creator programs in one tab).

---

## 3. What Should Be Merged

- **Creator programs into the single work surface:** Shown as “Creator Programs” pill on **Jobs & Sprints** (market) and as a **section inside the org Jobs tab** (list + create), not a separate tab.
- **Invite lineage:** Upgrade to graph/map view (same API, new visualization).

---

## 4. What Should Be Repurposed

- **CreatorProgramsPage:** No longer used as standalone or as full org tab. Its list+create logic can be reused as a **section** inside the org Jobs tab and as **cards** in the market view (Creator Programs pill).
- **creator_programs / creator_program_invites tables:** Keep. Treat as “work type” data living alongside jobs/sprints; no schema merge for MVP (least migration risk).

---

## 5. What Should Remain API-Only

- **Creator program APIs:** Remain. GET /api/creator-programs extended to support listing **open** programs for market when org_id omitted. Org-scoped GET/POST unchanged.
- **Invite lineage API:** Unchanged; graph view consumes it.

---

## 6. What Must Not Be Duplicated

- No second “Creator programs” nav item.
- No second work-creation flow (one: org Jobs tab with Jobs + Sprints + Creator programs).
- No mock graph data; graph uses real lineage API only.

---

## 7. Overlap Matrix

| Concern | Jobs/Sprints | Creator programs (current) | After refactor |
|---------|--------------|----------------------------|----------------|
| Who creates | Org (via org) | Org (via org or standalone) | Org only, in one place (Jobs tab) |
| Where shown | Market + Org Jobs tab | Standalone page + Org Creator programs tab | Market (pill) + Org Jobs tab (section) |
| Apply/Invite | Applications to jobs | creator_program_invites | Unchanged; one work surface to discover programs |
| Circles/KOL | — | API only | Remain recruiting sources; UI can be added later |

---

## 8. Final Product Decision

- **One work system:** Jobs & Sprints (market) is the single discovery surface. Creator programs are **not** a separate product area; they appear as a **fourth pill** (All | Jobs | Sprints | Creator Programs) on the same page.
- **Org-only creation:** Only orgs create work. Creation happens in **org context only**: org **Jobs** tab shows Jobs, Sprints, and Creator programs in one tab (three sections). No standalone Creator programs tab; no creator-program creation from market.
- **Creator Program as work type, not product area:** Data stays in `creator_programs` / `creator_program_invites` (no schema merge for MVP). In the UI they are a **filter/pill** on the work surface and a **section** inside the org Jobs tab.
- **Circles + KOL lists:** Remain recruiting sources (API already supports source_type/source_id). UI for “invite from circle/KOL” can be added later; not required for this refactor.
- **Network map:** Invite lineage becomes a **graph/map view** (same API). Upgrade InviteLineagePage to a node-based graph; no new product surface.

---

## 9. Schema Decision

- **Do not delete** `creator_programs` or `creator_program_invites`.
- **Keep** as-is for MVP. They act as the “creator program” work type; merging into jobs would require migration and would complicate applications (applications are job_id-based). Least migration risk: keep tables, expose creator programs only through the single work surface (market pill + org Jobs section).
- **Optional later:** Add RLS policy so that `status = 'open'` programs are readable by any authenticated user (for market listing). Implemented in this refactor via new policy.

---

## 10. Implementation Plan

| Step | Action |
|------|--------|
| 1 | **API** — GET /api/creator-programs: when `org_id` omitted, return programs with `status = 'open'` (add RLS policy for read-open). |
| 2 | **Nav/Routes** — Ensure no “Creator programs” in sidebar. Route `/app/creator-programs` → redirect to market with `view=creator_programs`. Remove `creatorPrograms` from primary route set; keep path reserved. |
| 3 | **OrgDetailPage** — Remove “Creator programs” tab. Add “Creator programs” section inside the **Jobs** tab (list + create). |
| 4 | **MarketplacePage** — Add pill “Creator Programs” and list open programs (from API without org_id). No create on market. |
| 5 | **Graph library** — Add `react-force-graph-2d`; dynamic import with `ssr: false`. |
| 6 | **InviteLineagePage** — Replace tree with force-directed graph (nodes = profiles, edges = inviter_id). Same /api/invites/lineage data. |

---

## 11. Files to Touch

| File | Change |
|------|--------|
| `supabase/migrations/` | New migration: RLS policy `creator_programs_select_open` (SELECT where status = 'open'). |
| `apps/web/src/app/api/creator-programs/route.ts` | GET: if no org_id, list open programs (with org join for name). |
| `apps/web/src/figma/app/App.tsx` | Market: add view state `creator_programs`, pill, fetch and show programs. Path /app/creator-programs → market + view. Remove creatorPrograms from sidebar (already done). |
| `apps/web/src/figma/app/components/OrgDetailPage.tsx` | Remove creator_programs tab. In Jobs tab add Creator programs section + create. |
| `apps/web/src/figma/app/components/InviteLineagePage.tsx` | Replace tree with force-graph (or add graph + toggle). |
| `apps/web/package.json` | Add `react-force-graph-2d`. |
| `apps/web/src/lib/reservedPaths.ts` | Keep `creator-programs` for redirect. |

---

## 12. QA Report (Grading)

| Item | Grade | Notes |
|------|--------|--------|
| **One work surface (Jobs & Sprints)** | Fully implemented | Market page has pills: All, Jobs, Sprints, Creator Programs. Org Jobs tab has Jobs list + Creator programs section. No standalone Creator programs nav or tab. |
| **Creator Programs as pill + section** | Fully implemented | Market: Creator Programs pill and list of open programs. Org Jobs tab: Creator programs subsection with list + Create program modal. |
| **Route /app/creator-programs** | Fully implemented | Pathname maps to market with `data.view = "creator_programs"`. Reserved path kept. No standalone page. |
| **Org-only work creation** | Fully implemented | Create job/sprint/program only from org context (org Jobs tab). API enforces org membership. |
| **GET /api/creator-programs without org_id** | Fully implemented | Returns open programs for marketplace; RLS policy `creator_programs_select_open` allows read where status = 'open'. |
| **Invite lineage graph view** | Fully implemented | InviteLineagePage: Map (force-graph) + List toggle. Graph uses real lineage API; nodes = me, inviter, invitees; links = inviter→me, me→invitees. |
| **Lineage API `me` in response** | Fully implemented | GET /api/invites/lineage returns `me: { id, username, display_name }` for graph center node. |
| **Circles/KOL as recruiting sources** | Deferred | API supports source_type/source_id on creator_program_invites; UI for "invite from circle/KOL" not in this refactor. |
| **Creator program detail / invite UI** | Deferred | Program detail page and "add invite from circle" UI remain optional post-MVP. |

---

## 13. Founder Verdict

**What is now in MVP**

- **One work surface:** Jobs & Sprints (market) is the single discovery surface with four pills: All, Jobs, Sprints, Creator Programs. Creator programs are listed and discoverable here; creation happens only in org context.
- **Org Jobs tab:** Single tab for org work: Jobs list (with create job/sprint modals) and Creator programs subsection (list + create program). No separate Creator programs tab.
- **Route behavior:** `/app/creator-programs` redirects into market with Creator Programs view. No duplicate product area.
- **Network map:** Invite lineage page has a **Map** (force-directed graph) and **List** view, built from real Linkary invite data (inviter → you → invitees). No mock data.

**What was removed to reduce duplication**

- Standalone “Creator programs” nav item (was already removed earlier).
- Standalone Creator programs **tab** on org detail (folded into Jobs tab as a section).
- Rendering of `CreatorProgramsPage` as a top-level route (route now maps to market + view).
- Any second “work” product area; one work system only.

**What remains optional post-MVP**

- Invite-from-circle / invite-from-KOL UI in creator program flows (API ready).
- Creator program detail page (view program, add invites, manage status).
- Deeper graph interactions (zoom to node, expand/collapse, filters).

**Founding principle**

Linkary presents one trust + reputation + recruiting + work system: one Jobs & Sprints surface, one invite/application flow, one network graph built from Linkary data. No separate creator program product, no second CRM, no overlapping work sections.

---

*Implementation complete. See code changes in App.tsx, OrgDetailPage.tsx, InviteLineagePage.tsx, creator-programs API, lineage API, and migration 20260324000000_creator_programs_select_open.sql.*
