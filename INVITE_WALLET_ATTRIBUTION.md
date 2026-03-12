# Invite Wallet + Attribution System

**Founder-facing summary.** Implemented as additive, non-breaking changes to the existing invite system.

---

## Final policy (MVP — no ambiguity)

| # | Policy | Final decision |
|---|--------|-----------------|
| **1. Personal codes vs 5-code cap** | The **5-code cap applies only to rows in `invite_codes`** (wallet + batch). **Personal invite code is an explicit exception:** it lives on `profiles.personal_invite_code`, is one per profile, reusable (max 5 redeemers), and **does not count toward the 5**. So a user can have 5 active invite_codes **and** their personal code. |
| **2. Package attribution model** | **First-touch only.** One org purchase credits a single winning inviter: the attribution row with **earliest `created_at`** for that org within the 90-day window. Only that row is updated and only that inviter receives the package_purchase reserve grant. |
| **3. Reward values** | **invitee_active = +1**, **org_active = +2**, **package_purchase = +3** reserve credits. One-time milestones (profile_complete, verified_social, first_activity) = **+1 each**. Total reserve cap remains 10. |
| **4. Batch expiry** | **Intentional exception.** Wallet-issued codes expire in **30 days** if unused. **Batch-issued codes do not expire**; they remain active until redeemed or manually revoked (admin/legacy campaign use). |

---

## 1. How the invite wallet works

- **Active codes / global cap:** Each user has at most **5 active** codes from **`invite_codes`** (wallet + batch). Counted by `get_user_active_invite_count(user_id)`. **Personal invite code is not in `invite_codes`** and does not count toward the 5 (see Final policy above).
- **Expiry:** Wallet-issued codes expire in 30 days if unused. Batch-issued codes **do not expire** (intentional exception; see Final policy).
- **Issue flow:** Wallet: `POST /api/invites/wallet/issue`. Batch: `POST /api/invites/issue` — sets `owner_user_id` and enforces the same 5-code cap. Admin exempt from lifetime batch cap only; wallet cap remains 5.
- **UI:** Invite lineage page shows Invite wallet section: active count, reserve, issue button, active codes (copy), redeemed/successful counts.

---

## 2. How reserve credits work

- **Reserve credits** are a separate balance (`invite_credit_ledger`, sum of `delta`). Cap: **10** per user.
- **Earning (MVP reward values):** `profile_complete` / `verified_social` / `first_activity` = **+1 each** (one-time, no reference). `invitee_active` = **+1**, `org_active` = **+2**, `package_purchase` = **+3** (repeatable, reference_id required). Total reserve capped at 10.
- **Consuming:** Cron `run_invite_replenishment_cycle(max_users)` calls `replenish_invite_from_reserve(user_id)` for healthy users only; creates one code and ledger -1.
- **Admin:** `admin_grant_invite_reserve_credit(target_user_id, delta, reason)` (admin only), up to cap 10.

---

## 3. How attribution works

- **On redeem:** Same as before: `redeem_invite_code` sets `profiles.inviter_id`, `invite_codes.redeemed_by_user_id`/`redeemed_at`, and inserts **invite_attributions** (one row per invitee).
- **Later steps:** Call `grant_invite_reserve_for_milestone` with the right **reference_id** for repeatable reasons (attribution id, org id, purchase id). **Package purchase:** Call `record_invite_package_attribution(org_id, purchase_id, ...)` from billing; **first-touch only** — single winning inviter (earliest attribution for that org in 90 days) gets the package_purchase grant (+3). See `docs/INVITE_PACKAGE_ATTRIBUTION_HOOKS.md`.

---

## 4. Why this prevents spam

- **Cap of 5 active codes** from `invite_codes` (wallet + batch). Personal code is an exception and does not count.
- **30-day expiry** for wallet codes only; batch codes do not expire (intentional).
- **Reserve cap 10** and **reward values** +1/+2/+3 as above.
- **Replenishment** only for **healthy** accounts (age, profile, activity, not frozen).
- **Anti-abuse:** `frozen_until`, self-invite blocked, admin revoke.

---

## 5. What is final for MVP vs intentionally deferred

**Final for MVP (policy and code aligned):**
- **Personal codes:** Explicit exception; do not count toward 5. No code change (cap already counts only `invite_codes`).
- **Package attribution:** First-touch only; one winning inviter per org purchase; implemented in `record_invite_package_attribution`.
- **Reward values:** invitee_active +1, org_active +2, package_purchase +3; one-time +1 each; in `grant_invite_reserve_for_milestone`.
- **Batch expiry:** Intentional exception; batch codes do not expire; documented only.
- Global scarcity, healthy-account replenishment, cron cycle, grant idempotency — all as implemented.

**Intentionally deferred:**
- **Billing integration:** Call package-attribution API/RPC when purchase flow exists (see hook doc).
- **invitee_active / org_active automation:** App must call `grant_invite_reserve_for_milestone` with reference when activation/org creation is detected; no automatic job.
- **Admin UI:** Freeze, grant reserve, revoke — via DB/RPC only.

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
| Migrations | `supabase/migrations/20260326100002_invite_package_attribution.sql` | Index; record_invite_package_attribution (multi-touch, later overridden by 20260326100003) |
| Migrations | `supabase/migrations/20260326100003_invite_policy_final.sql` | Reward values +1/+2/+3 in grant_invite_reserve_for_milestone; first-touch only in record_invite_package_attribution |
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
4. **Package purchase:** Call `record_invite_package_attribution(org_id, purchase_id, ...)`. First-touch: earliest attribution for that org in 90 days gets updated and that inviter gets +3 reserve.

---

## 9. Abuse prevention implemented

- **Self-invite:** Redeem already rejects redeeming your own personal code (inviter_id != redeemer). One-time codes are single-use and tied to the inviter.
- **Frozen users:** `invite_policy_state.frozen_until`; `issue_wallet_invite_code` and `replenish_invite_from_reserve` refuse when frozen.
- **Cap 5 active:** Enforced in `issue_wallet_invite_code`.
- **Reserve cap 10:** Enforced in ledger and in `admin_grant_invite_reserve_credit` and `grant_invite_reserve_for_milestone`.
- **Admin revoke:** Admin can set a code’s status to `revoked` (existing column). Admin can set `frozen_until` to block issue/replenish.

---

## 10. Regression risks from policy decisions

- **Personal codes:** No code change; behavior unchanged. Only docs clarified (exception to 5-cap).
- **First-touch attribution:** **Behavior change.** Previously one purchase could credit multiple inviters; now only the earliest attribution for that org gets the grant. Any org that already had multiple attributions updated for the same purchase is unchanged (past data); going forward only one inviter is credited per org purchase.
- **Reward values (+1/+2/+3):** **Behavior change.** New grants use the higher deltas for org_active and package_purchase. Existing ledger rows unchanged; reserve cap 10 still enforced (grant is LEAST(delta, 10 - current)).
- **Batch expiry:** Doc only; no code change. Batch codes continue not to expire.

---

## 11. QA checklist

- [ ] **Redeem (one-time / personal):** Same as before; invite_attributions row and redeemed_by_user_id/redeemed_at set.
- [ ] **Access gate:** Invite-only unchanged.
- [ ] **Wallet state / issue:** GET wallet, POST wallet/issue; fails with max_active_codes when global active ≥ 5.
- [ ] **Global cap:** With 5 active codes (wallet or batch), neither wallet issue nor batch issue allows more until a code is redeemed or expired.
- [ ] **Batch issue:** Sets owner_user_id; rejects if active ≥ 5 or active + count > 5; same lifetime batch cap as before.
- [ ] **Grant milestone:** One-time (profile_complete, etc.) without reference; repeatable (invitee_active, org_active, package_purchase) with reference_id; idempotent (same reference_id twice returns already_granted).
- [ ] **Replenish:** replenish_invite_from_reserve only issues when invite_healthy_for_replenishment is true; run_invite_replenishment_cycle expires then replenishes up to max_users.
- [ ] **Package attribution:** First-touch only; one inviter (earliest attribution) gets +3 reserve per org purchase; 90-day window.
- [ ] **CdpProviderGate:** Build passes (no type error on CDPReactProvider).
