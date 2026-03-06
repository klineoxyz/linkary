# Post-Slice 4 Verification + Polish — Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/spaces/[id]/route.ts` | **GET visibility:** When not host and not public (planned/scheduled/live), allow access if the user has any **sponsor proposal** for that space (project_profile_id = user.id). So cancelled/ended spaces remain hidden to the world but are visible to the host and to project users who have a proposal. Uses `.limit(1)` and array check to avoid .maybeSingle() error when multiple proposal rows exist. |
| `apps/web/src/figma/app/App.tsx` | **Notification labels:** Added `notifLabel` for `sponsor_proposal_accepted` → "Sponsor proposal accepted" and `sponsor_proposal_declined` → "Sponsor proposal declined". Added `notifLink` for both → `/xspaces` so the user can open XSpaces (e.g. My proposals). |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | **Payout prefill:** Prefill only when the field is still empty so we don’t overwrite in-progress input. Use functional update: `setAcceptPayoutAddress((prev) => (prev === "" ? data.wallet_address.trim() : prev))`. |
| `docs/XSPACES_POST_SLICE4_VERIFICATION_DELIVERABLES.md` | **New.** This file. |

**Not changed:** Add from X block, me-stats, public profile routes, PATCH sponsor-proposal logic, PUT payout-preferences validation, my-proposals API/sort, notification creation payloads.

---

## 2. What was verified

### GET /api/spaces/[id]
- **Visibility:** Host can always see. Non-host can see if status is planned/scheduled/live. Cancelled/ended are not exposed to arbitrary users.
- **Gap:** Project users with a proposal on a cancelled/ended space could not open it from My proposals (404). **Fixed** by allowing access when the requester has any `space_sponsor_proposal` row for that space (project_profile_id = user.id).

### Sponsor proposal notifications
- **Written on accept/decline:** Confirmed in PATCH route: after successful accept we call `createNotification(projectProfileId, "sponsor_proposal_accepted", { entity_type, entity_id, payload: { space_id, accepted_at } })`; after decline we call `createNotification(..., "sponsor_proposal_declined", { ..., payload: { space_id } })`.
- **Sensitive data:** Payload contains only `space_id` and (on accept) `accepted_at`. No tokens, wallet addresses, or PII. **Verified.**
- **UI labels:** App has `notifLabel(n)` and `notifLink(n)`. **Fixed** by adding labels and link for `sponsor_proposal_accepted` and `sponsor_proposal_declined`.

### Payout preference behavior
- **Prefill vs manual input:** Prefill runs when the user clicks Accept (async fetch). If the user types before the request returns, we could overwrite. **Fixed** by only setting address when it’s still empty: `setAcceptPayoutAddress((prev) => (prev === "" ? data.wallet_address.trim() : prev))`.
- **linkary_wallet:** Confirmed radio onChange calls `setAcceptPayoutAddress("")` when selecting linkary_wallet; wallet field is hidden when method is linkary_wallet. **Verified.**
- **PUT validation:** Confirmed method in [saved_wallet, linkary_wallet]; for saved_wallet wallet is required (trimmed, non-empty); for linkary_wallet wallet is forced to null; empty string never persisted. **Verified.**

### Final QA sweep (code-level)
- **Accepted/declined again:** PATCH only allows when status === "pending"; returns clear errors for already accepted/declined. **Verified.**
- **My-proposals sorting:** API sorts by status priority (pending, accepted, declined) then by created_at desc. **Verified.**
- **Open space from my-proposals:** Uses GET /api/spaces/[id] when space not in list; with new visibility rule, project users can open their proposal’s space even if it’s ended/cancelled. **Verified + fixed.**
- **Add from X:** No edits to that block; refreshSession, no-request-when-not-signed-in, and error messages unchanged. **Verified.**
- **App.tsx / me-stats / public profile:** Only change in App.tsx is adding two notification labels and one link branch; real-data behavior (completedGigsCount, publicProfilePayload, displayCaseStudies, links) untouched. **Verified.**

---

## 3. What was fixed

1. **GET /api/spaces/[id] visibility** — Project users with a sponsor proposal for the space can now load it (so “Open space” from My proposals works for cancelled/ended spaces). Cancelled/ended spaces remain hidden to everyone else.
2. **Notification labels and link** — `sponsor_proposal_accepted` and `sponsor_proposal_declined` now have user-facing labels and link to `/xspaces`.
3. **Payout prefill overwrite** — Prefill no longer overwrites the wallet field if the user has already typed (functional update, apply only when current value is empty).

---

## 4. Manual QA checklist

- [ ] **GET space visibility:** As host, GET /api/spaces/[id] for your space (any status) → 200. As other user, GET for a planned/scheduled/live space → 200. As other user, GET for a cancelled/ended space → 404. As project user with a proposal on that cancelled space, GET → 200 (after fix).
- [ ] **Open space from my-proposals:** As project user, open a space from My proposals that is ended/cancelled → detail opens without 404.
- [ ] **Notifications:** As host, accept a sponsor proposal → as project user, check notifications → “Sponsor proposal accepted” and link to /xspaces. Same for decline → “Sponsor proposal declined.”
- [ ] **Prefill:** Save default payout (saved_wallet + address). Open accept form, immediately type in wallet field, wait for prefill response → typed value is not overwritten. Open accept form and do not type → address prefills.
- [ ] **linkary_wallet:** Select Linkary wallet → wallet field clears and hides. Submit accept → payout_wallet_address is null in DB.
- [ ] **PUT payout-preferences:** PUT with saved_wallet and empty wallet → 400. PUT with linkary_wallet → wallet stored as null.
- [ ] **Accepted/declined again:** Accept a proposal, then call PATCH accept again → 400 “This proposal was already accepted.” Decline, then PATCH decline again → 400 “This proposal was already declined.”
- [ ] **Add from X:** Not signed in → “Please sign in to add a space from X.” Expired session → “Your session may have expired. Please sign in again.” No code change in that block.
- [ ] **Profile/dashboard:** Profile still shows completed gigs, real case studies, real relations, real links (no regression).

---

## 5. Ready for next phase (reputation + analytics)

**Yes.** The system is ready for a next phase that adds reputation and analytics, with these constraints:

- **Reputation:** Can build on existing data (e.g. sponsor_proposal accepted_at, offer_amount; speaker_request status; reviews) without changing current flows. No schema or API contract changes required for “read-only” reputation views.
- **Analytics:** Same: aggregate from space_sponsor_proposals, speaker_requests, spaces (displayTitle), and existing APIs. Prefer new read-only endpoints or views; avoid changing PATCH/accept/decline or payout preference semantics.
- **Preserved:** Add from X session fix, App/me-stats/public profile real data, GET space visibility rules, notification payloads (no sensitive data), and payout validation remain as verified above.
