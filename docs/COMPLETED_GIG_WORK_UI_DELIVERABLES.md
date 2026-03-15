# Completed Gig Work UI — Deliverables

**Mission:** Add the first clean UI flow so creators can view verified completed gig deals and create proof-backed case studies from them, without redesigning Linkary.

---

## 1. UI surface chosen and why

**Chosen:** Extend the existing **profile Deals page** (`/profile/deals` → `apps/web/src/app/profile/deals/page.tsx`).

**Why:**

- This page already fetches **gig_deals** via `GET /api/deals/mine` and shows gig title, counterparty, status, and actions (Complete/Cancel for owner when active).
- No new route or new “My work” list was required; the data and layout were already in place.
- Lightest v1: add completed-only review CTA, “Create case study from this work” for completed gig deals, and correct copy so review is only after completion.

**Alternatives considered:**

- Dedicated gig-deal detail page: would add a new route and more surface; deferred.
- Unified “My work” list mixing org deals and gig deals: would require merging two data sources and more UI; deferred.

---

## 2. Exact files changed

| File | Change |
|------|--------|
| `apps/web/src/app/profile/deals/page.tsx` | (1) Review CTA only when `d.status === "completed"`; for active show “Complete the work to leave a verified review”. (2) 403 review error message updated to “Complete the deal first” / completed-only. (3) “Create case study from this work” button only for completed deals. (4) Case study modal: state, `openCaseStudyModal` / `closeCaseStudyModal` / `submitCaseStudy`, POST `/api/case-studies` with `gig_deal_id`, title, description; toast on success. |
| `apps/web/src/app/api/deals/mine/route.test.ts` | **New.** GET /api/deals/mine: 401 without token; 200 with deals array including status, gig_title, counterparty for completed gig; 200 empty when no deals; response shape (no private metadata beyond work-relevant fields). |

No other files modified. No new routes added.

---

## 3. Routes added

**None.** All behavior lives on the existing `/profile/deals` page.

---

## 4. How completed gig work is shown

- **Source:** `GET /api/deals/mine` (unchanged) returns the current user’s gig_deals with: `id`, `gig_id`, `gig_title`, `status`, `created_at`, `updated_at`, `is_owner`, `counterparty_id`, `counterparty` (username, display_name, avatar_url, profile_type).
- **On the page:** Each deal row shows:
  - Gig title, counterparty (link to `/{username}`), status badge (active / completed / cancelled).
  - **Completed only:** “Leave review” (or “Review submitted” if already reviewed) and “Create case study from this work”.
  - **Active:** For owner, “Complete” / “Cancel”; for all, “Complete the work to leave a verified review” (no review button).
- Only work-relevant, already-exposed fields are used; no new private or admin fields.

---

## 5. How case study creation from gig work works

- **Trigger:** User clicks “Create case study from this work” on a **completed** gig deal row.
- **Guard:** Button is rendered only when `d.status === "completed"`. `openCaseStudyModal(deal)` also checks `deal.status !== "completed"` before opening.
- **Modal:** Title (optional, pre-filled with gig title), description (optional). Cancel closes; “Create case study” calls `submitCaseStudy`.
- **API:** `POST /api/case-studies` with body `{ gig_deal_id: caseStudyModalDeal.id, title, description }`. Existing API enforces: caller is party to the gig deal and gig deal status is completed (400 if not completed, 403 if not party).
- **After success:** Toast “Case study created”, modal closes. No automatic redirect; user can navigate to profile to see the case study.

---

## 6. Review logic (aligned)

- **“Leave review”** is shown only when `d.status === "completed"` and the deal is not already in `reviewedDealIds`.
- **“Review submitted”** when `d.status === "completed"` and the deal has been reviewed.
- **Active deals:** Show text “Complete the work to leave a verified review” (no review button).
- **403 from POST /api/reviews:** Message updated to “You can only leave a verified review after the work is completed. Complete the deal first.”

---

## 7. Tests added

| Test | File | Purpose |
|------|------|---------|
| returns 401 when no token | `api/deals/mine/route.test.ts` | Auth required for GET /api/deals/mine. |
| returns 200 with deals array including status and gig_title for completed gig work | `api/deals/mine/route.test.ts` | Completed gig work appears in API response for UI. |
| returns 200 with empty deals when user has no gig deals | `api/deals/mine/route.test.ts` | Empty state. |
| does not expose private metadata beyond work-relevant fields | `api/deals/mine/route.test.ts` | No privacy regression; only expected fields in response. |

Existing tests (unchanged) that remain relevant:

- **POST /api/case-studies:** `returns 201 with gig_deal_id when caller is party and gig deal is completed`; `returns 403 when gig_deal_id provided but caller not a party`; `returns 400 when gig_deal_id provided but gig deal not completed`.

**Component / E2E:** No RTL or Playwright tests were added for the profile deals page. Recommended follow-up: add E2E or component tests for (1) “Create case study from this work” visible only for completed deals, (2) no CTA for active/cancelled, (3) case study modal submits with `gig_deal_id`.

---

## 8. Remaining deferred items

- **Gig-deal detail page:** Single deal view (e.g. `/profile/deals/[id]`) with full context and case study CTA; optional future enhancement.
- **Unified “My work” list:** Single list mixing org deals and gig_deals with filters/tabs; optional.
- **E2E / component tests** for profile deals page (see Tests added above).

---

## 9. Regression checklist

- [ ] **Review:** “Leave review” only for completed gig deals; active shows “Complete the work to leave a verified review” only.
- [ ] **Case study CTA:** Only for completed gig deals; modal sends `gig_deal_id`; API enforces party + completed.
- [ ] **No CTA for incomplete/cancelled:** “Create case study from this work” not shown for active or cancelled.
- [ ] **No privacy regression:** GET /api/deals/mine and page use only existing work-relevant fields.
- [ ] **No fake proof:** Case studies linked via `gig_deal_id` only when deal is completed and user is party (API + DB).
- [ ] Run: `pnpm exec vitest run` (or `vitest run "src/app/api"`) — all route tests pass, including `deals/mine` and `case-studies`.
