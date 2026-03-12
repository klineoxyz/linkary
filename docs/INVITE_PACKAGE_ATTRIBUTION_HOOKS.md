# Invite package attribution — 90-day rule and hook points

When an **invited org** (an org created by a user who joined via an invite code) buys a package, the inviter is credited and can earn +1 reserve invite credit. Attribution is applied only if the purchase happens within **90 days** of the invite (attribution row `created_at`).

---

## 1. When to call

Call **after** a successful package/subscription purchase for an org:

- Right after your payment provider confirms the purchase (e.g. Stripe webhook, or after your own charge succeeds).
- You must have: **org_id** (the org that bought), **purchase_id** (unique id for this purchase, e.g. Stripe payment intent or your own purchase record id).

---

## 2. Hook options

### A. API route (authenticated org member)

**POST** `/api/invites/record-package-attribution`

**Headers:** `Authorization: Bearer <session access token>`

**Body:**

```json
{
  "org_id": "<uuid of org that purchased>",
  "purchase_id": "<uuid or unique id for this purchase>",
  "package_type": "pro_monthly",
  "amount_cents": 1999
}
```

- `org_id`, `purchase_id` required (UUIDs).
- `package_type`, `amount_cents` optional (stored on the attribution row).
- Caller must be authenticated and a **member of the org** (so typically your backend uses the org owner’s session or a service token that can act for the org).

Use this when the purchase flow runs in the same app and you can send the request with a user or service context that is allowed to act for that org.

### B. RPC (service role / backend only)

From a trusted backend (cron, worker, or server with **service_role**):

```sql
SELECT record_invite_package_attribution(
  '<org_id>'::uuid,
  '<purchase_id>'::uuid,
  'pro_monthly',   -- optional
  1999             -- optional, cents
);
```

Or from Node/TS with Supabase service client:

```ts
const { data } = await supabaseAdmin.rpc('record_invite_package_attribution', {
  p_org_id: orgId,
  p_purchase_id: purchaseId,
  p_package_type: 'pro_monthly',
  p_amount_cents: 1999,
});
```

Use this from Stripe webhooks, your billing worker, or any server-side flow where you have the org and purchase id.

---

## 3. What the function does

1. Finds all **invite_attributions** rows where:
   - `invitee_org_id = p_org_id`
   - `created_at` within the last **90 days**
   - `attribution_status != 'package_purchased'`
2. For each row:
   - Sets `package_purchase_id`, `package_type`, `package_amount_cents`, `package_purchased_at`, `attribution_status = 'package_purchased'`.
   - Calls `grant_invite_reserve_for_milestone(inviter_user_id, 'package_purchase', 'package_purchase', p_purchase_id)` so the inviter gets +1 reserve (idempotent per purchase/reference).
3. Returns `{ ok: true, attributions_updated, reserve_grants }`.

So: one purchase can update multiple attributions (e.g. if the same org was linked to more than one invitee); each inviter gets at most one reserve grant per attribution (and per purchase, due to reference idempotency).

---

## 4. If billing is not ready

- **No purchase event yet:** Keep the API route and RPC in place. When you add Stripe (or another provider), in the success path or webhook:
  1. Resolve the org that purchased (from metadata or your subscription table).
  2. Call the API or RPC with `org_id`, `purchase_id`, and optional `package_type` / `amount_cents`.
- **No org on purchase:** If purchases are user-scoped only, first add a way to associate a purchase with an org (e.g. `org_id` on your subscription or payment record), then call the hook with that `org_id`.

---

## 5. Summary

| Item | Status |
|------|--------|
| 90-day window | Implemented in `record_invite_package_attribution` (`created_at >= now() - 90 days`) |
| Update attribution row | Yes: package_* fields and `attribution_status = 'package_purchased'` |
| Grant inviter reserve | Yes: +1 via `grant_invite_reserve_for_milestone(..., 'package_purchase', ..., purchase_id)` |
| Idempotency | Per (inviter, reason, reference_id); same purchase_id won’t double-grant |
| API route | POST `/api/invites/record-package-attribution` (auth + org membership) |
| RPC | `record_invite_package_attribution(p_org_id, p_purchase_id, p_package_type?, p_amount_cents?)` |
