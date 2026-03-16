# Collab → Verified Work Handshake (v1)

Minimal, production-safe path so an **accepted collab request** can become **verified work** and enter the trust loop (reviews, case studies) without fake proof or product redesign.

---

## 1. Current collab flow map

| Layer | What exists |
|-------|-------------|
| **Table** | `collab_requests`: id, requester_profile_id, target_profile_id, message, category, budget_text, status (`new` \| `accepted` \| `archived` \| `done`), reply_note, requester_followup_note, seen_at, **converted_gig_deal_id** (added in v1). |
| **APIs** | POST `/api/collab-requests` (create), POST `/api/collab-requests/update` (accept/archive/done + reply_note), GET `/api/collab-requests/inbox`, GET `/api/collab-requests/sent`, POST `/api/collab-requests/[id]/convert` (v1). |
| **UI** | Requests surface in app (Figma/App.tsx): Inbox / Sent tabs; accept → reply note; follow-up; **Convert to verified work** (target only); **View verified work** when converted. |
| **Gap (pre-v1)** | On accept, only `collab_requests.status` was set to `accepted`. No deal or gig_deal was created, so accepted collabs never appeared on `/profile/work` or unlocked reviews/case studies. |

**Where the flow stopped before v1:** At “accepted” — no verified work record, no entry into the trust loop.

---

## 2. Canonical v1 handshake chosen

### 2.1 Role mapping (verified; do not change without product/QA)

| Collab | Gig / gig_deal | Who can complete | Who sees deal (Deals page) | Who sees work (Work page after complete) |
|--------|----------------|------------------|----------------------------|------------------------------------------|
| `target_profile_id` | `gig.owner_profile_id`, `gig_deal.owner_profile_id` | **Target only** (owner) | Target + Requester | Target + Requester (completed only) |
| `requester_profile_id` | `gig_deal.participant_profile_id` | — | Target + Requester | Target + Requester (completed only) |

- **Target** = person who accepted the collab request = **owner** of the created gig and gig_deal. Only the owner can call POST `/api/deals/[id]/complete`.
- **Requester** = **participant** in the gig_deal; they see the deal on `/profile/deals` but cannot complete it. After the target completes, both can leave a review and create case studies linked to the gig_deal.

- **Accepted collab request → one-time convert → create gig + gig_deal (reuse existing trust loop).**
- Only the **target** (person who accepted) can convert.
- Only when status is **accepted** and not already converted.
- One conversion per request (DB: at most one gig_deal per `collab_request_id`).
- Reviews and case studies still require a **completed** gig_deal (unchanged); no review unlock from “accepted” alone.

---

## 2.2 Post-conversion flow verification (completed)

- **Role mapping:** Verified in code and docs: `target_profile_id` → gig/gig_deal owner; `requester_profile_id` → gig_deal participant. Only owner can complete.
- **Surfaces:** Converted gig_deals appear in GET `/api/deals/mine` (and thus `/profile/deals`) for both target and requester; they appear in GET `/api/work/mine` (and thus `/profile/work`) only after status = completed.
- **Completion path:** POST `/api/deals/[id]/complete` allows only the deal owner (target). The `/profile/deals` page shows "Complete" only when `is_owner && status === "active"`, so no UI gap.
- **Trust loop:** Accepted → convert → visible in Deals → owner completes → visible in Work → both parties can review and create case studies (existing rules). No review from accepted-only; no case study without completed deal.

---

## 3. Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260404000000_collab_convert_to_verified_work.sql` | Added `gig_deals.collab_request_id` (nullable FK, unique partial index), `collab_requests.converted_gig_deal_id` (nullable FK). |
| `apps/web/src/app/api/collab-requests/[id]/convert/route.ts` | **New.** POST: auth, load request, enforce target + accepted + not converted; create gig + gig_deal; set `collab_requests.converted_gig_deal_id`. |
| `apps/web/src/app/api/collab-requests/inbox/route.ts` | Select and return `converted_gig_deal_id` so UI can show Convert vs Converted. |
| `apps/web/src/app/api/collab-requests/sent/route.ts` | Select and return `converted_gig_deal_id` for requester view. |
| `apps/web/src/figma/app/App.tsx` | Inbox: for accepted, show “Convert to verified work” or “Converted” + “View verified work” link; Sent: show “Converted” + link when applicable. Added `convertLoading`, `refreshKey`, `convertToVerifiedWork()`. |
| `apps/web/tsconfig.json` | Excluded `e2e` from build so Playwright E2E is not type-checked by Next (fixes Vercel build re `fullConfig`). |
| `apps/web/src/app/api/collab-requests/[id]/convert/route.ts` | Added canonical role-mapping comment (target = owner, requester = participant). |
| `apps/web/src/app/api/deals/[id]/complete/route.test.ts` | **New.** 401, 404, 403 when participant tries to complete, 400 when not active, 200 when owner completes. |
| `apps/web/src/app/api/work/mine/route.test.ts` | Added test: completed gig_deal when user is participant (converted collab requester sees work and can review owner). |

**Completion/UI gap:** None. Converted deals are completable via existing `/profile/deals` Complete button (owner only).

---

## 4. Schema changes

- **`gig_deals`**: `collab_request_id` UUID nullable FK → `collab_requests(id)`; unique partial index so at most one gig_deal per `collab_request_id` where not null.
- **`collab_requests`**: `converted_gig_deal_id` UUID nullable FK → `gig_deals(id)`.

---

## 5. Tests added

- **`apps/web/src/app/api/collab-requests/[id]/convert/route.test.ts`**
  - 400 when id missing.
  - 401 when no token.
  - 404 when request not found.
  - 403 when caller is not the target (only target can convert).
  - 400 when status is not accepted.
  - 200 with “Already converted” when `converted_gig_deal_id` is set (idempotent).
  - 200 and creates gig + gig_deal when accepted and not yet converted.

Existing behavior (unchanged) already enforces:

- **Accepted collab alone does not unlock review:** `GET /api/reviews/can-review` and review creation rely on completed gig_deal (or org deal); no code path uses only `collab_requests.status`.
- **Case studies** require completed deal/gig_deal and party check; no change in v1.

---

## 6. Remaining deferred items

- E2E: automated test that converts from inbox and sees deal on `/profile/work` (optional).
- Optional: show “Converted” badge in inbox list (e.g. next to status) without opening the request.
- Not in scope: changing review/case-study rules or adding a separate “collab-only” proof path.

---

## 7. Regression checklist (final)

- [x] **Role mapping:** target → owner (only they can complete), requester → participant; documented in convert route and §2.1.
- [x] **No review from accept-only:** Reviews still require completed verified work (gig_deal or org deal); accepting a collab does not by itself unlock review.
- [x] **Conversion creates correct object:** Convert creates exactly one gig and one gig_deal; gig_deal has `collab_request_id`; `collab_requests.converted_gig_deal_id` is set.
- [x] **Converted deals visible:** Both parties see deal on `/profile/deals`; after completion both see on `/profile/work`.
- [x] **Only owner can complete:** POST `/api/deals/[id]/complete` returns 403 for participant; UI shows Complete only for owner.
- [x] **Completed converted work unlocks review:** When the new gig_deal is marked completed, existing can-review and create-review flows allow review as for any other completed gig_deal.
- [x] **Case studies:** Case studies can still link only to completed deal_id or gig_deal_id when caller is a party; no new path for unverified collabs.
- [x] **No fake proof:** No review or case study can be created without a completed verified work record; no bypass using only collab_requests.
- [x] **Privacy:** No new public exposure of internal workflow; public profile unchanged.
- [x] **UI:** Inbox (target) shows Convert vs Converted + “View verified work”; Sent shows Converted + link when applicable; no clutter on public profile.
