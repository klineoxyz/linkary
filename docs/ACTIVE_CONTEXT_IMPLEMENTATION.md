# Active context & org-mode UX — implementation (first pass)

## Experts for this pass

| Expert | Role |
|--------|------|
| **Product / domain** | `personal` vs `org:{id}` maps to profile gigs vs org jobs/KOL/deals |
| **Next.js / session** | HttpOnly cookie + Bearer validation on `/api/me/active-context` |
| **Supabase / RLS** | Org list + validation from `org_members` + `orgs` |
| **UX / IA** | Distinct org sidebar (indigo), “Acting as” switcher, gig vs job deal copy |
| **QA** | Sign-out clears context cookie; invalid org cookie falls back to personal |

---

## 1. Files touched

| File | Change |
|------|--------|
| `apps/web/src/lib/active-context.ts` | Cookie name, encode/deparse `personal` / `org:uuid` |
| `apps/web/src/app/api/me/active-context/route.ts` | GET (resolve + memberships), POST (validate `org_members`, set cookie) |
| `apps/web/src/figma/app/App.tsx` | `ActingAsContextSwitcher`, org vs personal `Sidebar`, `Topbar`, `activeCtx` state, sign-out POST |
| `apps/web/src/figma/app/components/circles/KOLListsPage.tsx` | `activeOrgContextId` → org-only lists + org-scoped create |
| `apps/web/src/app/profile/deals/page.tsx` | Copy: **Gig deals** vs job deals |
| `apps/web/src/app/deal/[id]/page.tsx` | Title **Job deal** + short explainer |

---

## 2. Active-context model

- **Cookie:** `linkary_active_context` = `personal` \| `org:<uuid>` (httpOnly, SameSite=Lax, 1y).
- **Authority:** POST org context only if `org_members` has a row for `auth.uid()` and that `org_id`.
- **GET:** Re-reads cookie; if `org:` id ∉ memberships → treat as **personal** (stale cookie ignored for UI until next POST).

---

## 3. UI surfaces

- **Switcher:** Sidebar (when user has ≥1 org) + duplicate in **Topbar** for visibility.
- **Personal mode:** Existing nav + **Gig deals** link to `/app/profile/deals`.
- **Org mode:** Indigo shell; **Org overview**, **Jobs & sprints (manage)**, **Browse marketplace**, **KOL lists (org)**, **Team & admins**, **Creator programs**; **Personal account** subsection (profile, personal dashboard, gig deals, personal analytics).

---

## 4. Behavior after pass

| | **Personal** | **Org** |
|--|--------------|--------|
| Nav | Full personal + work + network | Org-first + compact personal |
| KOL lists | All lists (profile + all orgs user belongs to) | Only active org’s lists |
| Dashboard | Personal `DashboardPage` | Use **Org overview** for org metrics |
| Deals copy | `/profile/deals` = gig deals | `/deal/[id]` = job deal |

---

## 5. Copy / naming

- Gig deals (profile marketplace) vs **Job deal** (org job pipeline).
- Notifications: “Job deal …” for org deal events.
- New application → deep link to **`/org/{org_id}?tab=jobs`** when `payload.org_id` present.

---

## 6. Org operator workspace (second pass)

- **OrgDetailPage** first tab renamed **Workspace**: operator hub with real counts (open jobs, pending applicants, active job deals from `deals`, org KOL list count), primary CTAs (Jobs, KOL lists, Team, Creator programs), “Needs attention” when pending apps or active deals exist.
- **KOL from org page**: `navigateOrgOperatorKolLists` + `onActiveContextChange(..., "kolLists")` sets cookie and opens org-scoped KOL lists.
- **Jobs tab**: pipeline copy, empty states, creator-program empty CTA.
- **Members tab**: operational team callout (`org_members` vs profile showcase).
- **Back** from org page → app overview (not personal dashboard).

## 7. Later phases

- Optional default-to-single-org on first visit.
- Unified “all deals” view (gig + job).
- Org-owned gigs (`gigs.org_id`).
- Finer roles than `org_members.role`.

**Org authority:** unchanged — `org_members` only; not `profile_type`.
