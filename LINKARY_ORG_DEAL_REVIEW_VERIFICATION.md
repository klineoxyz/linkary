# Org Deal Review Blocker — Targeted Verification

**Date:** 2026-03-10  
**Scope:** Verify the single fix from LINKARY_ORG_DEAL_REVIEW_FIX.md: org deal review submission from `/deal/[id]` now works; gig review flow unchanged.

---

## 1. /deal/[id] now sends verified_deal: true in the review POST body

**Result:** **PASS**

**Evidence:**
- File: `apps/web/src/app/deal/[id]/page.tsx`
- Line 117:  
  `body: JSON.stringify({ deal_id: id, rating: reviewRating, body: reviewBody.trim() || undefined, verified_deal: true }),`
- The request body includes `verified_deal: true` together with `deal_id`, `rating`, and `body`, matching the org-deal contract for `POST /api/reviews`.

---

## 2. POST /api/reviews accepts the payload for completed org deals

**Result:** **PASS**

**Evidence:**
- File: `apps/web/src/app/api/reviews/route.ts`
- Lines 41–45: API requires `body.verified_deal === true`; otherwise returns 400.
- Lines 51–109: When `body.deal_id` is provided and `verified_deal === true`, the handler loads the deal, checks `status === 'completed'`, checks caller is profile or org party, then inserts the review. No change was required in the API; the client now sends the required field, so the existing logic accepts the payload and completes the flow for completed org deals.

---

## 3. Org deal review submission now succeeds end to end

**Result:** **PASS**

**Evidence:**
- Client: `/deal/[id]` sends `{ deal_id, rating, body?, verified_deal: true }`.
- API: Requires `verified_deal: true` and `deal_id` for org path; validates party and completed deal; inserts into `reviews` with `deal_id` set.
- DB: Trigger `reviews_check_deal_and_parties` enforces completed deal and parties; insert succeeds when conditions are met.
- No other code path uses the deal page for reviews; this is the only org-deal review UI. End-to-end, org deal review submission now succeeds when the user is a party and the deal is completed.

---

## 4. Gig review flow is unchanged

**Result:** **PASS**

**Evidence:**
- Gig-deal reviews are submitted from `apps/web/src/app/profile/deals/page.tsx` (lines 173–182), which sends `reviewee_profile_id`, `rating`, `title`, `body`, and `verified_deal: true`. No edits were made to this file.
- `POST /api/reviews` gig path (reviewee_profile_id, verified_deal: true) is unchanged. Only the deal page (`/deal/[id]`) was updated to add `verified_deal: true` for the org-deal path. Gig review flow is unchanged.

---

## 5. Any remaining issue related to reviews

**Result:** None identified in this verification.

- Org deal review: fixed (client sends `verified_deal: true`).
- Gig deal review: already sent `verified_deal: true`; no change.
- API and DB behavior for both paths unchanged; only the deal page payload was corrected.

---

## 6. Final statement

**Review blocker resolved.**

The org deal review launch blocker is fixed. `/deal/[id]` now sends `verified_deal: true` in the review POST body, the API accepts the payload for completed org deals, and org deal review submission succeeds end to end. The gig-deal review flow is unchanged and remains correct.

---

*End of LINKARY_ORG_DEAL_REVIEW_VERIFICATION.md*
