# Package purchase integration readiness — deliverables

## 1. Audit: current pricing / billing / package purchase code path

**Finding: There is no real billing or purchase-completion flow in the codebase.**

| Check | Result |
|-------|--------|
| **Purchase success route** | None. No API route that runs after a successful charge or subscription creation. |
| **Subscription creation handler** | None. The `subscriptions` table exists (owner_type, owner_id, tier, status, current_period_end) and is **read-only** in app code via `getSubscriptionTier()` in `publicData.ts`. No API or RPC inserts/updates subscriptions. |
| **Stripe webhook or equivalent** | None. No Stripe SDK, no webhook route, no payment-provider integration. References to Stripe are in docs and placeholder UI copy only. |
| **Billing UI** | Placeholder. `BillingPage.tsx` states: *"Design Only: All billing, payment, and subscription logic are placeholders. Real implementation requires backend integration with payment processors (Stripe, etc.)."* `PlansAndBillingPage` and `PricingPageRefined` are UI only; no checkout or payment calls. |

**Conclusion:** Billing is not implemented. The invite package attribution system (RPC + existing API) is ready to be **called from** a future billing path; nothing currently calls it.

---

## 2. Exact billing / purchase hook point

When you add billing (Stripe or other), call **one** of these **after** payment is confirmed for an org:

### Option A — Webhook-style (recommended for Stripe)

**POST** `/api/invites/record-package-attribution/webhook`

- **Auth:** Header `X-Linkary-Billing-Secret: <LINKARY_BILLING_WEBHOOK_SECRET>`. Set this env var in production; if unset, the route returns 503.
- **Use case:** Your Stripe webhook handler (or any server-side billing success path) POSTs to this URL with the payload. No user session; service role is used inside the route.
- **Implemented in this pass:** Yes. New route: `apps/web/src/app/api/invites/record-package-attribution/webhook/route.ts`.

### Option B — Authenticated org member

**POST** `/api/invites/record-package-attribution`

- **Auth:** `Authorization: Bearer <user access token>`. Caller must be a member of the org that purchased.
- **Use case:** When the purchase flow runs in-app and you have the buyer’s (or org admin’s) session, call this with the same body. Existing route; no change in this pass.

### Option C — Direct RPC (backend only)

From a trusted backend with **Supabase service role**:

```ts
const { data } = await supabaseAdmin.rpc('record_invite_package_attribution', {
  p_org_id: orgId,
  p_purchase_id: purchaseId,
  p_package_type: 'pro_monthly',  // optional
  p_amount_cents: 1999,            // optional
});
```

Use from a billing worker, cron, or server that already has service role and org + purchase id.

---

## 3. Exact payload for package attribution

Same for all options (webhook body, API body, or RPC args):

| Field | Type | Required | Notes |
|-------|------|----------|--------|
| **org_id** | UUID | Yes | The org that made the purchase. Must match an org that has (or will have) an invite attribution row with `invitee_org_id = org_id` (set when invitee creates the org). |
| **purchase_id** | UUID | Yes | Unique id for this purchase. Use a stable UUID from your purchase/subscription record or generate one when payment succeeds. Idempotency: same (org, purchase_id) will not double-grant (attribution row is updated once to `package_purchased`). |
| **package_type** | string | No | Stored on attribution row (e.g. `pro_monthly`, `venture_annual`). |
| **amount_cents** | number | No | Stored on attribution row. |

**Example (webhook or API body):**

```json
{
  "org_id": "550e8400-e29b-41d4-a716-446655440000",
  "purchase_id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
  "package_type": "pro_monthly",
  "amount_cents": 1999
}
```

**Note:** Stripe payment intent / subscription ids are not UUIDs. When integrating Stripe, create your own purchase record (e.g. in `subscriptions` or a `purchases` table) with a UUID and pass that as `purchase_id`, or map Stripe id → your UUID in the webhook handler before calling this hook.

---

## 4. Idempotency and failure handling

| Behavior | Detail |
|----------|--------|
| **Idempotency** | RPC finds at most one attribution row per org (first-touch: earliest `created_at` in 90-day window, status ≠ `package_purchased`). It updates that row and grants the inviter +3 once. A second call for the same org finds no eligible row (status is now `package_purchased`) and returns `attributions_updated: 0`, `reserve_grants: 0`. Same `purchase_id` for same org is effectively no-op after the first successful call. |
| **Failure handling** | On RPC or DB error, webhook route returns 500 with `{ error: "..." }`. Caller (e.g. Stripe webhook) should retry with backoff. Non-2xx response = attribution may not have been applied; safe to retry. On 200, response includes `attributions_updated` (0 or 1) and `reserve_grants` (0 or 1). |
| **No eligible attribution** | If the org has no invite attribution in the 90-day window (or none with `invitee_org_id` set), RPC returns `ok: true`, `attributions_updated: 0`, `reserve_grants: 0`. Not an error; just no inviter to credit. |

---

## 5. First-touch attribution and +3 reward (verified)

- **First-touch:** Implemented in `record_invite_package_attribution`: single row selected where `invitee_org_id = p_org_id`, `created_at >= now() - 90 days`, `attribution_status != 'package_purchased'`, ordered by `created_at ASC`, limit 1. That inviter gets the reward.
- **+3 to inviter:** Implemented via `grant_invite_reserve_for_milestone_for_user(v_inviter_id, 'package_purchase', ...)` (migration `20260331000000_package_attribution_grant_fix.sql`). Cap 10 total reserve per user; idempotent per (user, reason, reference_id).

No change to RPC or reward logic in this pass; only the new webhook route and this doc were added.

---

## 6. Exact files changed

| File | Change |
|------|--------|
| **apps/web/src/app/api/invites/record-package-attribution/webhook/route.ts** | **New.** POST handler: checks `X-Linkary-Billing-Secret` against `LINKARY_BILLING_WEBHOOK_SECRET`, parses body (org_id, purchase_id, package_type?, amount_cents?), calls `record_invite_package_attribution` with service-role Supabase client, returns JSON with ok / attributions_updated / reserve_grants. Returns 503 if secret not set, 401 if secret wrong, 400 if payload invalid, 500 on RPC error. |
| **docs/PACKAGE_PURCHASE_INTEGRATION_DELIVERABLES.md** | **New.** This document. |

No changes to pricing UI, org creation, onboarding, invite flows, or existing record-package-attribution API.

---

## 7. Is this fully wired or still waiting on billing?

**Still waiting on billing.** Attribution is **ready to be wired**:

- **Ready:** RPC and both entry points (authenticated API + webhook) exist. Payload and idempotency are defined. When a **real** purchase completion event exists (Stripe webhook, subscription-created handler, etc.), you call one of the hook points above with `org_id` and `purchase_id` (and optional package_type / amount_cents).
- **Not done:** No Stripe (or other) integration, no code that creates subscriptions or runs on payment success. No mock purchases; no new billing logic.

---

## 8. QA checklist

- [ ] **Webhook route:** With `LINKARY_BILLING_WEBHOOK_SECRET` set, POST to `/api/invites/record-package-attribution/webhook` with valid secret and body (org_id, purchase_id as UUIDs) → 200 and `attributions_updated` / `reserve_grants` 0 or 1. Without secret or wrong secret → 401 or 503. Missing/invalid body → 400.
- [ ] **Idempotency:** Same org_id + purchase_id twice → first call can return reserve_grants: 1 (if attribution exists), second call returns attributions_updated: 0, reserve_grants: 0.
- [ ] **First-touch:** Org with one attribution row (invitee_org_id set, within 90 days) → one call grants that inviter +3; ledger has one row reason package_purchase; attribution row status package_purchased.
- [ ] **No regression:** Existing POST `/api/invites/record-package-attribution` (authenticated org member) still works. Pricing/billing UI, org create, onboarding, invite redeem unchanged.
- [ ] **When billing exists:** From Stripe webhook (or success handler), POST to webhook URL with metadata org_id + purchase_id (and optional package_type/amount_cents); confirm inviter reserve +3 and attribution row updated.

---

## 9. Founder summary

**Audit:** There is no purchase success route, no subscription creation handler, and no Stripe (or other) webhook. Billing UI is placeholder; `subscriptions` is read-only. So we did **not** wire a real purchase event—there is none to wire.

**What was done:** The invite package attribution system was already implemented (first-touch, +3 to inviter, idempotent). We added a **minimal integration surface** so that when billing is added, you have a single, well-defined place to call:

- **New:** **POST /api/invites/record-package-attribution/webhook** — server-to-server, protected by `LINKARY_BILLING_WEBHOOK_SECRET`. Your Stripe webhook (or any billing success path) POSTs here with `org_id`, `purchase_id`, and optional `package_type` / `amount_cents`. We run the existing RPC with service role and return the result. No billing logic added; no mock purchases.

**Payload contract:** org_id and purchase_id (UUIDs) required; package_type and amount_cents optional. Idempotent; safe to retry. Documented in this file and in the webhook route comment.

**Fully wired?** No. Attribution is **ready**: when you implement Stripe (or another provider), call the webhook URL from your payment-success handler with the payload above. Until then, nothing calls the attribution flow.

**No redesign:** No changes to invite economy, onboarding, or pricing flows. Only one new route and this doc.
