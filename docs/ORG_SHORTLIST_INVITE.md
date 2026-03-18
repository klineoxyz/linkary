# Org shortlist + invite (implementation)

## Expert roles (this pass)

| Area | Owner |
|------|--------|
| Product / org workflow | Shortlist → invite → apply/deal funnel |
| Marketplace / jobs | `org_job_invites`, applications, deals |
| KOL / programs | `kol_list_members.shortlisted`, `creator_program_invites` |
| Next.js App Router | API routes + Figma `App.tsx` / pages |
| Supabase / RLS | Migrations, `org_members`, org-owned KOL lists |
| QA / launch | Checklist below |
| Org-mode UI | `KOLListsPage`, `OrgDetailPage` hub + Jobs tab |

## Schema (additive)

| Change | Purpose |
|--------|---------|
| `kol_list_members.shortlisted` boolean default false | Org list shortlist (meaningful only for org-owned lists; personal lists ignore in UI) |
| `org_job_invites` | `(org_id, job_id, profile_id)` unique; optional `kol_list_id`; RLS via `org_members` |

## API

| Route | Method | Notes |
|-------|--------|-------|
| `/api/kol-lists/[id]` | GET | Members include `shortlisted` |
| `/api/kol-lists/[id]/members/shortlist` | PATCH | `{ profile_id, shortlisted }`; **org-owned lists only** (403 otherwise) |
| `/api/orgs/[orgId]/job-invites` | POST | `{ job_id, profile_id, kol_list_id? }`; job must belong to org |
| `/api/orgs/[orgId]/sourcing` | GET | Job invites + program invites + derived `has_application` / `has_active_deal` (jobs); summary counts |
| `/api/creator-programs/[id]/invites` | POST | Existing; `source_type: kol_list`, `source_id: list id` |

## UI surfaces

1. **Org context → KOL lists** (`KOLListsPage`): Shortlist toggle, Invite dialog (job vs program), filters (shortlisted / invited), badges (job invite, applied, active deal, program status).
2. **Org Workspace hub**: Sourcing block — shortlisted count, job invite counts, applied, active deals, program pending invites; link to KOL lists.
3. **Jobs tab**: Per job — “X invited (KOL)”, **Invite from KOL lists** (preselects job in invite flow).
4. **Creator programs**: **Invite from KOL lists** (preselects program).

## States (grounded)

| State | Source |
|-------|--------|
| Shortlisted | `kol_list_members.shortlisted` |
| Invited (job) | Row in `org_job_invites` |
| Invited (program) | `creator_program_invites.status` (e.g. invited, applied, active, …) |
| Applied (job) | Row in `applications` for that `job_id` + profile |
| Active deal (job) | `deals.status = active` for org + job + profile |

No invented metrics.

## Guardrails

- Authority: **org_members** (RLS + API checks). No `profile_type` for org authority.
- Personal mode: no shortlist/invite UI on personal KOL lists; list behavior unchanged.
- No CRM / analytics / invite-onboarding changes in this pass.

## QA checklist

- [ ] Migration `20260419000000_org_kol_shortlist_job_invites.sql` applied (`pnpm db:push`).
- [ ] Org member: shortlist toggles persist; personal list has no shortlist UI in personal workspace.
- [ ] Invite to job (duplicate → 409).
- [ ] Invite to program (duplicate → silent skip per existing API).
- [ ] Sourcing summary on hub matches DB.
- [ ] Job row shows invite count; KOL prefill opens with job selected.
- [ ] Dual-access user: personal KOL unchanged; org context shows org pipeline only.

## Limitations (later)

- No in-app creator notification email for job/program invite (invite is operator-side record).
- Program “applied” vs job “applied” differ (program uses invite status; job uses applications table).
