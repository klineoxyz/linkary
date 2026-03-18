# Org sourcing pipeline (operator)

**Experts for this pass:** product/org workflow, marketplace/jobs/deals, KOL sourcing, Next.js state, Supabase/RLS, operator UX, QA.

---

## Part 1 — Where operators had to jump (before unified tab)

| Need | Org workspace hub | Jobs tab | KOL lists | Programs (Jobs tab) | `/deal/[id]` | Sourcing API |
|------|-------------------|--------|-----------|---------------------|--------------|--------------|
| Who is shortlisted | Summary count + truncated list | — | Full shortlist + invite | — | — | `shortlisted_people` |
| Who was job-invited | Mini pipeline snippets | Per-job expand table | After invite | — | — | `job_invites`, pipeline rows |
| Creator response (job) | Snippet | Per-job table | — | — | — | `creator_response` on invite |
| Applied / deal | Counts | Applications UI | — | — | Deal page | Derived in API |
| Program invites | Counts | Per-program counts | Invite CTA | Manage drawer | — | `program_invites` |
| Unseen by creator | Summary bullets | — | — | — | — | `viewed_at` / `invitee_inbox_seen_at` |

**Fragmentation:** Hub gave counts and small previews; **action** required hopping to **KOL lists** (shortlist/invite), **Jobs** (applications, per-job invites, programs), and **deal** routes. No single table of “who is where” with next actions.

---

## Part 2–3 — Unified tab: **Sourcing** (org page)

**Route:** Org workspace → tab **Sourcing**, or `/org/{slug}?tab=sourcing`. Org sidebar: **Sourcing pipeline**.

**Stages (grounded only):**

| Stage | Data source |
|-------|-------------|
| Shortlisted | `kol_list_members.shortlisted` + org KOL lists; `has_any_job_invite` from any `org_job_invite` for profile |
| Job invite — unseen | Job invite, no application/deal, `creator_response` pending, `viewed_at` null |
| Job invite — seen, no response | Same but `viewed_at` set |
| Interested, not applied | `creator_response` interested, no application, no active deal |
| Passed / hidden | declined or dismissed, no application/deal |
| Applied | `applications` row for job+profile, no active deal |
| Active deal | `deals` active for job+profile; `active_deal_id` on row |
| Program unseen | `creator_program_invites` status invited, `invitee_inbox_seen_at` null |
| Program pending | invited + inbox seen |
| Program in progress | accepted / later (excl. declined/removed) |
| Program out | declined / removed |

**Operator actions (existing routes):**

- Shortlist → **Org KOL lists** (`onOpenOrgKolLists`).
- Job context → **Jobs tab** + open job drawer (`setSelectedJobId`).
- Deal → **`/deal/{id}`** via `dealDetail` route.
- Program → **Jobs tab** + program drawer (`setSelectedProgramId`).
- KOL source → **KOL lists** with optional `suggestJobId` / `suggestProgramId`.

---

## Persisted vs derived

| Field | Persisted | Derived |
|-------|-----------|---------|
| Shortlist | ✅ `kol_list_members.shortlisted` | — |
| Job invite | ✅ `org_job_invites` | — |
| Creator response | ✅ `creator_response` (pre-apply intent) | — |
| Inbox seen (job) | ✅ `viewed_at` | — |
| Applied | — | ✅ `applications` |
| Active deal | ✅ `deals` | Flag on invite path via join |
| Program status | ✅ `creator_program_invites` | — |
| Program inbox seen | ✅ `invitee_inbox_seen_at` | — |

---

## API additions (`GET /api/orgs/[orgId]/sourcing`)

- `active_deal_id` on each job invite row where deal active.
- `pipeline.shortlisted_profiles` — shortlist rows + `has_any_job_invite`.
- `pipeline.job_invite_unseen_pending`, `job_invite_seen_pending`, `job_interested_not_applied`.
- `pipeline.program_invite_unseen`, `program_invite_seen_pending`.
- `pipeline.program_declined_or_removed`.

Existing pipeline keys unchanged for backward compatibility.

---

## QA checklist

- [ ] Shortlisted table matches KOL shortlists; invite CTA opens org KOL lists.
- [ ] Job unseen / seen pending split matches `viewed_at` + pending response.
- [ ] Interested row shows only when `creator_response` interested and no application.
- [ ] Applied / active deal match Jobs tab and deals.
- [ ] Open deal navigates to correct deal id.
- [ ] Program stages match program invite statuses and seen flags.
- [ ] Personal mode and creator org inbox unchanged.
- [ ] No CRM / analytics / invite-onboarding regressions.

---

## Sourcing workbench (operator UX pass)

**UX gaps addressed:** long scroll through disconnected stages → **priority sections** (needs you / awaiting creator / in motion / collapsible archive); weak scan → **unified table** with track badges (jobs / programs / kol); no search → **creator search** + **stage / job / program / source-list** filters; many clicks for one creator → **drawer** with grounded job + program rows for that profile; unclear ownership → **Waiting on** column (You / Creator / Both / Settled).

**Filters (all client-side on API data):**

| Filter | Behavior |
|--------|----------|
| Search | Name, @handle, profile id substring |
| Priority chips | All · **Needs you** (applied + shortlist w/o job invite) · **Awaiting creator** · **Unresolved** (excl. passed + program out) |
| Stage | One pipeline stage |
| Job | Job-related rows for that job |
| Program | Program rows for that program |
| Source list | Job rows where invite `kol_list_id` matches org KOL list |

**API:** `kol_list_name` on job invites; `kol_list_options` for dropdown; `job_invites` / `program_invites` include `username` / `display_name` for drawer.

**Drawer:** Lists shortlist names (if any), all job invites for profile (response, viewed, applied, deal, list), all program invites. Actions: profile, KOL lists, open job, open deal, program on Jobs tab. **Still on Jobs tab:** accept/reject applicants, full program admin.

**Personal vs org:** Unchanged — workbench only in org **Sourcing** tab; creator inbox stays personal.

**QA (add):** Large pipeline + filters; dual-context user; org switch; KOL lists / jobs / deals / creator inbox regressions.

---

## Volume productivity pass (bulk + saved views)

**Friction addressed:** repeated filter setup → **saved views**; row-by-row shortlist → **bulk shortlist/unshortlist** (only for profiles already on a chosen org KOL list); many tabs → **open profiles / deals** (capped); no scan count → **sticky bar** with row + unique-creator counts; dense lists → **compact** toggle.

### Saved views (persisted)

| Item | Storage |
|------|---------|
| View name, filter JSON | `org_sourcing_saved_views` (org-scoped, RLS: org members CRUD) |
| Current selection, drawer open | Transient (not saved) |

**API:** `GET/POST /api/orgs/[orgId]/sourcing/saved-views`, `PATCH/DELETE .../saved-views/[viewId]`. Filters include: search, priority, stage, job, program, source list, compact, archive panel open.

**Operator flow:** Save current filters with a name → load from dropdown → rename (prompt) → delete. Switching filters clears “active view” until you load again.

### Bulk actions (safe, grounded)

| Action | Behavior |
|--------|----------|
| Shortlist / Remove shortlist | `POST .../sourcing/bulk-shortlist` — updates `kol_list_members.shortlisted` only for **existing** rows on org-owned list (max 100 ids); does **not** add members to list |
| Open profiles | New tabs by handle (capped, e.g. 8) |
| Open deals | New tabs `/deal/[id]` (capped) |
| Copy handles / profile IDs / CSV | Clipboard |
| Link KOL lists | Navigate to org KOL lists |

**Not bulk:** job invites (use KOL lists + per-row invite); accept applicant; program admin — still **Jobs** / **deal** pages.

### QA (volume)

- [ ] Org admin: large pipeline, saved view save/load/rename/delete.
- [ ] Dual-access + org switch: views per org; no bleed.
- [ ] Bulk shortlist: only on-list members update; off-list IDs reported as `not_on_list`.
- [ ] After bulk shortlist, workbench refresh matches KOL list shortlist.
- [ ] No regression: KOL lists, Jobs/applicants/deals, creator org-invites inbox.

---

## Later (fuller sourcing CRM)

- Drag-and-drop stages, email sequences, operator assignment, bulk job invites (with strict permission UX), full export pipeline — out of scope; row-grounded model preserved.
