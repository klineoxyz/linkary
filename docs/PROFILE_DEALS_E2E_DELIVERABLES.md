# Profile Deals E2E — Completed Gig Work Trust-Loop Test Coverage

**Mission:** Add browser/component test coverage for the completed gig work UI on `/profile/deals` so the trust-loop behavior is protected from regressions.

---

## 1. Exact tests added

| Test | File | What it asserts |
|------|------|------------------|
| completed deal row shows Leave review and Create case study from this work | `e2e/profile-deals-trust-loop.spec.ts` | Row for completed deal (not reviewed) shows both buttons. |
| completed deal row: clicking Create case study opens modal with title pre-filled | Same | Click opens case-study modal; heading visible; title input pre-filled with gig title. |
| case study modal: submitting sends POST with gig_deal_id, title, description | Same | Submit triggers POST /api/case-studies with correct payload (gig_deal_id, title, description). |
| active deal row does not show Leave review, shows Complete the work text, no case study CTA | Same | Active row: no "Leave review", has "Complete the work to leave a verified review", no case study button. |
| cancelled deal row has no review CTA and no case study CTA | Same | Cancelled row: no review button, no case study button, no "Complete the work..." text. |
| reviewed completed deal row shows Review submitted and does not show Leave review again | Same | Completed+reviewed row: "Review submitted" visible, no "Leave review" button, still has "Create case study". |

**Total:** 6 Playwright tests in one describe block.

---

## 2. Framework used

- **Playwright** (existing project setup: `test:e2e`, `playwright.config.ts`, `e2e/`).
- No RTL/Jest added; the repo has no `@testing-library/react` and already uses Playwright for e2e, so Playwright was chosen for consistency and to avoid new dependencies.

---

## 3. Behaviors now covered

| Behavior | Covered by |
|----------|------------|
| “Leave review” only for completed, unreviewed gig deals | Test: completed deal row shows Leave review and Create case study. |
| Active deals show only “Complete the work to leave a verified review” (no review button) | Test: active deal row does not show Leave review, shows Complete the work text. |
| “Create case study from this work” only for completed deals | Tests: completed row has button; active/cancelled tests assert button not visible. |
| Clicking “Create case study” opens modal | Test: clicking Create case study opens modal with title pre-filled. |
| Modal pre-fills title with gig title | Same test. |
| Submitting modal sends POST with gig_deal_id, title, description | Test: case study modal submitting sends POST. |
| No review/case study CTA for cancelled | Test: cancelled deal row has no review CTA and no case study CTA. |
| Reviewed completed deal shows “Review submitted”, no “Leave review” again | Test: reviewed completed deal row. |
| No privacy regression in test data | Mock payloads use only work-relevant fields (id, gig_title, status, counterparty public fields); no private metadata. |

---

## 4. Bugs found and fixed

- **None.** No product behavior changes were made. Only test code and minimal `data-testid`/`data-deal-*` attributes were added for stable selectors.

---

## 5. Remaining gaps

- **Auth for e2e:** Tests require an **authenticated session**. Unauthenticated users are redirected to `/login`; the spec calls `test.skip(..., "Profile deals tests require an authenticated session...")` when the URL contains `/login`. To run these tests green, either:
  - Use a Playwright project with `storageState` from a prior login (e.g. global setup that logs in and saves state), or
  - Run against a dev server where you have already logged in in the same browser profile and reuse that state.
- **Review modal:** No e2e coverage for opening the review modal or submitting a review from the deals page (out of scope for this mission).
- **API failure / error states:** No tests for failed POST /api/case-studies or failed GET /api/deals/mine (error message display).

---

## 6. Final regression checklist

- [ ] **Leave review** visible only for completed, unreviewed gig deals.
- [ ] **“Complete the work to leave a verified review”** only on active deals (no review button).
- [ ] **Create case study from this work** only on completed deals; not on active or cancelled.
- [ ] **Case study modal** opens on button click; title pre-filled with gig title.
- [ ] **POST /api/case-studies** receives `gig_deal_id`, `title`, `description` when submitting from modal.
- [ ] **Reviewed completed** row shows “Review submitted” and does not show “Leave review” again.
- [ ] **Cancelled** row has no review CTA and no case study CTA.
- [ ] **No privacy regression:** mocks and page use only work-relevant fields.
- [ ] Run E2E (with auth + Playwright browsers): from **`apps/web`**, run  
  `pnpm exec playwright install` (once), then  
  `pnpm run test:e2e -- e2e/profile-deals-trust-loop.spec.ts`  
  (or `pnpm exec playwright test e2e/profile-deals-trust-loop.spec.ts`).  
  With dev server and authenticated session so redirect to login does not occur.
- [ ] Run API route tests: `pnpm exec vitest run src/app/api` (unchanged; still passing).

---

## 7. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/profile/deals/page.tsx` | Added `data-testid="profile-deals-list"` on `<ul>`, `data-testid="deal-row"` and `data-deal-id` / `data-deal-status` on each `<li>`, `data-testid="case-study-modal"` on case study modal content div. |
| `apps/web/e2e/profile-deals-trust-loop.spec.ts` | **New.** Six Playwright tests; mocks for GET /api/deals/mine and GET /api/reviews/mine; skip when redirected to login. |
| `docs/PROFILE_DEALS_E2E_DELIVERABLES.md` | **New.** This deliverables doc. |

No routes or product behavior changed.
