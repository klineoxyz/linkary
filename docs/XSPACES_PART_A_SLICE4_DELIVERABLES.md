# XSpaces Part A + Slice 4 — Deliverables

## 1. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/spaces/[id]/sponsor-proposals/[proposalId]/route.ts` | Sponsor accept safety: specific error messages for already accepted/declined; wallet trim and empty string → null. |
| `apps/web/src/app/api/spaces/[id]/sponsor-proposals/route.ts` | Offer amount validation: must be > 0 and < 1,000,000 with clear error messages. |
| `supabase/migrations/20260310000000_space_sponsor_proposals_updated_at_trigger.sql` | **New.** BEFORE UPDATE trigger to set `updated_at` on `space_sponsor_proposals`. |
| `apps/web/src/figma/app/components/XSpacesPage.tsx` | "Your sponsor proposal" block: added offer amount + currency and sponsorship type; client-side offer validation (0 < amount < 1M); My proposals state, loader, and view; Add from X fix **unchanged**. |
| `apps/web/src/figma/app/components/xspaces/XSpacesSidebar.tsx` | MainNav extended with `"my-proposals"`; "My proposals" nav item with FileText icon. |
| `apps/web/src/app/api/xspaces/my-proposals/route.ts` | **New.** GET /api/xspaces/my-proposals for project-facing list. |
| `docs/XSPACES_PART_A_AND_SLICE4_PLAN.md` | **New.** Implementation plan. |
| `docs/XSPACES_PART_A_SLICE4_DELIVERABLES.md` | **New.** This file. |

---

## 2. Migration / trigger summary

- **Migration:** `20260310000000_space_sponsor_proposals_updated_at_trigger.sql`
- **Function:** `set_space_sponsor_proposals_updated_at()` — sets `NEW.updated_at = now()` in a BEFORE UPDATE trigger.
- **Trigger:** `space_sponsor_proposals_updated_at` on `public.space_sponsor_proposals` FOR EACH ROW BEFORE UPDATE.
- **Option chosen:** DB trigger (matches existing pattern used for `connections`, `partner_programs`). Application code can still send `updated_at` on updates; the trigger overwrites it so the column is always correct.

---

## 3. Routes added/changed

| Method | Route | Change |
|--------|--------|--------|
| PATCH | `/api/spaces/[id]/sponsor-proposals/[proposalId]` | Same contract; only allow when status is `"pending"`; return "This proposal was already accepted." or "This proposal was already declined." when applicable; wallet: trim and store empty as null. |
| POST | `/api/spaces/[id]/sponsor-proposals` | Same contract; validate `offer_amount` > 0 and < 1,000,000; clear error messages. |
| GET | `/api/xspaces/my-proposals` | **New.** Authenticated; returns proposals where `project_profile_id` = current user; includes space display title (linkary_title ?? x_title ?? title), status, offer, type, payout info, host display; sort: pending → accepted → declined, then by created_at desc. |

---

## 4. UI summary

- **Part A — "Your sponsor proposal":** In the space detail (project-side), when the user already has a proposal, the block now shows status, **offer amount + currency**, and **sponsorship type** (one line), compact.
- **Part A — Submit validation:** Client-side check: offer amount must be > 0 and < 1,000,000 before calling POST create.
- **Slice 4 — My proposals:**
  - New sidebar item: **"My proposals"** (MainNav `my-proposals`).
  - When selected: load GET `/api/xspaces/my-proposals` (abortable).
  - **Empty state:** "No sponsorship proposals yet."
  - **List:** Each row shows space title (display), status badge, offer amount + currency, sponsorship type, submitted date; if **accepted**: payout method, wallet (or "Linkary wallet") and accepted date, plus note: "Payment is arranged off-platform between sponsor and host."; **CTA:** "Open space" (opens space detail modal).
  - No payout execution, no escrow, no extra wallet validation; only recorded payout destination shown.

---

## 5. Add from X invalid-session fix — confirmation

**Remains intact.** In `XSpacesPage.tsx` the Add from X flow still:

- Calls `supabase.auth.refreshSession()` before the request.
- Skips the request when there is no token and shows: "Please sign in to add a space from X."
- On 401 with "Invalid session" or "Unauthorized" shows: "Your session may have expired. Please sign in again."

No edits were made to that block (around lines 1432–1477).

---

## 6. Manual QA checklist

- [ ] **Sponsor accept safety:** As host, accept a proposal → try to accept again → see "This proposal was already accepted." Same for decline → accept or decline again.
- [ ] **Wallet:** Accept with one-time wallet; enter address with leading/trailing spaces → stored trimmed; no reformatting.
- [ ] **Offer amount:** Create proposal with 0 or negative → error; with ≥ 1,000,000 → error; with valid amount → succeeds.
- [ ] **updated_at:** After running the new migration, PATCH accept or decline a proposal → confirm `updated_at` is current (e.g. via API or DB).
- [ ] **Your sponsor proposal:** As project, open a space where you have a pending/accepted/declined proposal → block shows status, amount + currency, sponsorship type.
- [ ] **My proposals:** Sign in as a user who has submitted sponsor proposals → open "My proposals" → list shows; sort: pending first, then accepted, then declined; "Open space" opens detail; accepted rows show payout and off-platform note.
- [ ] **My proposals empty:** User with no proposals → "No sponsorship proposals yet."
- [ ] **Add from X:** Not signed in → Add from X → "Please sign in to add a space from X." Signed in with expired session → "Your session may have expired. Please sign in again." Signed in with valid session → sync works.
- [ ] **Existing flows:** Connect X, Add from X (valid session), Detect my Space, Slice 1 title model, Slice 2 speaker applications, Slice 3 inbox/accept/decline — all behave as before.
- [ ] **SSR / smoke / regression:** Run any existing smoke or regression scripts; no new failures.

---

## 7. Follow-up suggestions (future)

- **Speaker reputation:** Track accepted/declined speaker requests per space or host; surface in host UI or analytics.
- **Sponsor reputation:** Optional lightweight “sponsor history” (e.g. count of accepted proposals) for host context; no PII leak.
- **Analytics:** Use `space_sponsor_proposals` (and `accepted_at`, `offer_amount`) for dashboards or reporting (e.g. sponsorship volume, acceptance rate), keeping data in-app and token-based.
