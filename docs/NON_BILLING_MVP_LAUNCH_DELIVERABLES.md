# Non-billing MVP — final production smoke-test and deployment-readiness

**Mission:** Final production smoke-test and deployment-readiness for the non-billing MVP. No billing integration; no Stripe; no payment gateway; no fake checkout; no misleading payment-is-live messaging.

**Product policy (MVP):**
- Billing is intentionally deferred.
- Future: 7-day free trial then paid access.
- Surfaces must reflect: early access, beta, coming soon, or that 7-day free trial will apply when billing launches — and must not imply checkout is live now.

**Roles (audit perspective):** Senior QA/regression, senior frontend, senior backend, senior auth, product-minded engineer.

---

## 1. Exact pre-launch checklist

| # | Item | Owner | Done |
|---|------|--------|------|
| 1 | **Auth:** X OAuth login → callback → redirect to `/onboarding` for new users (code and session path) | QA | ☐ |
| 2 | **Onboarding:** X-first flow (referral optional or required per invite-only); role → profession → complete | QA | ☐ |
| 3 | **Invite:** When invite-only, redeem code grants access; when not, referral optional; reward triggers (link/finish, org create, onboarding complete) not broken | QA | ☐ |
| 4 | **Wallet:** `/app/settings/wallet` loads; CDP status from `/api/wallet/cdp/status`; no 401/500 on healthy session | QA | ☐ |
| 5 | **Reputation card:** Preview renders; PNG export works; public profile URL uses correct slug | QA | ☐ |
| 6 | **Public profile:** `/{username}` or `/{slug}` resolves; copy-link and card URL match | QA | ☐ |
| 7 | **Billing UI:** No "Start Free Trial" or live checkout CTAs on landing; Plans/Billing pages show "Billing coming soon" / early access; no fake payment method or invoices | Product/Frontend | ☐ |
| 8 | **Env:** `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` set in deployment; `LINKARY_INVITE_ONLY` set as intended; `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL` set for production domain | Backend | ☐ |
| 9 | **Build:** `pnpm build` (or equivalent) passes; no Stripe import or runtime billing calls | Backend | ☐ |

---

## 2. Exact env vars required (non-billing MVP)

| Variable | Required | Notes |
|----------|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (e.g. `https://xxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key for client and API routes |
| `LINKARY_INVITE_ONLY` | Optional | Set to `"true"` for invite-only launch; omit or `"false"` for open access. Used in middleware and `/api/me/access`. |
| `NEXT_PUBLIC_SITE_URL` | Recommended | Base URL for auth redirects (e.g. `https://linkary.xyz`). Fallback: Vercel URL or localhost. |
| `NEXT_PUBLIC_APP_URL` | Recommended | Canonical app URL for public profile links, sitemap, OG. (e.g. `https://linkary.xyz`) |
| `VERCEL_URL` | Set by Vercel | Used as fallback when `NEXT_PUBLIC_APP_URL` / `NEXT_PUBLIC_SITE_URL` not set |

**Not required for MVP:** `STRIPE_*`, `LINKARY_BILLING_WEBHOOK_SECRET`, any payment gateway keys.

**Server-only (if using cron/workers):** `SUPABASE_SERVICE_ROLE_KEY` for server-side jobs; not needed for client or standard API routes that use anon + user JWT.

---

## 3. Exact manual smoke-test steps

1. **X-first onboarding (new user)**
   - Open app in incognito; start X login.
   - Complete OAuth; land on auth callback then redirect to `/onboarding`.
   - Complete referral step (skip if not invite-only, or enter valid code if invite-only).
   - Select role (Individual/Company), select profession(s), finish.
   - Confirm redirect to app and profile has `onboarding_completed_at` / account_type set.

2. **Invite-only (if enabled)**
   - With `LINKARY_INVITE_ONLY=true`, sign in with X account that has no redeemed invite.
   - Confirm invite gate (no access to main app until redeem).
   - Redeem valid invite code; confirm access granted and onboarding can complete.

3. **Invite wallet**
   - As user with invite codes: open Settings/Invites (or equivalent); confirm issue/redeem/replenish flows and that reward triggers (e.g. after onboarding complete) do not error in console/network.

4. **CDP wallet**
   - Go to `/app/settings/wallet`.
   - Confirm page loads; if CDP is linked, balance/status appear; no 401/500 from `/api/wallet/cdp/status` for logged-in user.

5. **Reputation card + PNG**
   - Open reputation card preview in app; trigger PNG export.
   - Confirm image downloads and matches preview; public profile URL in card is correct (e.g. `origin/{slug}`).

6. **Public profile URL**
   - Open a public profile (e.g. `/{username}`); copy profile link from UI; open in new tab — same content and URL format.

7. **Billing/pricing UI (no live payment)**
   - Landing: Pricing section shows "Early access is currently open. Billing coming soon." and "7-day free trial will apply when paid plans go live"; paid plan CTAs say "Early access" (not "Start Free Trial" implying checkout).
   - In-app Plans/Billing: Plans page shows "Billing coming soon" banner; clicking upgrade on a paid plan shows message, no redirect to Stripe. Billing tab shows "Billing is not active yet" and early-access copy, no fake plan/payment/history.
   - Locked feature modal: "View plans" CTA; footer "Billing coming soon… 7-day free trial when we launch."

---

## 4. Exact blockers (if any)

| Blocker | Severity | Resolution |
|---------|----------|------------|
| None identified in this pass | — | Launch-critical flows (onboarding, invite, wallet, reputation card, public profile, env) were previously audited and billing UI was updated for MVP clarity. |

If you find a **real bug** in one of the seven focus areas during smoke-test, fix only that bug; do not reopen completed feature work or redesign.

---

## 5. Billing/pricing UI changes made (no misleading payment-is-live)

| Location | Change |
|----------|--------|
| **LandingPage.tsx** | Pricing section: heading "Plans and pricing"; subtext "Early access is currently open. Billing coming soon." and "A 7-day free trial will apply when paid plans go live." Paid plan CTAs: "Start Free Trial" → "Early access"; "Contact Sales" → "Contact us". |
| **PricingPageRefined.tsx** | Top banner: "Billing coming soon. Early access is currently open. A 7-day free trial will apply when paid plans go live." Hero subtext: "Paid plans and billing coming soon — early access is open now." `handleUpgrade` no longer calls checkout API; shows inline message only. FAQ updated: "Is billing live?" and "7-day free trial when paid plans go live." |
| **BillingPage.tsx** | Replaced fake plan, payment method, and payment history with single state: "Billing is not active yet", "Early access", "7-day free trial will apply when paid plans go live", "No payment gateway is connected yet." |
| **LockedFeatureModal.tsx** | Description: "will be available for {plan} when paid plans go live." CTA: "Upgrade to {plan}" → "View plans". Footer: "Billing coming soon. This feature will be available with paid plans; 7-day free trial when we launch." |

No fake checkout; no Stripe; no payment gateway. All billing surfaces reflect that billing is coming soon and early access is open.

---

## 6. Recommendation for MVP wording (future trial/billing)

Use consistently across landing, in-app Plans/Billing, and locked-feature modals:

- **"Billing coming soon"** — primary statement.
- **"Early access is currently open"** — no payment required now.
- **"A 7-day free trial will apply when paid plans go live"** — sets expectation for future.

Avoid for MVP:

- "Start Free Trial" or "Subscribe" as primary CTA (implies live checkout).
- Fake "Current plan", "Next billing", "Payment method", or "Payment history".
- Any text that suggests users can pay or subscribe today.

Document for future (when you enable billing): where to add "Start 7-day free trial" and actual checkout flow; no change to onboarding, invite, or wallet logic.

---

## 7. Founder summary — can we deploy now?

| Question | Answer |
|----------|--------|
| **Can we deploy now?** | **Yes**, for the non-billing MVP scope. Launch-critical flows (X-first onboarding, invite-only/referral, invite wallet and rewards, CDP wallet, reputation card, public profile URL, env/config) were audited. Billing UI was updated so no surface implies payment or checkout is live. |
| **What remains manual before go-live?** | (1) Set production env vars (`NEXT_PUBLIC_SUPABASE_*`, `LINKARY_INVITE_ONLY`, `NEXT_PUBLIC_SITE_URL` / `NEXT_PUBLIC_APP_URL`). (2) Run the manual smoke-test steps above. (3) Confirm no Stripe or payment keys are configured. |
| **What to monitor after launch?** | Auth callback redirects to onboarding; invite redeem success rate; CDP wallet 401/500; reputation PNG export and public profile URL correctness; any user confusion about billing (surfaces should clearly say "Billing coming soon"). |

**Rules applied:** No billing integration; no Stripe; no payment gateway; no fake checkout; no broad redesign; no mock data. Brutally honest: if you find a real bug during smoke-test, fix only that; otherwise you are clear to deploy the non-billing MVP.
