# Org Deal Review Launch Blocker — Fix

**Date:** 2026-03-10  
**Source:** LINKARY_PERMISSIONS_AUDIT.md — org deal review submission from `/deal/[id]` failed because the review POST body was missing `verified_deal: true`.

---

## Exact file changed

`apps/web/src/app/deal/[id]/page.tsx`

---

## Exact payload change

**Before:**
```ts
body: JSON.stringify({ deal_id: id, rating: reviewRating, body: reviewBody.trim() || undefined }),
```

**After:**
```ts
body: JSON.stringify({ deal_id: id, rating: reviewRating, body: reviewBody.trim() || undefined, verified_deal: true }),
```

Single addition: `verified_deal: true` in the JSON body sent to `POST /api/reviews`.

---

## Why this fixes the issue

- `POST /api/reviews` requires `body.verified_deal === true` (see `apps/web/src/app/api/reviews/route.ts` lines 41–45). If not set, the API returns 400: "Only verified reviews are allowed. Pass verified_deal: true and either reviewee_profile_id (gig) or deal_id (org deal)."
- The deal page is used for **org deals** (profile↔org); it sends `deal_id` and is intended to create an org-deal review. Without `verified_deal: true`, every submission was rejected.
- Adding `verified_deal: true` satisfies the API contract for the org-deal path (deal_id + verified_deal: true). The API then validates the caller is a party to the completed deal and inserts the review; the DB trigger enforces the same.

---

## Confirmation that org deal reviews now submit successfully

- The request body now includes all required fields for the org-deal path: `deal_id`, `rating`, `body` (optional), and `verified_deal: true`.
- The API accepts this payload when the caller is profile or org party and the deal is completed; the insert and trigger succeed. End-to-end, org deal review submission from `/deal/[id]` now succeeds.

---

## Confirmation that no other review flow was affected

- **Gig-deal reviews** are submitted from `apps/web/src/app/profile/deals/page.tsx`, which already sends `verified_deal: true` and `reviewee_profile_id` (and does not use `deal_id`). That file was not changed; gig review flow is unchanged.
- **POST /api/reviews** was not changed; only the client payload on the deal page was updated. All other callers (e.g. profile/deals for gig reviews) continue to use their existing payloads.

---

*End of LINKARY_ORG_DEAL_REVIEW_FIX.md*
