# Org shortlist + invite pipeline

## Expert roles (this pass)

| Expert | Role |
|--------|------|
| Product / org workflow | Pipeline stages, operator clarity |
| Marketplace / jobs / applicants / deals | Job invites, applications, deals |
| Creator lifecycle / notifications | Creator inbox (no new notification events) |
| Next.js App Router + session | `/api/me/org-invites`, routes |
| Supabase / RLS | Invitee `SELECT` on `org_job_invites` |
| QA / launch | Checklists below |
| Org-mode UI | Workspace pipeline, Jobs/Programs polish |

---

## Part 1 — Audit: end-to-end invite flow

| Question | Answer |
|----------|--------|
| **Where stored?** | `org_job_invites` (job/sprint), `creator_program_invites` (program), `kol_list_members.shortlisted` (shortlist only). |
| **Operator sees again?** | Org Workspace hub (counts + **pipeline detail**), KOL lists (per-row badges), Jobs tab (**per-job invite table**), Programs (**per-program invite breakdown**). |
| **Creator saw anything before?** | **No** for job invites (RLS blocked). Program rows were readable by invitee via existing policy; **no dedicated UI**. |
| **Applied / active deal?** | **Derived**: `applications` + `deals` joined to job invites (same `job_id` + `profile_id`). Not stored on invite row. |
| **Fragmentation** | Operator had counts but not a single grouped view; creators had no job-invite visibility. |

**Implemented vs implied**

- **Implemented (persisted):** shortlist flag, job invite row, program invite row + status.
- **Implied (joins only):** “applied after invite”, “active deal” for jobs — true only when application/deal exists for that profile+job.

---

## Schema / API

| Piece | Notes |
|-------|--------|
| `kol_list_members.shortlisted` | Org lists |
| `org_job_invites` | RLS: org members + **invitee `profile_id = auth.uid()`** (migration `20260419100000`) |
| `creator_program_invites` | Existing RLS (org + invitee) |

| Route | Purpose |
|-------|---------|
| `GET /api/orgs/[orgId]/sourcing` | + `shortlisted_people`, `pipeline.{job_*,program_*}` |
| `GET /api/me/org-invites` | Creator: job + program invites, grounded CTAs |

---

## Org UI

1. **Workspace hub** — Under “Sourcing & invites”: compact **pipeline by stage** (shortlisted, job awaiting apply, applied, active deal, program awaiting / in progress).
2. **Jobs tab** — “Show KOL invites for this job” → table: creator, invited date, applied, active deal.
3. **Creator programs** — Line per program: awaiting / in progress / total.
4. **KOL lists** — Link to Workspace for full pipeline.

---

## Creator UI

- **Personal → Network → “Org invites”** (`/app/org-invites`).
- **Job:** org name, role title, **Go to apply** (marketplace / apply URL), **Open deal** if active deal exists.
- **Program:** status, **Browse programs**, **Accept / Decline** when `status === invited'` (existing PATCH API).

No new notification rows or email — visibility only from real invite tables.

---

## States (grounded)

| Shown | Source |
|-------|--------|
| Shortlisted | `kol_list_members.shortlisted` |
| Job invited (awaiting apply) | `org_job_invites` ∧ no application |
| Applied (after job invite) | invite + `applications` row |
| Active deal | invite + `deals.status = active` |
| Program invited / accepted / declined / … | `creator_program_invites.status` |

---

## Guardrails

- `org_members` for operator actions; creators see **only their** job invites (RLS).
- No CRM, analytics, invite-onboarding changes.
- Personal org-mode separation preserved; creator inbox is **personal** nav.

---

## QA checklist

- [ ] Migrations: `20260419000000` + `20260419100000` applied.
- [ ] Creator logged in: `/app/org-invites` lists real job + program invites.
- [ ] Org admin: Workspace pipeline lists match sourcing API.
- [ ] Jobs tab expand shows correct applied/deal columns.
- [ ] Program Accept/Decline updates status and refreshes list.

---

## Job invite creator response

See **`docs/JOB_INVITE_CREATOR_RESPONSE.md`** — `creator_response`, org pipeline split (awaiting vs passed), RLS.

## Invite discovery & unread

See **`docs/ORG_INVITE_DISCOVERY.md`** — inbox seen timestamps, nav/badge, org unseen counts.

## Operator sourcing pipeline (unified tab)

See **`docs/ORG_SOURCING_PIPELINE_OPERATOR.md`** — single **Sourcing** tab, stages, actions, API slices.

## Later (fuller “sourcing CRM”)

- Email/in-app **delivery** events for job invites.
- Deeper program discovery deep-links per program id.
