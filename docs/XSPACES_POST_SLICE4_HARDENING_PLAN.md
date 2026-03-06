# Post-Slice 4 Hardening + Notifications + Saved Payout — Implementation Plan

## Part A — Hardening (verify and tighten)

### 1. Sponsor proposal state safety
- **Current:** PATCH already allows only when status === "pending"; returns "This proposal was already accepted." / "This proposal was already declined."; sets accepted_at and accepted_by_profile_id on accept.
- **Verify:** Confirm select includes project_profile_id for notifications; confirm decline path does not allow declining an already-accepted proposal (already blocked by pending check). No change to allow "decline after accept" for MVP.

### 2. Payout storage correctness
- **Current:** linkary_wallet → payout_wallet_address null; saved_wallet/one_time_wallet → trim, required, slice length; `|| null` so empty never persists.
- **Verify:** Re-read PATCH route; ensure no edge case where empty string is stored.

### 3. My proposals robustness
- **Current:** API sorts pending → accepted → declined, then by created_at desc. "Open space" uses minimalSpace when space not in list.
- **Add:** GET /api/spaces/[id] (single space by id) so that when opening from my-proposals we can fetch full space when not in list; keep loaders abortable. Alternatively keep minimalSpace and document; we'll add GET for robustness.

### 4. Add from X fix
- **Action:** Do not modify XSpacesPage Add from X block (refreshSession, no request when no token, clear messages).

---

## Part B — Proposal notifications

- **Pattern:** Use existing `createNotification(recipient_profile_id, type, opts)` from `@/lib/notifications`.
- **Types:** Add `sponsor_proposal_accepted` and `sponsor_proposal_declined` to NotificationType.
- **PATCH accept:** After successful update, select project_profile_id from proposal (add to initial select), then createNotification(project_profile_id, "sponsor_proposal_accepted", { entity_type: "sponsor_proposal", entity_id: proposalId, payload: { space_id, accepted_at } }). Use service role inside createNotification.
- **PATCH decline:** After successful update, createNotification(project_profile_id, "sponsor_proposal_declined", { entity_type: "sponsor_proposal", entity_id: proposalId, payload: { space_id } }).
- **Payload:** No sensitive data; space_id and proposal id are enough for "My proposals" to reflect change; optional host reference only if cheap (e.g. host_profile_id in payload).
- **UI:** No new UI required; "My proposals" already reflects status after reload; notifications appear in existing notifications list if the app surfaces them by type.

---

## Part C — Saved payout wallet foundation

### 1. Schema
- **New table:** `host_payout_preferences` (one row per profile).
- **Columns:** profile_id (uuid PK/FK), default_payout_method (text: saved_wallet | linkary_wallet), wallet_address (text nullable), updated_at (timestamptz).
- **RLS:** Owner can select/insert/update own row only.

### 2. API
- **GET /api/me/payout-preferences:** Auth required; return { default_payout_method, wallet_address } or 204/empty.
- **PUT /api/me/payout-preferences:** Body { default_payout_method?, wallet_address? }. Validate: method in [saved_wallet, linkary_wallet]; if saved_wallet then wallet required (trim, non-empty); if linkary_wallet then wallet null; trim wallet; empty string → null. Upsert by profile_id.

### 3. UI (minimal)
- **Accept flow:** When host opens accept payout form, fetch GET /api/me/payout-preferences. If saved_wallet and wallet_address present, prefill the wallet input when payout_method = saved_wallet.
- **Optional:** "Save this as my default payout wallet" checkbox when they enter an address and click accept; on success if checked call PUT to save preference.
- No new settings page unless trivial; keep all changes inside XSpaces accept flow only.

### 4. Constraints
- No escrow; no chain validation; do not auto-overwrite; keep "Linkary only records payout destination" messaging.

---

## Part D — Architecture

- displayTitle: linkary_title ?? x_title ?? title everywhere.
- Do not break: smoke/regression, SSR, modals, token governance, Add from X fix, App.tsx/me-stats/public profile real-data.
- New loaders: abortable, array-safe, sanitizeErrorMessage.
- Touch only: XSpaces/sponsor proposal/payout preference/notification code; avoid App.tsx, me-stats, public profile unless required.

---

## Risks / compatibility

- **Notifications:** New types are additive; existing notification list may need to handle new type in display (e.g. "Sponsor proposal accepted" label). If the app only shows generic "notification" we can add a simple label by type.
- **host_payout_preferences:** New table and endpoints; no impact on existing accept flow except prefill and optional save.
- **GET /api/spaces/[id]:** Additive; used only when opening space from my-proposals and space not in list; RLS or same visibility as list API.
