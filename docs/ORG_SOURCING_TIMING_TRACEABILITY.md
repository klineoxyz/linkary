# Org sourcing — timing & traceability

**Experts:** product/org workflow, operator UX, Next.js state, Supabase/RLS, marketplace truth boundaries, QA.

---

## Part 1 — Gaps addressed

| Gap | Change |
|-----|--------|
| No due date | `follow_up_due_at` on `org_sourcing_creator_workflow` |
| No “last operator action” | `last_operator_action_at` / `last_operator_action_by` (set on every workflow save) |
| No overdue visibility | **Overdue** filter + collapsible **Overdue follow-ups** queue; snooze hides overdue until `snoozed_until` |
| No due-soon / today | Filters **Due today**, **Due soon** (72h), **Due** column on rows |
| No activity trace | **Team** log in `org_sourcing_workflow_activity` + **Pipeline** timeline derived in API from grounded tables |
| Creator vs operator | UI labels **Team** vs **Pipeline**; pipeline rows have no operator actor |

---

## Data model

### Workflow timing (operator metadata)

| Column | Meaning |
|--------|---------|
| `follow_up_due_at` | When the team aims to follow up (not a CRM task) |
| `snoozed_until` | Suppress overdue treatment until this time |
| `last_operator_action_at` / `_by` | Last save of workflow fields |

### Activity

| Store | `org_sourcing_workflow_activity` — append-only rows on workflow saves (assignee, status, note, due, snooze, init). |
| Derived | `GET .../sourcing/activity?profile_id=` merges **live** job invites, applications, deals, program invites into a unified timeline (grounded reads only). |

Pipeline timeline entries are **not** duplicate state: they reflect current DB facts at read time, sorted with stored team edits.

---

## Operator UX

- **Timing** chips: All dates · Overdue · Due today · Due soon · Recently touched (team save in 5d).
- **Saved views** include `timingFilter`.
- **Drawer:** due datetime, quick +1d/+3d/+7d, snooze, last team save line, **Activity** list (Team + Pipeline).
- **CSV:** `follow_up_due` column.

---

## Org vs personal

Org sourcing only. Personal mode and creator inbox unchanged.

---

## QA

- [ ] Set/clear due and snooze; overdue filter matches.
- [ ] Dual org: workflow and activity scoped per org.
- [ ] Activity: team rows after save; pipeline rows match Jobs/deals/applies.
- [ ] No regression: KOL lists, Jobs, deals, creator org-invites inbox.

---

## Later (fuller CRM)

SLA automation, notifications, immutable audit export, assignment rules — out of scope.
