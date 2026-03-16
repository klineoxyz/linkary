# Collab → Verified Work Handshake — E2E Deliverables

End-to-end browser coverage for the collab → verified work handshake so the real user journey is protected from regressions.

---

## 1. Exact tests added

**File:** `apps/web/e2e/collab-verified-work-handshake.spec.ts`

| # | Test | What it covers |
|---|------|----------------|
| 1 | **Inbox conversion** | Authenticated target opens `/app/work/requests`; inbox mock returns one accepted request; select request → "Convert to verified work" visible; click → POST `/api/collab-requests/[id]/convert`; UI updates to "Converted to verified work" and "View verified work" link. |
| 2a | **Post-conversion visibility (target)** | Mock `/api/deals/mine` with one deal (is_owner: true, status: active). Goto `/profile/deals` → deal visible, "You are the owner", Complete button visible. |
| 2b | **Post-conversion visibility (requester)** | Mock deals with is_owner: false. Goto `/profile/deals` → deal visible, "You are the participant", no Complete button, "Complete the work to leave a verified review" text. |
| 2c | **No work before completion** | Mock `/api/work/mine` with items: []. Goto `/profile/work` → list visible, "Collab work with" not present. |
| 3a | **Completion flow (owner)** | Mock deals (active, is_owner: true); mock POST complete → 200 and flip status. Goto deals → click Complete → row shows completed; then mock work/mine with one completed item, goto `/profile/work` → "Collab work with @e2erequester" visible. |
| 3b | **Participant cannot complete** | Mock deals with is_owner: false. Goto deals → no Complete button, "You are the participant" and "Complete the work to leave a verified review" visible. |
| 4a | **Trust loop: active = no review/case study** | Mock one active deal. Goto deals → row has no "Leave review", no "Create case study from this work", has "Complete the work to leave a verified review". |
| 4b | **Trust loop: completed = review + case study CTA** | Mock one completed deal. Goto deals → row has "Leave review" and "Create case study from this work". |

**Config:** `apps/web/playwright.config.ts` — added `**/collab-verified-work-handshake.spec.ts` to authenticated project `testMatch` and to chromium `testIgnore`.

**UI (minimal data-testid):**

- `apps/web/src/figma/app/App.tsx`: `data-testid="collab-request-row"` and `data-request-id={r.id}` on inbox/sent request row; `data-testid="collab-converted-block"` on the "Converted to verified work" block.

---

## 2. What is mocked vs real

| Layer | Mocked | Real |
|-------|--------|------|
| **Auth** | — | Real Supabase session from global setup (storageState). If E2E_TEST_USER_* not set, tests skip locally; CI fails if auth missing. |
| **GET /api/collab-requests/inbox** | Yes. Returns one accepted request; after POST convert, mutable state returns same request with `converted_gig_deal_id` set. | — |
| **GET /api/collab-requests/sent** | Yes. Empty list for inbox test. | — |
| **POST /api/collab-requests/[id]/convert** | Yes. 200 + body; flips inbox mock state so next GET returns converted. | — |
| **GET /api/deals/mine** | Yes. Payload varies per test (owner vs participant, active vs completed). | — |
| **GET /api/reviews/mine** | Yes. Empty or as needed. | — |
| **GET /api/work/mine** | Yes. Empty or one completed item. | — |
| **POST /api/deals/[id]/complete** | Yes. 200 (owner) or 403 (participant). | — |
| **App pages** | — | Real Next.js app and Figma UI. |
| **Navigation** | — | Real routing to `/app/work/requests`, `/profile/deals`, `/profile/work`. |

No real Supabase DB or real collab/deal records are required for these E2E runs; all API responses are route-mocked for deterministic, CI-friendly behavior.

---

## 3. User journey covered end-to-end

1. **Target: accept → convert → see deal → complete → see work → review/case study**
   - Inbox: accepted request → Convert to verified work → Converted + View verified work (test 1).
   - Deals: converted deal visible as owner, Complete button (test 2a).
   - Complete (test 3a): click Complete → deal completed → goto Work → completed work visible.
   - Trust loop (test 4a, 4b): active → no review/case study; completed → Leave review + Create case study.

2. **Requester: see deal, cannot complete, then after completion see work**
   - Deals: converted deal visible as participant, no Complete button (test 2b, 3b).
   - Work: no converted deal before completion (test 2c); after completion (covered by same flow as 3a with work mock) work appears.

3. **Rules enforced by tests**
   - Accepted collab alone does not unlock review (4a: active deal has no review/case study CTA).
   - Only target can convert (test 1 uses single user as target; convert API mocked for target flow).
   - Target = owner, requester = participant (2a vs 2b: is_owner true vs false).
   - Only owner can complete (2a has Complete; 2b/3b no Complete for participant).
   - Both parties see deal on `/profile/deals` (2a, 2b).
   - Work only after completion (2c empty work; 3a work appears after complete).
   - Review and case study only after completion (4a vs 4b).

---

## 4. Bugs found and fixed

- None. Implementation and E2E were written against the existing product behavior; no product logic was changed except adding the minimal data-testid attributes above.

---

## 5. Remaining gaps

- **Inbox test against real backend:** Optional future addition: one E2E that uses real Supabase (test user as target, second user as requester) to create an accepted collab, convert, then assert deal/work/review with real API. Not in scope for this deliverable.
- **Two-user flow in one spec:** Current tests use a single authenticated user and mock both “target” and “requester” views by changing mock payloads; they do not switch storageState to a second user.
- **E2E run environment:** Tests require a running app (Playwright webServer or `PLAYWRIGHT_NO_WEB_SERVER=1` with app started separately). In CI, ensure webServer is started or baseURL points to a deployed preview.

---

## 6. Final regression checklist

- [x] **Inbox conversion:** Accepted collab shows Convert → click calls POST convert → UI shows Converted and View verified work link.
- [x] **Deals visibility:** Converted deal appears for target (owner) and requester (participant) on `/profile/deals`.
- [x] **Owner only Complete:** Owner sees Complete button; participant does not.
- [x] **Work only after completion:** Converted deal does not appear on `/profile/work` before completion; after completion it appears (mocked).
- [x] **Trust loop:** Active deal → no Leave review, no Create case study CTA; completed deal → both CTAs visible.
- [x] **No fake proof:** Mocks do not expose review/case study for non-completed work; tests assert active vs completed behavior.
- [x] **Minimal testids:** Only `collab-request-row`, `data-request-id`, and `collab-converted-block` added; rest by role/text.
- [x] **CI-friendly:** All APIs mocked; deterministic; no dependency on real collab data.
