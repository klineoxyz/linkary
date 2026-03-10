# Search → Profile View: Behavior and Privacy

**Summary:** When a user searches for another user and clicks a result, they are taken to that creator’s **in-app profile** at **`/u/username`** (e.g. linkary.xyz/u/alice). There they see the same public-safe content as on the public profile, and **if they have a completed collaboration** with that creator they can **leave a review with stars** on that page. Projects/orgs continue to leave reviews after a campaign from the **deal page** (`/deal/[id]`). Private info (location, post/podcast pricing) is only shown when the profile owner has made it public.

---

## 1. Search and navigation

| Step | What happens |
|------|-------------------------------|
| User types in global search | `GlobalSearch` calls `/api/search?q=...`. |
| User clicks a **person** result | `result.url` is **`/u/{username}`** → navigates to the **in-app profile** at `/u/[username]` (e.g. linkary.xyz/u/alice). |
| User clicks a **project/org** result | `result.url` is `/{slug}` → public org page. |

So: **search (people) → `/u/username`** (normal in-app profile view, login required). **Search (orgs) → `/{slug}`** (public org view).

---

## 2. Privacy: what the viewer can and cannot see

- Only **published** profiles/orgs appear in search (`public_profile_view` / `public_org_view`).
- **Location** is shown only when the profile owner has set `profiles.meta.public_location === true`.
- **Pricing** (post price, podcast price, etc.) is shown only when `profiles.meta.public_pricing === true` and pricing is set in `meta.pricing`.
- **Analytics** (followers, engagement, xscore) are gated by `analytics_visibility` on the public view.

So: **the viewer does not see location or post/podcast pricing unless the profile owner has made them public.**

---

## 3. Leaving a review

- **From `/u/username` (creator profile):**  
  If the logged-in viewer has a **completed deal** (org deal or gig deal) with that creator and has not yet left a review, a **“Leave a review”** block is shown with **star rating (1–5)** and optional comment. Submitting calls `POST /api/reviews` with `deal_id` (org) or `reviewee_profile_id` (gig) and `verified_deal: true`. Only verified (deal-based) reviews are allowed.

- **From the deal page (projects after a campaign):**  
  After an org deal is completed, the project/org admin or the creator can leave a review from **`/deal/[id]`** with stars and optional comment. Same `POST /api/reviews` contract with `deal_id` and `verified_deal: true`.

- **Gig deals:**  
  Either party can leave a review from **Profile → Deals** or, when visiting the other party’s profile at `/u/username`, via the “Leave a review” block if a completed gig deal exists and no review was submitted yet.

---

## 4. APIs involved

- **Search:** `/api/search` returns people with `url: "/u/{username}"` and orgs with `url: "/{slug}"`.
- **Can I review this user?** `GET /api/reviews/can-review?username=alice` returns `{ canReview, dealId?, revieweeProfileId?, dealType? }` when the current user has a completed org or gig deal with that profile and has not yet submitted a review.
- **Submit review:** `POST /api/reviews` with `deal_id` (org) or `reviewee_profile_id` (gig), `rating` (1–5), optional `body`, and `verified_deal: true`.

---

## 5. Summary

- **Search (people) → `/u/username`** (in-app profile; login required).
- **Private info** (location, pricing) only shown when the owner has set the corresponding public flags.
- **Leave a review** from `/u/username` when the viewer has a completed collaboration (org or gig); projects also leave reviews from `/deal/[id]` after a campaign. All reviews are verified (deal-based) with star rating and optional comment.
