# Invite Wallet + Attribution System

**Founder-facing summary.** Implemented as additive, non-breaking changes to the existing invite system.

---

## 1. How the invite wallet works

- **Active codes / global cap:** Each user has at most **5 active** invite codes **in total** (wallet + batch + any profile-issued). Active = status `available`, not expired. Counted by `get_user_active_invite_count(user_id)`. **No exception** for batch: both wallet issue and batch issue enforce the same 5-code cap for non-admin. Admin is exempt from lifetime batch cap only; wallet still caps at 5.
- **Codes expire** 30 days after issuance if unused (wallet codes). Batch-issued codes do not set `expires_at` so they stay active until redeemed. When a code is redeemed or expired, that slot frees up.
- **Issue flow:** Wallet: `POST /api/invites/wallet/issue`. Batch: `POST /api/invites/issue` — now sets `owner_user_id` and checks global active count before issuing; if active ≥ 5, returns 400.
- **Existing flows unchanged:** Personal invite codes (one per profile, 5 redeemers max) unchanged. Redemption unchanged.
- **UI:** The "Invite lineage" page now shows an **Invite wallet** section at the top: active codes count, reserve credits, "Issue new code", list of active codes (copy), and redeemed/successful counts.

---

## 2. How reserve credits work

- **Reserve credits** are a separate balance (stored in `invite_credit_ledger` as sum of `delta`). MVP cap: **10** per user.
- They do **not** create unlimited live invites. They are used to **top the user back up to 5 active invites** when they drop below 5 (e.g. after a code is redeemed or expired).
- **Earning reserve (MVP):** Grant reasons: `profile_complete`, `verified_social`, `first_activity` (one-time per user, no reference); `invitee_active`, `org_active`, `package_purchase` (repeatable, **reference_id required** for idempotency: attribution id, org id, purchase id). Call `grant_invite_reserve_for_milestone(user_id, reason, reference_type?, reference_id?)`. Total reserve capped at 10.
- **Consuming reserve:** Replenishment runs via cron: `run_invite_replenishment_cycle(max_users)`. It calls `replenish_invite_from_reserve(user_id)` only for **healthy** users (account age ≥7 days, profile has display_name or username, profile updated in last 90 days, not frozen). That creates one new code and ledger `delta = -1`.
- **Admin:** `admin_grant_invite_reserve_credit(target_user_id, delta, reason)` (admin only) adds reserve up to the 10 cap.

---

## 3. How attribution works

- **On redeem:** When a code is redeemed (one-time or personal), the existing flow sets `profiles.inviter_id` and inserts into `invite_redemptions` (one-time only). The updated `redeem_invite_code` RPC also sets `invite_codes.redeemed_by_user_id`, `redeemed_at` and inserts one row into **invite_attributions** (inviter, invitee, invite_code_id if one-time, status `redeemed`). One row per invitee (unique on `invitee_user_id`).
- **Later steps:** Update attribution row and call `grant_invite_reserve_for_milestone` with the right **reference_id** (attribution id for invitee_active, org id for org_active, purchase id for package_purchase) so each reward is idempotent. **Package purchase:** Call `record_invite_package_attribution(org_id, purchase_id, package_type?, amount_cents?)` from billing when an org buys; it updates attributions for that org (90-day window) and grants +1 reserve per inviter. See `docs/INVITE_PACKAGE_ATTRIBUTION_HOOKS.md`.

---

## 4. Why this prevents spam

- **Global cap of 5 active codes** per user (wallet + batch): enforced in `issue_wallet_invite_code` and in `POST /api/invites/issue`. No separate pool for batch.
- **30-day expiry** for wallet-issued codes; batch codes don’t expire until redeemed.
- **Reserve cap 10:** enforced in all grant paths.
- **Replenishment** only runs for **healthy** accounts: `invite_healthy_for_replenishment(user_id)` checks account age ≥7 days, profile has display_name or username, profile updated in last 90 days, not frozen. `replenish_invite_from_reserve` calls this before issuing.
- **Anti-abuse:** `invite_policy_state` has `frozen_until` and `suspicious_invite_score`. Admin can freeze a user (set `frozen_until`); `issue_wallet_invite_code` and replenishment refuse to issue when frozen. Self-invite is already blocked (redeem rejects same user as inviter). Further guards (IP/device clustering, low-quality conversion flags) can be added in policy checks without changing the core schema.

---

## 5. What is complete vs deferred (follow-up pass)

**Done in follow-up:**
- **Reward semantics:** One-time (profile_complete, verified_social, first_activity) vs repeatable (invitee_active, org_active, package_purchase) with `reference_type`/`reference_id`; idempotent per (user, reason, reference). Ledger unique index enforces no double-grant.
- **Global scarcity:** `get_user_active_invite_count`; wallet and batch share one 5-code cap. Batch issue sets `owner_user_id` and checks cap before issuing.
- **Healthy-account replenishment:** `invite_healthy_for_replenishment(user_id)` (age ≥7d, profile complete, updated in 90d, not frozen). `replenish_invite_from_reserve` uses it.
- **Cron/worker:** `run_invite_replenishment_cycle(max_users)` runs `expire_invite_codes()` then replenishes up to `max_users` eligible users.
- **Package attribution:** `record_invite_package_attribution(org_id, purchase_id, ...)`; 90-day window; API `POST /api/invites/record-package-attribution` and hook doc in `docs/INVITE_PACKAGE_ATTRIBUTION_HOOKS.md`.

**Still deferred:**
- **Billing integration:** No Stripe/payment flow yet; when you add it, call the package-attribution API or RPC after a successful purchase (see hook doc).
- **Delayed reward confirmation:** invitee_active / org_active still require the app to call `grant_invite_reserve_for_milestone` with the right reference when you detect activation or org creation; no automatic job yet.
- **Admin UI:** Freeze, grant reserve, revoke code — all via DB/RPC; no dedicated admin UI.

---

## 6. Files changed (exact)

| Area | File | Change |
|------|------|--------|
| Migrations | `supabase/migrations/20260326000000_invite_wallet_schema.sql` | New: invite_codes columns; invite_credit_ledger, invite_attributions, invite_policy_state; RLS; backfill owner_user_id |
| Migrations | `supabase/migrations/20260326000001_redeem_invite_attribution.sql` | redeem_invite_code: set redeemed_by_user_id/redeemed_at; insert invite_attributions |
| Migrations | `supabase/migrations/20260326000002_invite_wallet_rpcs.sql` | get_invite_wallet_state, gen_wallet_invite_code, issue_wallet_invite_code, expire_invite_codes, replenish_invite_from_reserve, admin_grant_invite_reserve_credit |
| Migrations | `supabase/migrations/20260326000003_invite_reserve_milestone.sql` | grant_invite_reserve_for_milestone (original one-time) |
| Migrations | `supabase/migrations/20260326100000_invite_wallet_followup.sql` | Ledger idempotent unique index; grant_invite_reserve_for_milestone with reference_type/reference_id (one-time vs repeatable); invite_healthy_for_replenishment; replenish uses healthy check; run_invite_replenishment_cycle |
| Migrations | `supabase/migrations/20260326100001_invite_global_scarcity.sql` | get_user_active_invite_count; issue_wallet_invite_code uses global count |
| Migrations | `supabase/migrations/20260326100002_invite_package_attribution.sql` | Index invite_attributions(invitee_org_id, created_at); record_invite_package_attribution(org_id, purchase_id, ...) |
| API | `apps/web/src/app/api/invites/wallet/route.ts` | GET wallet state |
| API | `apps/web/src/app/api/invites/wallet/issue/route.ts` | POST issue one wallet code |
| API | `apps/web/src/app/api/invites/wallet/grant-milestone/route.ts` | POST grant milestone; body now accepts reference_type, reference_id for repeatable reasons |
| API | `apps/web/src/app/api/invites/issue/route.ts` | Global cap: get_user_active_invite_count before issue; set owner_user_id on insert; reject if active ≥ 5 or active + count > 5 |
| API | `apps/web/src/app/api/invites/record-package-attribution/route.ts` | POST record package purchase for org (90-day attribution, grant inviter reserve) |
| UI | `apps/web/src/figma/app/components/InviteWalletSection.tsx` | Wallet state, issue, copy codes |
| UI | `apps/web/src/figma/app/components/InviteLineagePage.tsx` | InviteWalletSection at top |
| Docs | `docs/INVITE_PACKAGE_ATTRIBUTION_HOOKS.md` | Hook points and 90-day rule for package attribution |
| Fix | `apps/web/src/app/CdpProviderGate.tsx` | Type fix: CDPReactProvider cast via `unknown as CdpModule["CDPReactProvider"]` for Vercel build |

---

## 7. Invite lifecycle (short)

1. **Issue:** User or replenishment creates a row in `invite_codes` (owner_user_id, status available, expires_at +30d). Active count cannot exceed 5 for that user.
2. **Share:** User shares the code; code is visible in the wallet section (copy).
3. **Redeem:** New user enters code; `redeem_invite_code` validates, inserts `invite_redemptions` (one-time), sets `invite_codes.status = 'redeemed'`, `redeemed_by_user_id`, `redeemed_at`, sets `profiles.inviter_id`, inserts `invite_attributions` (redeemed).
4. **Expire:** Cron or job runs `expire_invite_codes()`; codes with `expires_at < now()` get status `expired`. Slot is then available again.
5. **Replenish:** For users with reserve > 0 and active < 5 and not frozen, `replenish_invite_from_reserve` creates one code and deducts 1 from reserve (ledger -1).

---

## 8. Attribution lifecycle (short)

1. **Redeem:** Attribution row created with status `redeemed` (inviter, invitee, invite_code_id if one-time).
2. **Invitee active:** When you detect "meaningful activation", update row: `became_active_at`, `attribution_status = 'invitee_active'`; optionally call `grant_invite_reserve_for_milestone(inviter, 'invitee_active')`.
3. **Org created:** When invitee creates an org, set `invitee_org_id`, `attribution_status = 'org_created'`; optionally grant `org_active`.
4. **Package purchase:** When that org buys within 90 days, set `package_purchase_id`, `package_type`, `package_amount_cents`, `package_purchased_at`, `attribution_status = 'package_purchased'`; grant `package_purchase` reserve.

---

## 9. Abuse prevention implemented

- **Self-invite:** Redeem already rejects redeeming your own personal code (inviter_id != redeemer). One-time codes are single-use and tied to the inviter.
- **Frozen users:** `invite_policy_state.frozen_until`; `issue_wallet_invite_code` and `replenish_invite_from_reserve` refuse when frozen.
- **Cap 5 active:** Enforced in `issue_wallet_invite_code`.
- **Reserve cap 10:** Enforced in ledger and in `admin_grant_invite_reserve_credit` and `grant_invite_reserve_for_milestone`.
- **Admin revoke:** Admin can set a code’s status to `revoked` (existing column). Admin can set `frozen_until` to block issue/replenish.

---

## 10. Regression risks

- **Redeem:** Unchanged except additive columns and invite_attributions insert. Same success/error contract.
- **Batch issue:** Now enforces **global 5-code cap** and sets `owner_user_id`. Users who previously had 5+ batch codes and no wallet codes will hit "Max 5 active invite codes" until they redeem or (for wallet codes) codes expire. **Legacy:** Existing batch codes without `owner_user_id` are still counted via `(issued_by_type = 'profile' AND issued_by_id = user_id)`. New batch inserts set `owner_user_id`.
- **Wallet vs batch:** Both paths share one cap; no ambiguity. Admin is exempt from lifetime batch cap only; wallet cap remains 5.
- **Grant milestone API:** Repeatable reasons now **require** `reference_id` in body; one-time reasons must **not** send reference. Old clients that only sent `reason` still work for one-time reasons; for invitee_active/org_active/package_purchase they must add reference_id or get 400.
- **RLS:** Unchanged; writes via RPCs.

---

## 11. QA checklist

- [ ] **Redeem (one-time / personal):** Same as before; invite_attributions row and redeemed_by_user_id/redeemed_at set.
- [ ] **Access gate:** Invite-only unchanged.
- [ ] **Wallet state / issue:** GET wallet, POST wallet/issue; fails with max_active_codes when global active ≥ 5.
- [ ] **Global cap:** With 5 active codes (wallet or batch), neither wallet issue nor batch issue allows more until a code is redeemed or expired.
- [ ] **Batch issue:** Sets owner_user_id; rejects if active ≥ 5 or active + count > 5; same lifetime batch cap as before.
- [ ] **Grant milestone:** One-time (profile_complete, etc.) without reference; repeatable (invitee_active, org_active, package_purchase) with reference_id; idempotent (same reference_id twice returns already_granted).
- [ ] **Replenish:** replenish_invite_from_reserve only issues when invite_healthy_for_replenishment is true; run_invite_replenishment_cycle expires then replenishes up to max_users.
- [ ] **Package attribution:** record_invite_package_attribution(org_id, purchase_id) or POST /api/invites/record-package-attribution; 90-day window; inviter gets +1 reserve per attribution updated.
- [ ] **CdpProviderGate:** Build passes (no type error on CDPReactProvider).
