# Cursor prompts: launch paths

Copy one of the prompts below into Cursor depending on whether you launch **without billing** or **with billing**. Do not run both in one session.

---

## Path A: Launch without billing (non-billing MVP)

Use this when Linkary is launching as a non-billing MVP and you want a final production smoke-test and deployment-readiness pass only.

```
We are launching Linkary as a non-billing MVP.

Do a final production smoke-test and deployment-readiness pass only.
Do not redesign anything.
Do not reopen completed feature work unless a real bug is found.

Focus on:
1. X-first onboarding
2. invite-only / referral flow
3. invite wallet and reward triggers
4. CDP wallet on /app/settings/wallet
5. reputation card preview + PNG export
6. public profile URL correctness
7. environment/config sanity for launch

Deliverables:
- exact pre-launch checklist
- exact env vars required
- exact manual smoke-test steps
- exact blockers if any
- founder summary of whether we can deploy now
```

---

## Path B: Launch with billing (restore Stripe first)

Use this when you cannot launch until paid packages are live and you need to restore and harden the real Stripe billing flow.

```
We cannot launch until paid packages are live.

Restore and harden the real Stripe billing flow for MVP.
Do not redesign onboarding, invite logic, or wallet.

Focus on:
1. real checkout
2. webhook confirmation
3. subscription/package_purchase writes
4. package attribution trigger
5. Stripe env setup
6. end-to-end billing QA

Deliverables:
- exact files changed
- exact Stripe flow restored
- exact test steps
- exact launch blockers remaining
- founder summary of whether billing is truly launch-ready
```

---

## Reference

- **MVP QA already done:** `docs/LAUNCH_READINESS_MVP_QA_DELIVERABLES.md`
- **Billing (when re-enabled):** `docs/BILLING_QA_AND_HARDENING_DELIVERABLES.md`, `docs/PACKAGE_PURCHASE_INTEGRATION_DELIVERABLES.md`
