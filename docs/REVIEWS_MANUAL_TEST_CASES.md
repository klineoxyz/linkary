# Reviews – manual test cases (fraud resistance)

Run these after deploying the reviews migration and API.

1. **Review before completion (must fail)**  
   Create a deal (accept an application as org). Do not mark delivered/accepted. As profile or org, POST to `/api/reviews` with `{ "deal_id": "<deal_id>", "rating": 5 }`.  
   **Expected:** 400 with message that reviews only allowed for completed deals (DB trigger or API).

2. **Non-party tries to review (must fail)**  
   Complete a deal (mark delivered, then accepted). As a different user who is neither the profile nor org member, POST to `/api/reviews` with that deal_id.  
   **Expected:** 403 "You are not a party to this deal".

3. **Duplicate review by same reviewer (must fail)**  
   Complete a deal. As the profile, submit a review via POST `/api/reviews`. Repeat the same request.  
   **Expected:** Second request 409 or DB unique violation (one review per deal per reviewer).

4. **Self-review attempt (must fail)**  
   If you could send reviewer = reviewee (e.g. same profile_id for both), DB trigger should reject.  
   **Expected:** Trigger raises "Self-review is not allowed". (API does not allow setting reviewee; it’s derived from deal.)

5. **Both parties can review once (must pass)**  
   Complete a deal. As profile, POST a review (rating + optional body). As org admin, POST a review for the same deal.  
   **Expected:** Both succeed; public profile/org page shows both reviews (verified_deal = true).

6. **Mark delivered / accepted (must pass)**  
   As profile: POST `/api/deals/:id/mark-delivered`. As org admin: POST `/api/deals/:id/mark-accepted`.  
   **Expected:** 200; deal has delivered_at, then accepted_at and status = completed (trigger sets completed_at).

7. **Only creator can mark delivered**  
   As org admin, POST `/api/deals/:id/mark-delivered`.  
   **Expected:** 403.

8. **Only org admin can mark accepted**  
   As profile (creator), POST `/api/deals/:id/mark-accepted`.  
   **Expected:** 403.
