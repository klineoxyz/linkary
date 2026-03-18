# Identity vs org boundary — audit & first-pass plan

**Expert lenses used for this pass (no code changes in this document):**

| Lens | Responsibility |
|------|----------------|
| **Product architecture / domain model** | Two parallel marketplaces (profile gigs vs org jobs), deals naming, CRM workspaces vs Linkary orgs |
| **Supabase / Postgres / RLS** | `gigs.owner_profile_id`, `jobs.org_id` + `org_members`, RLS alignment |
| **Next.js App Router + SSR auth** | Bearer token + `getProfileIdForAuthUser`; no server-side “active org” today |
| **Marketplace / gigs / workflow UX** | Profile gigs in `ProfileEditPage`; org jobs in org APIs — different surfaces |
| **CRM / operator UX** | `resolveCrmAccess`, `profile_type` gate for creator bootstrap; org-style CRM workspaces |
| **QA / launch readiness** | Route naming collision (`/deal/*` vs gig “deals”), regression zones listed below |

---

## Part 1 — Audit: where profile vs org is conflated or ambiguous

### Data model reality (correct split)

| Concept | Table / key | Access pattern |
|---------|-------------|----------------|
| **Profile gigs** (marketplace) | `gigs.owner_profile_id` | RLS: `owner_profile_id = auth.uid()` |
| **Org jobs / sprints** | `jobs.org_id`, `type` job/sprint | RLS: `org_members` role owner/admin |
| **Gig deals** (verified work between profiles) | `gig_deals` | Owner/participant profiles |
| **Org deals** (job applications → deal) | `deals` | `profile_id` + `org_id`; org party via `org_members` |
| **KOL lists** | `kol_lists.owner_type` profile/org | Org path validates `org_members` ✓ |
| **Display “team” on public profile** | `org_team_members.org_profile_id` | Tied to **profile**, `profile_type = company` |

### A. Places that conflate or substitute org for profile (or vice versa)

1. **Gig creation is org-proxy via `profile_type`, not `org_members`**  
   - **Files:** `apps/web/src/app/api/gigs/route.ts`  
   - **Behavior:** Only `profile_type ∈ {project, company}` can POST gigs; rows are always `owner_profile_id = auth uid`.  
   - **Issue:** A founder operating an **org** may still be `profile_type = individual`; they cannot create gigs via this API but **can** manage org jobs. Conversely, a “company” **profile** can own gigs that are **not** tied to any `orgs` row — looks like org work but is personal-profile scoped.

2. **“My gigs” UI is always profile-scoped**  
   - **Files:** `apps/web/src/figma/app/components/ProfileEditPage.tsx` (calls `/api/gigs/mine`, CRUD gigs)  
   - **Issue:** No equivalent “org gigs” surface; org operators manage **jobs/sprints** elsewhere (`/api/orgs/[orgId]/jobs/...`). Same mental model (“post work”) maps to two different entities.

3. **`/profile/deals` + `/api/deals/mine` = gig_deals only**  
   - **Files:** `apps/web/src/app/profile/deals/page.tsx`, `apps/web/src/app/api/deals/mine/route.ts`  
   - **Issue:** Org marketplace **deals** (`deals` table) are **not** listed here. Founders discover org deals only via job/application flows or `/deal/[id]`. Naming overlap (“deals”) increases confusion.

4. **Org vs gig “deal” URLs**  
   - **Org deal:** `apps/web/src/app/deal/[id]/page.tsx` + `/api/deals/[id]` (uses `deals` + `org_members` for org party ✓).  
   - **Gig deal complete/cancel:** `/api/deals/[id]/complete|cancel` operate on **`gig_deals`** (despite `/api/deals/` prefix).  
   - **QA risk:** Wrong id type → confusing errors.

5. **Profile “org team” vs real org operators**  
   - **Files:** `apps/web/src/app/api/org-team/route.ts` — requires `profile_type === "company"`; data in `org_team_members`.  
   - **Files:** `apps/web/src/app/api/orgs/[orgId]/members/...` — real ops via `org_members`.  
   - **Issue:** Two “teams”: showcase team on profile vs operational team on org.

6. **CRM creator eligibility = `profile_type === individual`**  
   - **Files:** `apps/crm/src/lib/access.ts` (`canBootstrapCreatorWorkspace`)  
   - **Issue:** Legitimate creators with `profile_type` project/company cannot bootstrap personal creator workspace via this gate (by design today), but that reinforces **profile_type as role** rather than **org membership** — same human may need both creator and org operator flows.

7. **`listMyOrgs` merges `org_members` and `orgs.owner_profile_id`**  
   - **Files:** `apps/web/src/lib/orgs.ts`  
   - **Behavior:** Correct for listing; **UX** does not expose “you are now acting as Org X” vs “browsing your orgs.”

### B. Data model already correct; UX or labeling is wrong

- **`/api/deals/[id]` (GET):** Org party = any `org_members` row ✓.  
- **`/api/work/mine`:** Combines gig_deals + org `deals` for profile party and org-member visibility ✓ (good unified “work” story; underused in nav).  
- **KOL lists POST org branch:** Checks `org_members` ✓.  
- **Job CRUD:** `org_members` owner/admin ✓ (via RLS + API `is_org_admin`).

### C. Access control should lean on `org_members` (already or gap)

| Area | Today | Gap |
|------|-------|-----|
| Jobs/sprints | RLS + RPC | OK |
| Org deal actions | `org_members` in GET; mark-accepted routes should match | Verify all `deals` mutations use `org_members` not `owner_profile_id` on org |
| Gigs | **Profile only** | If org-owned gigs are desired later, need `org_id` + policies — **out of minimal pass** |
| Dashboard API | `GET /api/orgs/[orgId]/dashboard` uses **anon** client | Public-ish rollup; org-admin-only mutations live elsewhere — confirm no sensitive leak |

---

## Part 2 — Target product model (explicit)

**Individual mode:** Personal profile, personal analytics, creator applications, gig_deals pipeline, personal task board (CRM creator workspace), manual tasks.  
**Org mode:** Org dashboard, org jobs/sprints, KOL lists (`owner=org`), invites, org deals/participants/reports, `org_members` admin, subsidiaries via `orgs.parent_org_id` where applicable.

**Rule:** `profile_type` = public presentation / discovery; **`org_members`** = who may operate the org.

---

## Part 3 — Proposed minimal “active context”

- **Authenticated subject:** always human (`profiles.id = auth.uid()`).  
- **Context:** `personal` | `org:{org_id}`.  
- **Storage (minimal):** cookie or `localStorage` key e.g. `linkary_active_context` + validate on server: org context only if `org_members` exists for that user.  
- **Defaulting:**  
  - Only personal → no switcher UI.  
  - Only one org membership → optional auto-org or single-tap; still show subtle “Acting as [Org]” when in org routes.  
  - Both → persistent switcher + clear header badge.  
- **Drives:** Nav sections, create targets (gig vs job), KOL list owner query param, links to `/org/...` vs profile edit.

---

## Part 4 — Org operator UX (first pass)

When context = org: distinct shell (header color/layout), nav: Dashboard, Jobs & sprints, Applications/deals, KOL lists, Team (`org_members`), Settings; hide or dim profile-only gig posting unless explicitly still supported for linked profile.

---

## Part 5 — Milestones

| Milestone | Content |
|-----------|---------|
| **M1** | This audit + align naming in UI copy (“Gig deals” vs “Job deals”) |
| **M2** | Active context cookie + server validation helper + header switcher |
| **M3** | Org-mode nav + dashboard entry from context |
| **M4** | Route high-traffic creates/lists through context (jobs vs gigs, KOL lists) |
| **M5** | Subsidiaries UI, fine-grained roles, optional org-owned gigs — later |

---

## Part 6 — Guardrails

Preserve: CRM reporting/sync/analytics, invite-required behavior, creator task board, public profile/org pages, no fake data, no broad rewrite.

---

## Part 7 — First implementation pass (realistic scope)

**Files likely touched (M2–M3 only):**

- New: `apps/web/src/lib/active-context.ts` (parse/validate org context)  
- `apps/web/src/figma/app/App.tsx` — switcher + pass context into route handlers  
- `apps/web/src/figma/app/components/DashboardPage.tsx` / org entry — respect context  
- Optional middleware: `apps/web/middleware.ts` — only if cookie must be echoed SSR  

**Explicitly defer:** Migrating `gigs` to `org_id`, changing RLS broadly, CRM `profile_type` rule (document only until product agrees).

---

## After first pass: who can do what

| Actor | Individual context | Org context |
|-------|-------------------|-------------|
| Individual creator | Gigs apply, gig deals, profile/deals, creator CRM | N/A (or switch if also member) |
| Org admin | Personal profile actions | Jobs/sprints, org deals, KOL lists org, members, invites |

**Still later:** Unified “all my deals” spanning gig_deals + org deals in one UI; org-scoped gig posting; permission matrices beyond owner/admin/member.
