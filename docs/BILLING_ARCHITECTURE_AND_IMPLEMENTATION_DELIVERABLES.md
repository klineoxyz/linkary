# Billing architecture and implementation — deliverables

## 1. Exact billing architecture (MVP)

```
[Pricing UI] → user selects org, clicks Upgrade → POST /api/billing/create-checkout-session
  → Stripe Checkout Session created (metadata: org_id, package_key, period)
  → redirect to Stripe Checkout URL

[User pays on Stripe] → Stripe sends checkout.session.completed to POST /api/billing/webhook

[Webhook] → verify signature
  → idempotency: if package_purchases.stripe_checkout_session_id already exists → 200, skip
  → upsert subscriptions (owner_type=org, owner_id, tier, status=active, current_period_end, stripe_subscription_id)
  → insert package_purchases (org_id, stripe_checkout_session_id, stripe_subscription_id, package_type, amount_cents)
  → POST /api/invites/record-package-attribution/webhook with org_id, purchase_id (new row id), package_type, amount_cents
  → 200
```

- **Package selection:** Plans page (PricingPageRefined) with org dropdown; paid plan CTA triggers checkout.
- **Checkout/session:** Stripe Checkout (hosted); session created by create-checkout-session API with metadata.
- **Payment success:** Stripe webhook only (no client-side success callback required; success_url is for redirect after payment).
- **Subscription/purchase write:** Webhook upserts `subscriptions`, inserts `package_purchases`.
- **Attribution:** Webhook calls existing package attribution webhook with `org_id`, `purchase_id`, `package_type`, `amount_cents`. First-touch and +3 inviter reward unchanged.

---

## 2. Exact files changed

| File | Change |
|------|--------|
| **supabase/migrations/20260401000000_billing_package_purchases.sql** | New. Table `package_purchases` (id, org_id, stripe_checkout_session_id, stripe_subscription_id, package_type, amount_cents, created_at). RLS: org owner/admin can SELECT; insert only via service role. Optional column `stripe_subscription_id` on `subscriptions`. |
| **apps/web/package.json** | Added dependency `stripe`. |
| **apps/web/src/app/api/billing/create-checkout-session/route.ts** | New. POST: auth required, body org_id, package_key, period. Validates org membership (owner/admin). Maps package_key to Stripe Price ID via env (STRIPE_PRICE_CREATOR_PRO_MONTHLY, etc.). Creates Stripe Checkout Session (mode: subscription), returns url. |
| **apps/web/src/app/api/billing/webhook/route.ts** | New. POST: raw body, Stripe signature verification. On checkout.session.completed: idempotent by stripe_checkout_session_id; upsert subscriptions; insert package_purchases; call attribution webhook with purchase_id. |
| **apps/web/src/figma/app/App.tsx** | Pass `userId={authUserId}` to PlansAndBillingPage. |
| **apps/web/src/figma/app/components/monetization/PlansAndBillingPage.tsx** | Accept `userId` prop; pass to PricingPageRefined. |
| **apps/web/src/figma/app/components/monetization/PricingPageRefined.tsx** | Accept `userId`. Fetch orgs (listMyOrgs) when userId set. Org selector dropdown; selectedOrgId state. Paid plan CTA calls handleUpgrade(plan.id) → POST create-checkout-session → redirect to Stripe. Loading/error state. |

---

## 3. Exact DB writes added

| Table | When | What |
|-------|------|------|
| **subscriptions** | Stripe webhook (checkout.session.completed) | Upsert by (owner_type, owner_id): owner_type=org, owner_id=org_id, tier (from package_key), status=active, current_period_end (from period), stripe_subscription_id (optional), updated_at. |
| **package_purchases** | Same webhook, after idempotency check | Insert: org_id, stripe_checkout_session_id (unique), stripe_subscription_id, package_type (package_key), amount_cents (from session.amount_total), created_at default. |

No other tables written by billing flow. Invite attribution (invite_attributions, invite_credit_ledger) is updated by the existing RPC called from the attribution webhook.

---

## 4. Exact Stripe / webhook flow

1. **Create session:** Client POSTs to `/api/billing/create-checkout-session` with `{ org_id, package_key, period }`. Server creates Stripe Checkout Session with `mode: 'subscription'`, `line_items: [{ price: priceId, quantity: 1 }]`, `metadata: { org_id, package_key, period }`, `subscription_data.metadata: { org_id, package_key }`, success_url, cancel_url. Returns `{ url }`. Client redirects to url.
2. **Stripe webhook:** Stripe POSTs to `/api/billing/webhook` with `Stripe-Signature` header. Server verifies with `STRIPE_WEBHOOK_SECRET`, parses event. If `event.type !== 'checkout.session.completed'` return 200 `{ received: true }`. Else: read session.metadata.org_id, package_key; idempotency: SELECT package_purchases WHERE stripe_checkout_session_id = session.id; if row exists return 200; else upsert subscriptions, insert package_purchases, then fetch attribution webhook with X-Linkary-Billing-Secret and body { org_id, purchase_id, package_type, amount_cents }; return 200.

**Required env (billing):** STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, STRIPE_PRICE_CREATOR_PRO_MONTHLY (and optionally STRIPE_PRICE_CREATOR_PRO_YEARLY, STRIPE_PRICE_HOST_MONTHLY, STRIPE_PRICE_HOST_YEARLY, STRIPE_PRICE_BRAND_MONTHLY, STRIPE_PRICE_BRAND_YEARLY, STRIPE_PRICE_VENTURE_MONTHLY, STRIPE_PRICE_VENTURE_YEARLY). LINKARY_BILLING_WEBHOOK_SECRET (for attribution webhook). NEXT_PUBLIC_APP_URL or VERCEL_URL for webhook self-call.

---

## 5. Exact place where package attribution is triggered

**In** `apps/web/src/app/api/billing/webhook/route.ts`, **after** inserting into `package_purchases` and obtaining `purchaseId` (the new row’s `id`):

```ts
await fetch(`${origin}/api/invites/record-package-attribution/webhook`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "X-Linkary-Billing-Secret": billingWebhookSecret },
  body: JSON.stringify({
    org_id: orgId,
    purchase_id: purchaseId,
    package_type: packageKey,
    amount_cents: amountTotal,
  }),
});
```

No other code path triggers package attribution for this flow. First-touch and +3 inviter reward logic are unchanged (RPC and attribution webhook as before).

---

## 6. Regression risks

| Risk | Mitigation |
|------|------------|
| Stripe env missing | create-checkout-session returns 503; webhook returns 503 if keys missing. No mock success. |
| Webhook signature wrong / replay | Verification with STRIPE_WEBHOOK_SECRET; invalid signature → 400. |
| Double process same session | Idempotency: select by stripe_checkout_session_id before insert; if exists return 200 and skip. |
| Org member not owner/admin | create-checkout-session checks org_members.role IN ('owner','admin'); else 403. |
| Pricing UI without login | userId optional; paid CTAs only start checkout when userId and (selectedOrgId or orgs.length === 0 with error). No change to free plan or other routes. |
| Billing / Plans page layout | Only additions: org selector when userId and orgs exist; paid CTA wired to checkout. No broad redesign. |
| Onboarding / invite flows | Not touched. Attribution is called from webhook only. |

---

## 7. QA checklist

- [ ] **Env:** Set STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, at least one STRIPE_PRICE_* (e.g. STRIPE_PRICE_CREATOR_PRO_MONTHLY), LINKARY_BILLING_WEBHOOK_SECRET. Run migration for package_purchases and subscriptions.stripe_subscription_id.
- [ ] **Create session:** Logged-in user, org owner/admin, POST create-checkout-session with org_id, package_key, period → 200 and url; redirect to Stripe Checkout.
- [ ] **Create session forbidden:** User not org member or not owner/admin → 403. Missing org_id → 400. Price not configured → 400.
- [ ] **Webhook:** Send checkout.session.completed (e.g. Stripe CLI) with metadata org_id, package_key → 200; subscriptions has row for org; package_purchases has row; attribution webhook called (check logs or invite_credit_ledger for +3 to inviter if org has attribution).
- [ ] **Webhook idempotency:** Same session id again → 200, no duplicate package_purchases row, attribution not double-called.
- [ ] **Plans UI:** With userId and orgs, org selector appears; select org, click Upgrade on paid plan → redirect to Stripe. No org selected → error or disabled. No userId → paid CTA does not start checkout.
- [ ] **No regression:** Onboarding, invite redeem, package attribution first-touch, other pricing/billing placeholder UI (Billing tab) unchanged.

---

## 8. Founder summary

**What billing is now live**

- **Org package checkout:** From Plans, a logged-in org owner/admin selects an org and a paid plan (Creator Pro, X Space Host, Brand, Venture) and monthly/yearly. Clicking Upgrade creates a Stripe Checkout Session and redirects to Stripe. Payment is real (Stripe hosted checkout).
- **Webhook:** After successful payment, Stripe calls our webhook. We write the org’s subscription (tier, status, period end) and a single package_purchase row (with a UUID used as purchase_id for attribution). We then call the existing package attribution webhook so the inviter gets +3 when applicable. All of this is idempotent per checkout session.

**What package purchase now does**

- **Subscription record:** `subscriptions` is updated for the org (owner_type=org, owner_id=org_id, tier from plan, status=active, current_period_end).
- **Purchase record:** Each successful checkout creates one `package_purchases` row (id = purchase_id for attribution).
- **Attribution:** The same flow as before: webhook calls POST /api/invites/record-package-attribution/webhook with org_id, purchase_id, package_type, amount_cents. First-touch and +3 to inviter are unchanged.

**What still remains deferred**

- **Billing tab (BillingPage):** Still placeholder (payment method, history). No Stripe Customer Portal or subscription management UI yet.
- **Profile/individual subscriptions:** Only org subscriptions are implemented; profile-level upgrades are not.
- **Cancel / change plan:** No UI or webhook handling for subscription canceled or updated; stripe_subscription_id is stored for future use.
- **Stripe Price IDs:** Must be created in Stripe Dashboard and set in env (STRIPE_PRICE_CREATOR_PRO_MONTHLY, etc.). No mock prices or test mode assumption in code.

No mock purchases, no fake success paths, no redesign of invite attribution or onboarding.
