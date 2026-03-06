# XSpaces Part A (Production Improvements) + Slice 4 (My Proposals) — Implementation Plan

## Part A — Small Production Improvements

### 1. Sponsor accept safety
- **Where:** `apps/web/src/app/api/spaces/[id]/sponsor-proposals/[proposalId]/route.ts`
- **Current:** Already allows actions only when `status === "pending"` (returns 400 "Proposal is not pending").
- **Change:** Keep the single fetch; return **specific** error messages when not pending:
  - If `status === "accepted"` → 400, `"This proposal was already accepted."`
  - If `status === "declined"` → 400, `"This proposal was already declined."`
- **Risk:** None; idempotent and clearer for clients.

### 2. Wallet input cleanup
- **Where:** Same PATCH route (accept path).
- **Change:** Trim `payout_wallet_address` before validation; after trim, treat empty string as null when storing (never store `""`). No reformatting of address; preserve value exactly after trim and length cap only.
- **Risk:** None.

### 3. Offer amount validation
- **Where:** `apps/web/src/app/api/spaces/[id]/sponsor-proposals/route.ts` (POST create).
- **Change:** Validate `offer_amount`: must be `> 0` and `< 1_000_000`. Reject with clear, safe messages: e.g. `"Offer amount must be greater than 0"`, `"Offer amount must be less than 1,000,000"`.
- **Risk:** None; backward compatible for valid inputs.

### 4. updated_at correctness
- **Option chosen:** DB trigger (project already uses table-specific `set_*_updated_at` in migrations, e.g. `connections`).
- **Change:** New migration: create `set_space_sponsor_proposals_updated_at()` and BEFORE UPDATE trigger on `space_sponsor_proposals`. Keeps `updated_at` correct regardless of app code.
- **Risk:** Low; trigger is standard pattern in this codebase.

### 5. Tiny UX — "Your sponsor proposal"
- **Where:** `XSpacesPage.tsx` — block that shows "Your sponsor proposal" + status for project-side users when they already have a proposal.
- **Change:** Show status, **offer amount** (with currency), and **sponsorship type** in the same compact token-based block. No redesign.
- **Risk:** None.

### 6. Preserve Add from X session fix
- **Where:** `XSpacesPage.tsx` (Add from X button handler).
- **Action:** No changes to that block: keep `refreshSession()` before request, no request when not signed in, and clean expired-session messaging.
- **Risk:** N/A.

---

## Part B — Slice 4: Project Dashboard / My Proposals

### API: GET /api/xspaces/my-proposals
- **Auth:** Authenticated user only (Bearer token; 401 if missing/invalid).
- **Logic:** Return rows from `space_sponsor_proposals` where `project_profile_id = auth user id`. Join `spaces` for `linkary_title`, `x_title`, `title`; compute display title as `linkary_title ?? x_title ?? title`. Optionally join host profile for display name/username if cheap (one extra select by host_profile_id).
- **Fields:** id, space_id, display space title, status, offer_amount, currency, sponsorship_type, message, requested_deliverables, payout_method, payout_wallet_address, accepted_at, created_at, updated_at; host display (if we add it).
- **Sort:** Pending first, then accepted, then declined; within each group, most recent first (order by status priority, then created_at desc).
- **File:** `apps/web/src/app/api/xspaces/my-proposals/route.ts` (new).

### UI: My sponsorship proposals
- **Placement:** Extend `MainNav` with one new item: `"my-proposals"` (label "My proposals", icon e.g. FileText or Briefcase). Least disruptive and matches "Inbox" (host) with a clear project-side counterpart.
- **Data:** When `mainNav === "my-proposals"`, call GET `/api/xspaces/my-proposals` (abortable loader), store in state (e.g. `myProposals`, `myProposalsLoading`).
- **Show:** List of cards/rows: space title (displayTitle), status, offer amount + currency, sponsorship type, created date. If status === accepted: payout method, payout wallet (or "Linkary wallet"), accepted_at. CTA: "Open space" (opens space detail modal or navigates to space).
- **States:** Empty state: "No sponsorship proposals yet."; pending / accepted / declined displayed clearly (badge or label).
- **Safety:** No payout execution, no escrow, no wallet validation beyond existing; show recorded payout destination only; if accepted, show note: "Payment is arranged off-platform between sponsor and host."

### Risks / compatibility
- **Auth:** Same token-based pattern as inbox and other XSpaces APIs; no auth flow changes.
- **RLS:** Existing `space_sponsor_proposals` SELECT policy allows `project_profile_id = auth.uid()`; my-proposals only reads own rows.
- **SSR / smoke / regression:** New route and new nav section only; no changes to existing routes or auth. Add from X fix remains untouched.
- **Accessibility:** New nav item is a button like existing ones; list and CTAs keep existing patterns.

---

## Part C — Architecture

- **displayTitle:** Use `linkary_title ?? x_title ?? title` everywhere for space display (my-proposals API and UI).
- **Loaders:** My-proposals fetch abortable (AbortController), normalize arrays, use `sanitizeErrorMessage` for user-facing errors.
- **No breaking changes** to smoke, regression, SSR, modals, or token governance.

---

## Deliverables (after implementation)

1. Files changed list  
2. Migration/trigger summary  
3. Routes added/changed  
4. UI summary  
5. Confirmation Add from X invalid-session fix intact  
6. Manual QA checklist  
7. Follow-up suggestions (speaker/sponsor reputation, analytics)
