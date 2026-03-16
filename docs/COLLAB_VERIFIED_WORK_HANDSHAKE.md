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

- **Accepted collab request → one-time convert → create gig + gig_deal (reuse existing trust loop).**
- Only the **target** (person who accepted) can convert.
- Only when status is **accepted** and not already converted.
- One conversion per request (DB: at most one gig_deal per `collab_request_id`).
- Reviews and case studies still require a **completed** gig_deal (unchanged); no review unlock from “accepted” alone.

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

## 7. Regression checklist

- [ ] **No review from accept-only:** Reviews still require completed verified work (gig_deal or org deal); accepting a collab does not by itself unlock review.
- [ ] **Conversion creates correct object:** Convert creates exactly one gig and one gig_deal; gig_deal has `collab_request_id`; `collab_requests.converted_gig_deal_id` is set.
- [ ] **Completed converted work unlocks review:** When the new gig_deal is marked completed, existing can-review and create-review flows allow review as for any other completed gig_deal.
- [ ] **Case studies:** Case studies can still link only to completed deal_id or gig_deal_id when caller is a party; no new path for unverified collabs.
- [ ] **No fake proof:** No review or case study can be created without a completed verified work record; no bypass using only collab_requests.
- [ ] **Privacy:** No new public exposure of internal workflow; public profile unchanged.
- [ ] **UI:** Inbox (target) shows Convert vs Converted + “View verified work”; Sent shows Converted + link when applicable; no clutter on public profile.
