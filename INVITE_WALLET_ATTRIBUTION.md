# Invite Wallet + Attribution System

**Founder-facing summary.** Implemented as additive, non-breaking changes to the existing invite system.

---

## 1. How the invite wallet works

- **Active codes:** Each approved user can have up to **5 active** invite codes at a time. Active = status `available`, not expired, not revoked.
- **Codes expire** 30 days after issuance if unused. When a code is redeemed or expires, that slot frees up and the user can issue another (or get one back via replenishment).
- **Issue flow:** User clicks "Issue new code" on the Invite lineage page (wallet section). The app calls `POST /api/invites/wallet/issue`. The backend creates one row in `invite_codes` with `owner_user_id`, `source_reason = 'base'`, `expires_at = now() + 30 days`. No batch is used for wallet codes.
- **Existing flows unchanged:** Batch-allocated codes (admin allocates to profile/org) and the existing "Issue" path (`/api/invites/issue`) still work. Personal invite codes (one per profile, reusable, cap 5 redeemers) are unchanged. Redemption still supports both one-time codes and personal codes via the same `redeem_invite_code` RPC.
- **UI:** The "Invite lineage" page now shows an **Invite wallet** section at the top: active codes count, reserve credits, "Issue new code", list of active codes (copy), and redeemed/successful counts.

---

## 2. How reserve credits work

- **Reserve credits** are a separate balance (stored in `invite_credit_ledger` as sum of `delta`). MVP cap: **10** per user.
- They do **not** create unlimited live invites. They are used to **top the user back up to 5 active invites** when they drop below 5 (e.g. after a code is redeemed or expired).
- **Earning reserve (MVP):** Grant reasons: `profile_complete`, `verified_social`, `first_activity`, `invitee_active`, `org_active`, `package_purchase`. The app (or a cron) should call `grant_invite_reserve_for_milestone(user_id, reason)` when the user hits that milestone. Each reason is granted **at most once** per user. Total reserve is capped at 10.
- **Consuming reserve:** A **replenishment** process (cron or server job) calls `replenish_invite_from_reserve(user_id)` for users who have `reserve_credits > 0` and `active_codes_count < 5` and pass healthy-account checks. That creates one new code and inserts a ledger row with `delta = -1`, `reason = 'replenish_issued'`.
- **Admin:** `admin_grant_invite_reserve_credit(target_user_id, delta, reason)` (admin only) adds reserve up to the 10 cap.

---

## 3. How attribution works

- **On redeem:** When a code is redeemed (one-time or personal), the existing flow sets `profiles.inviter_id` and inserts into `invite_redemptions` (one-time only). The updated `redeem_invite_code` RPC also sets `invite_codes.redeemed_by_user_id`, `redeemed_at` and inserts one row into **invite_attributions** (inviter, invitee, invite_code_id if one-time, status `redeemed`). One row per invitee (unique on `invitee_user_id`).
- **Later steps (for analytics/rewards):** When the invitee becomes "active", or creates an org, or that org buys a package within 90 days, the app or a job should update the same attribution row (`became_active_at`, `invitee_org_id`, `package_purchase_id`, `attribution_status`). Reward logic can then grant reserve (e.g. `invitee_active` → +1, `org_active` → +2, `package_purchase` → +3) via `grant_invite_reserve_for_milestone`. **Package purchase** storage is in place (`package_purchase_id`, `package_type`, `package_amount_cents`, `package_purchased_at`); the actual purchase event and 90-day window need to be wired to your billing/payments when available.

---

## 4. Why this prevents spam

- **Cap of 5 active codes** per user: no one can generate unlimited links.
- **30-day expiry:** unused codes free the slot; no permanent hoarding.
- **Reserve cap 10:** even with rewards, users cannot accumulate unbounded reserve.
- **Replenishment** can be gated by healthy-account checks (e.g. account age, recent activity, no abuse flags); the RPC `replenish_invite_from_reserve` already respects `frozen_until` in `invite_policy_state`.
- **Anti-abuse:** `invite_policy_state` has `frozen_until` and `suspicious_invite_score`. Admin can freeze a user (set `frozen_until`); `issue_wallet_invite_code` and replenishment refuse to issue when frozen. Self-invite is already blocked (redeem rejects same user as inviter). Further guards (IP/device clustering, low-quality conversion flags) can be added in policy checks without changing the core schema.

---

## 5. What can be expanded later

- **Healthy-account rules:** Replenishment today only checks reserve, active count, and frozen. Add checks for account age, last activity, minimum profile completeness, and abuse flags.
- **Cron:** Run `expire_invite_codes()` periodically; run replenishment for eligible users (e.g. batch of users with reserve > 0 and active < 5).
- **Reward automation:** Call `grant_invite_reserve_for_milestone` when profile is completed, social verified, first activity, and when attribution rows are updated to `invitee_active`, `org_active`, `package_purchased`.
- **Package purchase:** When you have a purchase event, create or update the attribution row and set `package_purchase_id`, `package_purchased_at`, `attribution_status = 'package_purchased'`, then grant +3 reserve if within 90 days of invite.
- **Admin UI:** Freeze user, grant reserve, revoke a code (set status to `revoked`), view policy state and ledger.

---

## 6. Files changed (exact)

| Area | File | Change |
|------|------|--------|
| Migrations | `supabase/migrations/20260326000000_invite_wallet_schema.sql` | New: invite_codes columns (owner_user_id, redeemed_by_user_id, redeemed_at, source_reason); tables invite_credit_ledger, invite_attributions, invite_policy_state; RLS; backfill owner_user_id |
| Migrations | `supabase/migrations/20260326000001_redeem_invite_attribution.sql` | Update redeem_invite_code: set redeemed_by_user_id/redeemed_at; insert invite_attributions (one-time and personal) |
| Migrations | `supabase/migrations/20260326000002_invite_wallet_rpcs.sql` | New: get_invite_wallet_state, gen_wallet_invite_code, issue_wallet_invite_code, expire_invite_codes, replenish_invite_from_reserve, admin_grant_invite_reserve_credit |
| Migrations | `supabase/migrations/20260326000003_invite_reserve_milestone.sql` | New: grant_invite_reserve_for_milestone (one-time reserve grant per reason, cap 10) |
| API | `apps/web/src/app/api/invites/wallet/route.ts` | New: GET wallet state via get_invite_wallet_state |
| API | `apps/web/src/app/api/invites/wallet/issue/route.ts` | New: POST issue one code via issue_wallet_invite_code |
| UI | `apps/web/src/figma/app/components/InviteWalletSection.tsx` | New: wallet state, active/redeemed/successful, issue button, copy code |
| UI | `apps/web/src/figma/app/components/InviteLineagePage.tsx` | Add InviteWalletSection at top of page |

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

- **Redeem:** Logic unchanged except additive: we set two more columns on `invite_codes` and insert into `invite_attributions`. Same success/error contract. Personal and one-time paths both work as before.
- **Existing issue:** `/api/invites/issue` still uses batches; no change. Wallet issue is a separate route.
- **my-codes / lineage:** Queries that select from `invite_codes` did not require new columns; existing selects still work. If any code expects a fixed column list, extend the select to include the new columns or leave them out (they’re nullable).
- **RLS:** New tables have RLS; policies are read-only for users. Writes go through RPCs (definer).

---

## 11. QA checklist

- [ ] **Redeem (one-time):** Redeem an existing one-time code; confirm profile.inviter_id set, invite_redemptions row, invite_codes status redeemed, redeemed_by_user_id and redeemed_at set, one invite_attributions row.
- [ ] **Redeem (personal):** Redeem a personal code; confirm inviter_id set, one invite_attributions row with invite_code_id null.
- [ ] **Access gate:** Invite-only still allows users with inviter_id; blocks users without.
- [ ] **Wallet state:** GET /api/invites/wallet returns active_codes_count, reserve_credits, codes, redeemed, successful_invites.
- [ ] **Wallet issue:** POST /api/invites/wallet/issue creates one code when active < 5; fails with max_active_codes when already 5.
- [ ] **Invite lineage page:** Load page; wallet section shows at top; issue button works; copy code works.
- [ ] **Existing issue:** Batch issue still works for users with batches; admin issue unchanged.
- [ ] **Lineage:** Inviter/invitees still load from profiles.inviter_id; lineage API unchanged.
- [ ] **Admin:** admin_grant_invite_reserve_credit (via service or authenticated admin) adds reserve up to 10.
- [ ] **Expire:** Running expire_invite_codes() marks old available codes expired.
- [ ] **Replenish:** replenish_invite_from_reserve(user with reserve and active < 5) creates one code and ledger -1.
