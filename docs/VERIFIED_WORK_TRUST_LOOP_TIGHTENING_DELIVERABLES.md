# Verified-Work Trust Loop Tightening — Deliverables

**Mission:** Align review eligibility and case-study linkage to the canonical v1 rule: reviews only after **completed** verified work. Gig reviews were previously allowed for **active** gig deals; this is fixed.

---

## 1. Exact logic verified

### 1.1 Before (incorrect)

| Location | Logic | Issue |
|----------|--------|------|
| **GET /api/reviews/can-review** | Gig deals: `.in("status", ["active", "completed"])` | Allowed canReview when gig_deal was still active. |
| **POST /api/reviews** | Gig deal lookup: `.in("status", ["active", "completed"])` | Allowed submitting a review for an active gig deal. |
| **DB trigger** `reviews_check_deal_and_parties()` | Gig path: `IF g.status NOT IN ('active', 'completed')` | Allowed insert when status was 'active'. |

### 1.2 After (correct)

| Location | Logic |
|----------|--------|
| **GET /api/reviews/can-review** | Gig deals: `.eq("status", "completed")` only. Org unchanged (already `.eq("status", "completed")`). |
| **POST /api/reviews** | Gig deal: `.eq("status", "completed")`; 403 message: "Verified review requires a completed gig deal. Complete the work first." |
| **DB trigger** | New migration replaces function: gig path requires `g.status = 'completed'`; org path unchanged. |

### 1.3 Case-study linkage (proof-backed)

| API | Rule |
|-----|------|
| **POST /api/case-studies** | When `deal_id` is set: deal must exist, be **completed**, and caller must be party (profile or org admin). When `gig_deal_id` is set: gig deal must exist, be **completed**, and caller must be party. Returns 400 if deal/gig_deal not completed. |

---

## 2. Was gig review incorrectly allowed while active?

**Yes.** All three layers allowed it:

- **can-review** returned `canReview: true` for active gig deals.
- **POST /api/reviews** accepted a review for an active gig deal (and would have inserted if trigger allowed).
- **DB trigger** allowed insert when `gig_deals.status` was `'active'` or `'completed'`.

Reviews are now allowed only after **completed** work for both org and gig.

---

## 3. Exact files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/reviews/can-review/route.ts` | Gig deals query: `.in("status", ["active", "completed"])` → `.eq("status", "completed")`. Comment updated to "completed only". |
| `apps/web/src/app/api/reviews/route.ts` | Gig deal fetch: `.in("status", ["active", "completed"])` → `.eq("status", "completed")`. 403 message updated to mention "completed gig deal". |
| `supabase/migrations/20260403000000_reviews_gig_completed_only.sql` | **New.** Replaces `reviews_check_deal_and_parties()`: gig path requires `g.status = 'completed'`; org path unchanged. |
| `apps/web/src/app/api/case-studies/route.ts` | When `deal_id`: require `d.status === "completed"` (400 otherwise). When `gig_deal_id`: require `g.status === "completed"` (400 otherwise). Select `status` for both. |
| `apps/web/src/app/api/reviews/can-review/route.test.ts` | Added test: "returns canReview false for gig when no completed gig deal (completed-only rule)". Renamed test: "returns canReview true for gig deal when completed (completed-only)". |
| `apps/web/src/app/api/reviews/route.test.ts` | Added test: "returns 200 with review when gig deal is completed and caller is party". 403 test error message matcher includes "completed". |
| `apps/web/src/app/api/case-studies/route.test.ts` | deal/gigDeal mocks include `status`. Added tests: 400 when deal not completed; 201 with gig_deal_id when party and completed; 403 when gig_deal_id and not party; 400 when gig_deal_id and not completed. Fixed 201 deal test to use `status: "completed"`. |

---

## 4. Tests added / updated

| Test | File | Purpose |
|------|------|---------|
| returns canReview false for gig when no completed gig deal (completed-only rule) | can-review/route.test.ts | Ensures no canReview when no completed gig deal. |
| returns canReview true for gig deal when completed (completed-only) | can-review/route.test.ts | Renamed; ensures canReview true only for completed gig deal. |
| returns 200 with review when gig deal is completed and caller is party | reviews/route.test.ts | POST review success path for completed gig. |
| returns 400 when deal_id provided but deal not completed | case-studies/route.test.ts | Case study link only to completed org deal. |
| returns 201 with gig_deal_id when caller is party and gig deal is completed | case-studies/route.test.ts | Case study link to completed gig deal. |
| returns 403 when gig_deal_id provided but caller not a party | case-studies/route.test.ts | Reject non-party. |
| returns 400 when gig_deal_id provided but gig deal not completed | case-studies/route.test.ts | Case study link only to completed gig deal. |

---

## 5. Review UX

- **LeaveReviewBlock** (unchanged): Uses `reason` from can-review; shows "You've already left a review for this creator." or "Reviews are available after a completed collaboration with this creator." when `canReview` is false. No review form before eligibility.
- **Reason strings** remain accurate: "already_reviewed" and "no_eligible_deal" (no eligible **completed** deal).

---

## 6. Remaining deferred

- **Create case study from completed gig work (UI):** No dedicated gig-deal detail page yet. "Create case study from this work" exists for **org** deals on DealDetailPage. Adding the same for gig deals would require a gig-deal detail view or a "My work" list that includes completed gig_deals with a "Create case study" action. Deferred.
- **Org deal not completed (case study):** API already returns 400 when linking case study to non-completed org deal; covered by test.

---

## 7. Final regression checklist

- [ ] **Org review:** Only after deal completed (mark-delivered + mark-accepted). can-review and POST and trigger unchanged for org.
- [ ] **Gig review:** Only after gig_deal status = completed. can-review and POST and DB trigger all require completed.
- [ ] **No self-review** (API + trigger).
- [ ] **No non-party review** (API + trigger).
- [ ] **Case study link:** deal_id / gig_deal_id only when deal/gig_deal is completed and caller is party (400 when not completed, 403 when not party).
- [ ] **UI:** LeaveReviewBlock shows form only when canReview; shows reason message when !canReview.
- [ ] Run: `pnpm exec vitest run "src/app/api/reviews" "src/app/api/case-studies"` (all 27 tests pass).
- [ ] Apply migration: `20260403000000_reviews_gig_completed_only.sql` (gig review trigger completed-only).
- [ ] No privacy regression; no fake proof paths.
