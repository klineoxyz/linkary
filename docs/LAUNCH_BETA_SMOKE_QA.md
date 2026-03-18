# Launch beta smoke & QA — final pass

**Role:** QA lead, CRM workflow, release manager.  
**Scope:** Invited beta readiness for Linkary + CRM.  
**Not changed:** Onboarding, referrals, org authority, sourcing truth, analytics stored-data model, CRM sync API contracts.

---

## 1) End-to-end smoke summary

| Flow | Status | Notes |
|------|--------|--------|
| Creator login → profile / public page | **Pass (code review + fixes)** | `/app/profile/*` in shell; public `/{username}` unchanged. |
| Deals / applications | **Pass** | `/app/profile/deals`, `/app/profile/applications` allowed in shell; standalone `/profile/*` still valid. |
| Accept work → CRM tasks | **Pass (expectation set)** | Copy explains sync delay; board-empty vs filter-empty fixed so users aren’t told “no tasks” when filters hide tasks. |
| Tasks grouped by campaign | **Pass** | Campaign cards + `?campaign=` filter. |
| Up to 3 proof URLs | **Pass** | Server accepts up to 3; client validates ≥1 URL. |
| Submission status | **Pass** | Pending / approved / rejected / needs revision (labeled “Needs revision”). |
| Contribution % | **Pass** | Shown on bundle cards when set; operator campaign page unchanged. |
| Org → CRM campaigns → review | **Pass** | Submissions table + Approve/Reject/Needs revision; empty state copy improved. |
| Submissions /reports routes | **Pass** | Point to campaigns (no dead “coming soon”). |
| Mobile (key surfaces) | **Improved** | CRM main padding, task detail, bundle cards, deals/applications panels: `min-w-0`, responsive padding. |

**Automated E2E:** Not run in this pass; recommend one manual smoke: accept on Linkary → task in CRM → submit → approve.

---

## 2) Files touched (this QA pass)

| File | Change |
|------|--------|
| `apps/crm/src/app/(dashboard)/tasks/page.tsx` | Board-empty vs filter-empty; dual fetch `allBoardTasks`; sync copy when enrolled in campaign but board empty; responsive header. |
| `apps/crm/src/app/(dashboard)/tasks/TasksList.tsx` | Props `isBoardTotallyEmpty`, campaign sync hint when filtered empty; mobile padding. |
| `apps/crm/src/app/(dashboard)/tasks/[id]/page.tsx` | User-facing source labels; responsive card; `min-w-0`. |
| `apps/crm/src/app/(dashboard)/tasks/[id]/TaskDetailClient.tsx` | Client validation ≥1 URL; status label “Needs revision”. |
| `apps/crm/src/app/(dashboard)/tasks/MyCampaignBundles.tsx` | Mobile-friendly grid/cards. |
| `apps/crm/src/components/DashboardShell.tsx` | `min-w-0`, tighter mobile main padding. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/page.tsx` | Submissions section title + empty copy. |
| `apps/crm/src/app/(dashboard)/campaigns/[id]/SubmissionReviewRow.tsx` | “Needs revision” status label. |
| `apps/web/src/components/profile-work/GigDealsPanel.tsx` | Mobile padding / break-words. |
| `apps/web/src/components/profile-work/MyApplicationsPanel.tsx` | Same. |
| `apps/web/.env.example` | `NEXT_PUBLIC_CRM_APP_URL` documented. |
| `docs/PLATFORM_AUDIT_A_TO_Z.md` | ALLOWED_ROUTES note updated. |
| `docs/LAUNCH_BETA_SMOKE_QA.md` | This doc. |

---

## 3) Migrations

**None.**

---

## 4) Route-by-route QA checklist

### Linkary
- [ ] `/login` → app home
- [ ] `/app/profile` — explainer, preview, analytics links
- [ ] `/app/profile/edit` — save
- [ ] `/app/profile/deals` — list, CTAs, CRM link
- [ ] `/app/profile/applications` — list
- [ ] `/app/analytics` — charts, refresh queued (stored data)
- [ ] `/app/analytics/profile/[u]` — loads in shell
- [ ] `/app/org-invites` — inbox
- [ ] `/org/[slug]` — tabs, sourcing vs CRM copy
- [ ] `/{username}` — public profile

### CRM
- [ ] `/tasks` — empty vs filtered empty messaging
- [ ] `/tasks?campaign=` — sync hint if no rows
- [ ] `/tasks/[id]` — submit 1–3 URLs, statuses
- [ ] `/campaigns` — list
- [ ] `/campaigns/[id]` — KPIs, submissions review, report link
- [ ] `/submissions`, `/reports` — CTA to campaigns

---

## 5) Mobile QA checklist (320 / 375 / 390)

- [ ] **CRM** `/tasks` — no horizontal scroll on body; campaign cards readable
- [ ] **CRM** `/tasks/[id]` — title wraps; form usable
- [ ] **CRM** `/campaigns/[id]` — tables scroll horizontally inside card
- [ ] **Web** `/app/profile/deals` — deals list, modals fit width
- [ ] **Web** `/app/profile/applications` — list readable
- [ ] **Web** `/app/profile` — tab row scrolls if needed
- [ ] **Web** `/[username]` — spot-check hero + links

---

## 6) Regression checklist

- [ ] Onboarding untouched
- [ ] Referrals untouched
- [ ] Active context + org switcher
- [ ] Org member gates (jobs, sourcing)
- [ ] Analytics no live scrape on passive load
- [ ] CRM sync trigger unchanged

---

## 7) Release verdict

### Ready for invited beta? **Yes, with ops conditions**

**Conditions before inviting:**
1. Set **`NEXT_PUBLIC_CRM_APP_URL`** on production web to match deployed CRM.
2. One **manual smoke** on staging/prod: creator accept → CRM task → submit → org approve.
3. Confirm **cookie domain** for shared auth between linkary.xyz and crm.linkary.xyz if using CRM logged-in state.

**Blockers (if any):** None in code from this pass; remaining risk is **environment and data** (sync failures, missing workspace link)—handle via support, not new product surface in this pass.
