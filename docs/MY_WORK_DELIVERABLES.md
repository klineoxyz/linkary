# My Work surface — deliverables

Unified “My Work” surface at `/profile/work`: completed org and gig deals in one place with normalized action state and case-study awareness.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| **`apps/web/src/app/api/work/mine/route.ts`** | **New.** `GET /api/work/mine`: auth required; returns completed gig_deals + org deals (profile or org member); normalized fields per item: `alreadyReviewed`, `canReview`, `canCreateCaseStudy`, `reviewActionType` (`gig` \| `org`), `hasCaseStudy`, `caseStudyId`; safe payload only (title, counterparty label, work type, status, completion). |
| **`apps/web/src/app/api/work/mine/route.test.ts`** | **New.** Route tests: 401 without auth; 200 with empty items; 200 with gig item (normalized state); 200 with org item and case study state; no private metadata. |
| **`apps/web/src/app/profile/work/page.tsx`** | **New.** My Work page: auth redirect; fetches `/api/work/mine`; list with work type, counterparty, review state (Review submitted / Leave review / View & review deal), case study state (Case study created + View case study / Create case study from this work); gig review modal + case study modal; org links to `/deal/[id]`; case study POST uses `deal_id` or `gig_deal_id`. |
| **`apps/web/src/app/profile/deals/page.tsx`** | Link “View unified work history” to `/profile/work` in description. |
| **`docs/ROUTE_CONSISTENCY.md`** | **New.** Documents intentional mix: `/app/*` = figma app shell; `/profile/*` = standalone auth pages (deals, work); `/deal/[id]` = org deal detail. |
| **`apps/web/playwright.config.ts`** | Added `my-work.spec.ts` to authenticated project and to chromium testIgnore. |
| **`apps/web/e2e/my-work.spec.ts`** | **New.** E2E: completed org/gig visible; normalized CTAs; case study created state; no private metadata; create case study sends `gig_deal_id`. |

---

## 2. Route consistency

- **No code change to routing.** The mix is **intentional** and documented in **`docs/ROUTE_CONSISTENCY.md`**:
  - **`/app/profile`**, **`/app/profile/edit`** = figma app shell (LinkaryApp).
  - **`/profile/deals`**, **`/profile/work`** = standalone authenticated pages (AppWithProviders, auth redirect, direct URL).
  - **`/deal/[id]`** = org deal detail and review (linked from My Work when `reviewActionType === "org"`).

---

## 3. `/api/work/mine` payload

- **Response:** `{ ok: true, items: WorkItem[] }`.
- **WorkItem** (minimal, safe):
  - `id`, `kind` (`gig` \| `org`), `title`, `status`, `created_at`, `completed_at`, `workTypeLabel` (“Gig work” \| “Org deal”).
  - `counterparty`: `{ display_name, username, label }` (no internal IDs in label).
  - **Normalized action state:** `alreadyReviewed`, `canReview`, `canCreateCaseStudy`, `reviewActionType` (`gig` \| `org` \| null).
  - **Case study:** `hasCaseStudy`, `caseStudyId` (for “View case study” link; optional to render).
  - **Action identifiers (server-only / for CTAs):** `deal_id` (org), `gig_deal_id` (gig), `reviewee_profile_id` (gig review).
- No email, no private workflow metadata, no internal admin fields.

---

## 4. Case-study-created state

- **API:** For each work item, backend checks `case_studies` where `owner_profile_id = me` and `deal_id` or `gig_deal_id` matches; sets `hasCaseStudy` and `caseStudyId`.
- **UI:** If `hasCaseStudy`: show “Case study created” and link “View case study” → `/profile/edit#case-studies`. If not, and `canCreateCaseStudy`: show “Create case study from this work” (modal; POST with `deal_id` or `gig_deal_id`). No fake proof paths; backend still enforces completed + party.

---

## 5. Tests added

- **`apps/web/src/app/api/work/mine/route.test.ts`**: 401; 200 empty; 200 with gig item (normalized state, `gig_deal_id`, `reviewee_profile_id`); 200 with org item and `hasCaseStudy` / `caseStudyId`; no email in response.
- **`apps/web/e2e/my-work.spec.ts`** (authenticated project): completed org and gig visible; gig “Leave review” / “Review submitted”; org “View & review deal” → `/deal/deal-1`; case study created shows “Case study created” and “View case study”; no email in body; create case study from gig sends `gig_deal_id`.

---

## 6. Remaining deferred

- Pagination or limit for large work history.
- Exposing “View case study” to a dedicated case study page (if added) instead of `/profile/edit#case-studies`.
- Adding “My Work” to figma app nav (currently linked from Deals and URL).

---

## 7. Regression checklist

- [ ] **Auth:** `/profile/work` redirects to login when unauthenticated.
- [ ] **Trust:** Org review only via `/deal/[id]` and `POST /api/reviews` with `deal_id`; gig review via modal and `reviewee_profile_id`; case studies only with `deal_id` or `gig_deal_id` and backend party + completed checks.
- [ ] **Privacy:** No email or sensitive fields in work list or API response.
- [ ] **Existing:** `/profile/deals` and `/deal/[id]` behavior unchanged; no regression to existing E2E.
- [ ] **No fake proof:** Case studies only from completed, party-verified work; no new proof paths.
