# Billing QA and hardening — deliverables

## 1. Exact risks found

| # | Risk | Severity | Detail |
|---|------|----------|--------|
| 1 | **current_period_end from local assumption only** | Medium | Webhook used metadata `period` (monthly/yearly) and added 30 or 365 days locally. Stripe subscription has the real `current_period_end`. Tier/feature gating could be wrong if our guess drifts from Stripe (e.g. proration, trial). |
| 2 | **Concurrent webhook delivery** | Medium | Two Stripe deliveries for the same session could both pass the "existing" SELECT before either inserts. One would insert; the other would hit unique violation and return 500. Stripe would retry the "failed" one. |
| 3 | **Attribution call failure** | Low | If the attribution webhook call fails (network, 5xx), subscription and package_purchase are already written. Inviter would not get +3; no retry was implemented. |
| 4 | **Raw body for signature** | None | Implementation already uses `request.text()` first; no prior body consumption. Correct for Stripe signature verification. |

No risks found for: event choice (checkout.session.completed), create-checkout-session auth (owner/admin enforced), client org selector (backend enforces org membership + role), or DB constraints (unique on stripe_checkout_session_id supports idempotency).

---

## 2. Exact files changed

| File | Change |
|------|--------|
| **apps/web/src/app/api/billing/webhook/route.ts** | (1) **current_period_end:** When `session.subscription` is present, call `stripe.subscriptions.retrieve(subscriptionId)` and set `periodEnd` from `subscription.current_period_end` (Unix → ISO). Fallback to local 30/365-day calculation only when no subscription or retrieve fails. (2) **Idempotency:** On `package_purchases` insert error, if error code is `23505` (unique_violation) or message contains "unique", return 200 `{ received: true, already_processed: true }` instead of 500. (3) **Attribution:** After first `fetch` to attribution webhook, if `!res.ok` or throw, wait 2s and call once more; then continue. Non-blocking; webhook still returns 200. |
| **docs/BILLING_QA_AND_HARDENING_DELIVERABLES.md** | New. This document. |

No changes to onboarding, invite logic, create-checkout-session, pricing UI, or DB schema.

---

## 3. Exact fixes made

**Fix 1 — current_period_end from Stripe when available**

- Before: `periodEnd` was always computed from metadata `period` (monthly → now + 30 days, yearly → now + 365 days).
- After: If `session.subscription` (id) is present, `stripe.subscriptions.retrieve(subscriptionId)` is called and `periodEnd = new Date(subscription.current_period_end * 1000).toISOString()`. If retrieve throws or there is no subscription, fallback to the same local calculation as before.

**Fix 2 — Concurrent idempotency (unique violation)**

- Before: Insert into `package_purchases`; on any error return 500.
- After: On insert error, if `error.code === '23505'` or message includes "unique", return 200 `{ received: true, already_processed: true }`. Otherwise return 500. Ensures duplicate webhook delivery (or race) does not surface as failure to Stripe.

**Fix 3 — Attribution single retry**

- Before: One `fetch` to attribution webhook; catch and ignore.
- After: One `fetch`; if `!res.ok` or throw, wait 2 seconds and call the same payload once more. Any second failure is still ignored; webhook response is not delayed by retry (retry is awaited but does not change response status). Attribution RPC is idempotent, so double call is safe.

---

## 4. What is verified

| Item | Result |
|------|--------|
| **Stripe event** | `checkout.session.completed` is sufficient for MVP: it fires when the customer completes Checkout and, in subscription mode, the subscription exists and first invoice is paid. No change. |
| **current_period_end** | Now derived from Stripe subscription when available; fallback remains for edge cases. Verified in code. |
| **Webhook signature** | Raw body via `request.text()` only; no prior body read. Signature verified with `stripe.webhooks.constructEvent(body, sig, stripeWebhookSecret)`. No bodyParser on route. Verified. |
| **Idempotency** | (1) SELECT by `stripe_checkout_session_id` before write; (2) UNIQUE on `package_purchases.stripe_checkout_session_id`; (3) on unique violation return 200. Prevents duplicate subscriptions (upsert), duplicate package_purchases, and duplicate attribution (RPC idempotent by purchase_id). Verified. |
| **Authorization** | create-checkout-session: requires Bearer token; loads user; requires `org_members` row with same user and `role IN ('owner','admin')` for given `org_id`. Returns 403 otherwise. Client org list from `listMyOrgs` does not expand access; backend enforces. Verified. |
| **Attribution trigger** | Called with `org_id`, `purchase_id` (from new row), `package_type`, `amount_cents`. Secret header required. One retry after 2s on failure. +3 inviter logic unchanged (RPC and attribution webhook). Verified. |
| **Failure handling** | If Stripe succeeds but attribution fails: subscription and package_purchase are already written; user has access. Attribution is best-effort with one retry; no webhook failure. Later: reconciliation (e.g. cron for unattributed purchases) can be added. Documented. |
| **DB integrity** | `package_purchases`: UNIQUE(`stripe_checkout_session_id`), PK on `id`. `subscriptions`: UNIQUE(`owner_type`, `owner_id`). Supports idempotent upsert and single insert per session. Verified. |

---

## 5. What is acceptable for MVP

- **Event:** Only `checkout.session.completed`. No handling of `customer.subscription.updated/deleted` or `invoice.payment_failed`; cancel/update/dunning deferred.
- **Attribution failure:** One retry in webhook; no queue or cron. Manual or future reconciliation if inviter did not get +3.
- **Success URL:** Redirect to `/app/plans?session_id=...&success=1`; no server-side success handler that reads session. Optional later: read session on success page to show confirmation.
- **Billing tab:** Remains placeholder; no Stripe Customer Portal or subscription management in this pass.

---

## 6. What remains intentionally deferred

- **customer.subscription.updated / deleted:** For cancel, downgrade, or renewal we would update `subscriptions` and possibly extend `current_period_end`. Deferred.
- **invoice.payment_failed:** For dunning or grace period. Deferred.
- **Attribution reconciliation:** Cron or job to find `package_purchases` without a matching invite grant and retry attribution. Deferred.
- **Success page logic:** Server-side read of Checkout Session on success URL to show plan/amount. Deferred.
- **Client org filter:** Showing only orgs where user is owner/admin (for cleaner UX). Deferred; backend already enforces.

---

## 7. Founder summary

**Is billing ship-safe?**

- Yes for MVP. Stripe event choice is correct; signature and raw body are correct; idempotency is enforced (including concurrent delivery); authorization is enforced; current_period_end uses Stripe data when available; attribution has one retry. No redesign or new product scope.

**What edge cases were hardened**

- **current_period_end:** Now taken from Stripe subscription when present, so tier/period alignment matches Stripe.
- **Duplicate webhook / race:** Unique violation on `package_purchases` insert now returns 200 so Stripe does not retry and we do not double-write.
- **Attribution transient failure:** One retry after 2s so a single network/5xx blip is less likely to miss the inviter +3.

**What should be improved later**

- Add reconciliation for purchases that never got attribution (e.g. cron or admin tool).
- Handle `customer.subscription.updated` and `deleted` when implementing cancel/change plan.
- Optionally filter Plans org dropdown to owner/admin-only for clearer UX (backend already enforces).

No changes to onboarding or invite logic. No mock payments. No broad refactor.
