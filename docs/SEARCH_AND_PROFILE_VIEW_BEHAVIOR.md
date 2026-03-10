# Search → Profile View: Behavior and Privacy

**Summary:** When a user searches for another user (or project/agency) and clicks a result, they are taken to that entity’s **public profile** at `/{username}` or `/{slug}`. The viewer does **not** see personal/private info (e.g. location, post/podcast pricing) unless the profile owner has explicitly made those public. Reviews are **not** left from the profile page; they are left from the **deal page** after a completed collaboration.

---

## 1. Current behavior

| Step | What happens |
|------|-------------------------------|
| User types in global search | `GlobalSearch` (e.g. "Search creators, projects, agencies...") calls `/api/search?q=...`. |
| User clicks a result | `onResultClick` runs → `router.push(result.url)`. |
| People | `url` is `/{username}` (e.g. `/alice`) → loads the **public profile** page `(public)/[username]/page.tsx`. |
| Projects/agencies | `url` is `/{slug}` (e.g. `/acme`) → loads the **public org** page (same or similar public view). |

So: **search → click → public profile**. That is the correct “other user viewing” experience: the viewer sees only what the owner has chosen to make public, not the full “normal” (edit) profile.

---

## 2. Privacy: what the viewer can and cannot see

- **Only published profiles/orgs** appear in search (search uses `public_profile_view` / `public_org_view`, which are restricted to `published = true`).
- **Location** is included in the public payload only when the profile owner has set `profiles.meta.public_location === true`. Otherwise it is not sent and not shown.
- **Pricing** (e.g. post price, podcast price) is included only when `profiles.meta.public_pricing === true` and the owner has set pricing in `meta.pricing`. Otherwise the pricing block is not shown.
- **Analytics** (followers, engagement, xscore, etc.) are gated by `analytics_visibility` in the public view (e.g. `public_profile_view`): private profiles do not expose those fields.

So: **the viewer does not see location or post/podcast pricing (or other private fields) unless the user has agreed to make them public.** No code change is required for this; it is already enforced in the public profile page and payload.

---

## 3. Leaving a review

- **Reviews are not left from the profile page.** In Linkary, reviews are **verified** and only allowed after a **completed deal** (org deal or gig deal).
- **Org deal:** After an org deal is completed, the creator or org admin leaves a review from the **deal page** (`/deal/[id]`).
- **Gig deal:** After a gig deal is completed, either party leaves a review from **Profile → Deals** (`/profile/deals`).
- So: **search → profile** is for **discovery and viewing**. **Leave review** is a separate step that happens from the **deal flow**, not from the profile view. The current design is intentional: you can only review someone you have a completed collaboration with.

---

## 4. Summary

- **Search → click** correctly goes to the **public profile** at `/{username}` (or org at `/{slug}`).
- **Private info** (location, pricing, etc.) is only shown when the profile owner has set the corresponding public flags (`public_location`, `public_pricing`) in their profile meta.
- **Reviews** are submitted from the deal page after a completed deal, not from the profile page.

No change is required for the behavior you described; the app already implements it.
