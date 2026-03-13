# Invite / reward event wiring — deliverables

## 1. Events wired

| Event | Trigger location | Reward | Idempotency |
|-------|------------------|--------|-------------|
| **profile_complete** | Onboarding finish (XFirstOnboarding handleProfessionFinish, after setting `onboarding_completed_at`) | Current user gets +1 reserve (one-time) | grant_invite_reserve_for_milestone: one-time reason, no reference; duplicate call returns already_granted |
| **verified_social** | X link/finish (POST /api/integrations/x/link/finish, after profile update) | Current user gets +1 reserve (one-time) | Same; non-blocking fire-and-forget |
| **invitee_active** | Onboarding finish (same flow as profile_complete; client calls POST /api/invites/mark-invitee-active) | Inviter gets +1 reserve | record_invitee_active updates only when attribution_status = 'redeemed'; grant per (inviter, invitee_active, attribution_id) |
| **org_active** | Org create (POST /api/orgs/create, after create_org_and_membership succeeds) | Inviter gets +2 reserve | grant per (inviter, org_active, org_id); same org twice returns already_granted |

**first_activity** — Not wired. No single canonical “first activity” event in the codebase (could be first case study, first message, etc.). Deferred until product defines one.

**package_purchase** — Not wired. No billing/purchase flow found (Plans/Billing UI exists but no Stripe or purchase completion event). Hook point remains: POST /api/invites/record-package-attribution and RPC `record_invite_package_attribution` are implemented; call from billing webhook or success path when purchase flow exists.

---

## 2. Files changed

| File | Change |
|------|--------|
| **supabase/migrations/20260330000000_invite_event_wiring.sql** | New. Adds `grant_invite_reserve_for_milestone_for_user` (internal, SECURITY DEFINER, no auth check; not granted to authenticated). Adds `record_invitee_active()` (invitee marks self active; updates attribution; grants inviter +1). Adds `record_invitee_org_created(p_org_id)` (caller must be org member; updates attribution; grants inviter +2). |
| **apps/web/src/app/api/invites/mark-invitee-active/route.ts** | New. POST; auth required; calls `record_invitee_active` RPC. |
| **apps/web/src/figma/app/components/XFirstOnboarding.tsx** | After setting `onboarding_completed_at`, calls POST /api/invites/wallet/grant-milestone with `reason: 'profile_complete'` and POST /api/invites/mark-invitee-active (both non-blocking). |
| **apps/web/src/app/api/integrations/x/link/finish/route.ts** | After profile update, calls `grant_invite_reserve_for_milestone(currentUser.id, 'verified_social')` (non-blocking). |
| **apps/web/src/app/api/orgs/create/route.ts** | After org create success, calls `record_invitee_org_created(org.id)` (non-blocking). |

---

## 3. API / RPC calls added

| Call | Where | Purpose |
|------|--------|---------|
| `POST /api/invites/wallet/grant-milestone` | XFirstOnboarding (client) | Grant current user +1 for profile_complete |
| `POST /api/invites/mark-invitee-active` | XFirstOnboarding (client) | Mark invitee active and grant inviter +1 |
| `supabase.rpc('grant_invite_reserve_for_milestone', { p_user_id, p_reason: 'verified_social' })` | link/finish route | Grant current user +1 for verified_social |
| `supabase.rpc('record_invitee_org_created', { p_org_id })` | orgs/create route | Update attribution and grant inviter +2 for org_active |
| `grant_invite_reserve_for_milestone_for_user` (internal) | Only from record_invitee_active / record_invitee_org_created | Grant reserve to inviter (no auth.uid() check) |

---

## 4. Events deferred and why

| Event | Reason |
|-------|--------|
| **first_activity** | No single canonical “first activity” event; product would need to define (e.g. first case study, first connection, first message). |
| **package_purchase** | No billing/purchase completion in codebase; API and RPC exist for when Stripe or purchase flow is added. |

---

## 5. Regression risks

| Risk | Mitigation |
|------|------------|
| Onboarding finish blocks on grant/mark-invitee | Both calls are fire-and-forget (.catch(() => {})); failure does not block redirect or onComplete. |
| link/finish or org create fail if RPC fails | RPC calls are .then(() => {}).catch(() => {}); response is returned before/regardless of grant. |
| Double grant for same milestone | profile_complete / verified_social: one-time, no reference; ledger unique on (user, reason, ref). invitee_active: update only when status = 'redeemed'. org_active: grant idempotent per (inviter, org_active, org_id). |
| Inviter grant from wrong caller | record_invitee_active uses auth.uid() as invitee; record_invitee_org_created checks org_members for auth.uid(); grant_for_user only callable from those definer functions. |
| Existing invite attribution / redeem | No change to redeem_invite_code or invite_attributions insert; only new RPCs and post-event calls. |

---

## 6. QA checklist

- [ ] **profile_complete:** New user completes onboarding (referral → role → profession) → user’s reserve +1 (once); ledger has one row reason profile_complete.
- [ ] **verified_social:** User connects X (Settings Integrations or first-time login callback) → user’s reserve +1 (once); ledger has one row reason verified_social.
- [ ] **invitee_active:** New user with inviter_id completes onboarding → inviter’s reserve +1; attribution row for that invitee has attribution_status invitee_active and became_active_at set; idempotent (second call no-op).
- [ ] **org_active:** Invitee creates org → inviter’s reserve +2; attribution row has invitee_org_id and attribution_status org_created; same org again already_granted.
- [ ] **Onboarding still completes** if grant or mark-invitee-active fails (non-blocking).
- [ ] **link/finish and org create** still return success if grant RPC fails (non-blocking).
- [ ] **No change** to redeem flow, invite-only gate, or wallet state reads.

---

## 7. Founder summary

**What is now automated**

- **profile_complete:** When a user finishes onboarding (role + profession step), they receive +1 reserve credit (one-time). No extra UI.
- **verified_social:** When a user connects X (first-time login or Settings → Connect X), they receive +1 reserve credit (one-time).
- **invitee_active:** When an invited user finishes onboarding, their inviter receives +1 reserve; attribution row is updated to invitee_active.
- **org_active:** When an invited user creates an org, their inviter receives +2 reserve; attribution row is updated with that org (org_created).

All of the above are non-blocking (failures do not block the main flow) and idempotent where required.

**What still needs billing / admin / UI support**

- **first_activity:** Not wired; needs a defined “first activity” event (e.g. first case study, first message) and a single place to trigger it.
- **package_purchase:** RPC and POST /api/invites/record-package-attribution exist; must be called from the billing flow (e.g. Stripe webhook or purchase success) when an org completes a purchase, with org_id and purchase_id.
- **Admin:** Grant/freeze/revoke remain via DB/RPC or future admin UI; no change in this pass.
