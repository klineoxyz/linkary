# Job invite lifecycle — creator response

## Experts (this pass)

| Role | Scope |
|------|--------|
| Product / creator lifecycle | Response before apply |
| Marketplace / jobs / applications / deals | Derived applied & deal |
| Next.js API | `PATCH /api/me/org-job-invites/[id]`, sourcing |
| Supabase RLS | Invitee UPDATE + column guard trigger |
| QA | Checklist below |
| Creator UX | `/app/org-invites` |

---

## Lifecycle (grounded)

| Stage | Source |
|-------|--------|
| Invited | Row in `org_job_invites` |
| Creator viewed (optional) | `viewed_at` |
| Creator response | `creator_response`: `pending` \| `interested` \| `declined` \| `dismissed` |
| Applied | **Derived** — `applications` for job + profile |
| Active deal | **Derived** — `deals.status = active` |

**Safest model:** Store only pre-apply intent (`creator_response`). Never duplicate application/deal truth on the invite row.

---

## Creator actions

| Action | Effect |
|--------|--------|
| Apply now | Opens apply flow (marketplace / apply URL) |
| I’m interested | `creator_response = interested` |
| Not interested | `declined` |
| Hide from list | `dismissed` (still visible to org as passed/hidden) |
| Undo response | `pending` |

If creator applies or gets a deal, **UI shows Applied / Active deal** regardless of stored response.

---

## Org visibility

- **Workspace summary:** awaiting creator response vs creator passed/hidden vs applied vs deal counts.
- **Pipeline cards:** same buckets.
- **Jobs → KOL invites table:** “Their response” (Interested / Passed / Hidden) when no apply/deal yet.

---

## RLS

- **SELECT:** org members (org) + invitee (`profile_id = auth.uid()`).
- **INSERT/DELETE:** org operators (unchanged).
- **UPDATE (invitee):** new policy; **trigger** blocks changing `org_id`, `job_id`, `profile_id`, `kol_list_id`, `invited_at`.

Org members **cannot** PATCH creator fields (no org UPDATE on invites).

---

## Migration

`20260419200000_org_job_invites_creator_response.sql` — columns + trigger + `org_job_invites_update_invitee_response`.

---

## QA checklist

- [ ] Creator sees only own job invites (`GET /api/me/org-invites`).
- [ ] Interested / Not interested / Hide persist after refresh.
- [ ] Undo returns to pending.
- [ ] After apply, card shows Applied; org table shows Applied.
- [ ] After deal, card shows Active deal; org shows deal.
- [ ] Dual-access user: org operator view unchanged; personal org-invites shows creator side.
- [ ] Org mode vs personal mode unchanged for routing.

---

## Later (advanced sourcing CRM)

- Email/push when invited.
- Org cannot see “viewed” unless product wants it.
- Bulk org actions on invites.
