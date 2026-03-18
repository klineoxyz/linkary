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

## Later (fuller sourcing CRM)

- Drag-and-drop stages, email sequences, assignment, saved views, exports — out of scope; current model stays row-grounded.
