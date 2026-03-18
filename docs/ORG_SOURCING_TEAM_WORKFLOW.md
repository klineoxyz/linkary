# Org sourcing — team workflow (assignee + follow-up)

**Experts:** product/org workflow, org operator UX, marketplace truth boundaries, App Router state, Supabase/RLS, QA.

---

## Part 1 — Team workflow gaps (addressed)

| Gap | Mitigation |
|-----|------------|
| No per-creator ownership | **Assignee** = org member (`assignee_user_id`) per org + creator |
| No internal follow-up signal | **Follow-up status** (operator-only enum) + optional **internal note** |
| No “who acts next?” on org side | **Waiting** column stays grounded; **follow-up** separates “needs internal review” from pipeline position |
| No team queue | **Team follow-up queue** section (rows with active follow-up status, same filters as workbench minus team chip) |
| Hard to filter by ownership | Chips: **Assigned to me**, **Unassigned**, **Needs follow-up** (+ saved views include `teamAssignFilter`) |

---

## Grounded truth vs team metadata

| Grounded (unchanged) | Team metadata only |
|----------------------|-------------------|
| Shortlist (`kol_list_members.shortlisted`) | Assignee |
| Job invite (`org_job_invites`) | `follow_up_status`: none, needs_review, follow_up_needed, waiting_internal, blocked, resolved |
| Creator response, applied, deals, programs | `internal_note` (org members, max 500 chars) |

Metadata **does not** create or change invites, applications, or deals.

---

## Persistence

| Data | Table / API |
|------|-------------|
| Workflow row | `org_sourcing_creator_workflow` — unique `(org_id, profile_id)` |
| Read | `GET /api/orgs/[orgId]/sourcing` → `creator_workflow_by_profile`, `org_assignable_members`, `current_user_id` |
| Write | `POST /api/orgs/[orgId]/sourcing/creator-workflow` (org member; assignee must be org member) |

RLS: any org member can read/write workflow rows for that org.

---

## Operator UX

- **Row / compact:** assignee label + follow-up badge (if not `none`).
- **Drawer:** assign, reassign, follow-up status, internal note, **Assign to me**, **Save team workflow**.
- **Team follow-up queue:** collapsible list of creators with active follow-up (needs_review, follow_up_needed, waiting_internal, blocked).
- **Saved views:** include team filter (`teamAssignFilter`).

---

## Org vs personal

- All of the above is **org sourcing workbench only**.
- **Personal** mode and **creator org-invites inbox** unchanged.
- Assignees are **org members** only (`org_members.user_id`).

---

## QA checklist

- [ ] Org admin + member: assign, change status, note persists; other member sees updates.
- [ ] Dual-access user: workflow is per `org_id`; switch org → different assignments.
- [ ] Filters: Assigned to me / Unassigned / Needs follow-up behave correctly.
- [ ] Saved view restores team filter.
- [ ] No regression: KOL lists, Jobs/applicants/deals, creator inbox, bulk shortlist.

---

## Later (fuller sourcing CRM)

- SLA dates, activity log, bulk assign, permissions by role, notifications — out of scope for this pass.
