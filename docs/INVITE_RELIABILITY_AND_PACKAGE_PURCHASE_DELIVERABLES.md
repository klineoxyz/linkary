# Invite reward reliability review & package-purchase readiness

## 1. Exact reliability risks (before fix)

| Risk | Severity | Detail |
|------|----------|--------|
| **profile_complete / invitee_active client-dependent** | **High** | Both were triggered by two separate client `fetch()` calls after the client had already updated profile (via Supabase from browser). If the user closed the tab, had a flaky network, or one of the two requests failed, one or both rewards could be missed. No retry. |
| verified_social | Low | Triggered from server (link/finish API); callback waits for link/finish response before redirect. If link/finish fails we show error. So reward is tied to the same success path. |
| org_active | Low | Triggered from server (orgs/create API) after org is created; fire-and-forget. If RPC fails we still return 200. Reward could be missed on RPC failure but not on client close. |

---

## 2. Fix applied: single server round-trip for onboarding completion

**Change:** Replace client-side profile update + two fire-and-forget fetches with **one** server-side API that does profile update, profession sync, profile_complete grant, and invitee_active in a single request.

| File | Change |
|------|--------|
| **apps/web/src/app/api/onboarding/complete/route.ts** | **New.** POST; auth required. Body: `{ profession_ids?: string[] }`. Updates `profiles.onboarding_completed_at`, syncs `profile_professions`, then calls `grant_invite_reserve_for_milestone(user.id, 'profile_complete')` and `record_invitee_active()`. Returns 200 when all succeed. |
| **apps/web/src/figma/app/components/XFirstOnboarding.tsx** | **Updated.** `handleProfessionFinish` now calls only `POST /api/onboarding/complete` with `profession_ids`; removed direct `updateMyProfile`, `setProfileProfessions`, and the two `fetch()` calls to grant-milestone and mark-invitee-active. Imports for `updateMyProfile` and `profileProfessions` removed. |
| **supabase/migrations/20260331000000_package_attribution_grant_fix.sql** | **New.** `record_invite_package_attribution` now calls `grant_invite_reserve_for_milestone_for_user(v_inviter_id, ...)` instead of `grant_invite_reserve_for_milestone`, so the inviter receives +3 when called from API (where auth.uid() is the org member). |

**Result:** One request does all four operations. If the request succeeds, all four are done. If the user closes the tab after the request is sent, the server may still complete (in-flight request). If the request fails, we show error and do not navigate away; user can retry. No more “second request never sent” gap.

---

## 3. What is good enough for MVP

| Trigger | Location | Good for MVP? | Notes |
|---------|----------|----------------|--------|
| **profile_complete** | Server (POST /api/onboarding/complete) | Yes | Single round-trip; no client-only dependency. |
| **invitee_active** | Server (same API) | Yes | Same request; inviter reward is consistent with completion. |
| **verified_social** | Server (link/finish API) | Yes | Tied to X link success; callback blocks on link/finish. |
| **org_active** | Server (orgs/create API) | Yes | Fire-and-forget after org create; acceptable for MVP; can make blocking later if needed. |

---

## 4. What should move server-side later (optional hardening)

| Item | Current | Later improvement |
|------|---------|-------------------|
| **org_active** | Fire-and-forget in orgs/create; 200 returned before RPC completes | Await `record_invitee_org_created` and surface failure (e.g. 207 or retry) so reward is not silently missed. |
| **verified_social** | Already server-side | No change. |
| **profile_complete / invitee_active** | Now in single server API | No change; already server-side. |
| **first_activity** | Not wired | When product defines “first activity”, trigger from the canonical server event (e.g. first case study created, first connection). |
| **package_purchase** | API exists; no billing flow yet | Call from Stripe webhook or purchase-success handler (server-side only). |

---

## 5. invitee_active meaning and verified_social in X-first product

**invitee_active — MVP definition**

- **Current (intended):** Invitee has “activated” when they complete onboarding (referral + role + profession and `onboarding_completed_at` set). At that moment we mark the attribution as `invitee_active` and grant the inviter +1.
- **Conclusion:** Onboarding completion is the right MVP definition. No change. A future “first meaningful activity” (e.g. first post, first connection) could be a separate milestone if product wants it.

**verified_social in X-first product**

- **Current:** We grant +1 when the user completes X link/finish (profile updated with X handle, link/finish API runs). In X-first onboarding, new users link X at login; existing users already have X linked. So every new user gets verified_social when they complete the OAuth callback and link/finish runs.
- **Conclusion:** Still meaningful. We reward “verified X identity”; no change. If we later add other social providers we could extend to “verified_social” per provider or keep a single one-time reward.

---

## 6. Package-purchase readiness summary

**Hook points**

- **API:** `POST /api/invites/record-package-attribution`  
  Body: `{ org_id, purchase_id, package_type?, amount_cents? }`. Caller must be authenticated and a member of the org.
- **RPC:** `record_invite_package_attribution(p_org_id, p_purchase_id, p_package_type?, p_amount_cents?)`  
  Call from backend (e.g. Stripe webhook) with service role or trusted server context.

**Required payloads**

- `org_id` (UUID), `purchase_id` (UUID) — required.
- `package_type` (string), `amount_cents` (number) — optional; stored on attribution row.

**First-touch behavior**

- Single winning inviter: earliest attribution row for that org in the 90-day window (`invitee_org_id = p_org_id`, `created_at >= now() - 90 days`, `attribution_status != 'package_purchased'`), ordered by `created_at ASC`, limit 1. That row is updated and the inviter gets +3 reserve (cap 10).

**Idempotency**

- After update, that row has `attribution_status = 'package_purchased'`. Subsequent calls for the same org find no eligible row → return `attributions_updated: 0`. Same `purchase_id` for same org would try to update an already-updated row; the SELECT excludes `package_purchased` rows, so we do not double-grant. Safe to call with same purchase_id (no-op after first).

**Package-attribution grant fix (reliability)**

- `record_invite_package_attribution` was calling `grant_invite_reserve_for_milestone(v_inviter_id, ...)`, which enforces grantee = `auth.uid()`. When the API is called with the org member’s token, `auth.uid()` is the org member, so the inviter never received +3. **Fix:** migration `20260331000000_package_attribution_grant_fix.sql` updates the RPC to call `grant_invite_reserve_for_milestone_for_user(v_inviter_id, ...)` so the inviter is correctly granted +3 when an org completes a purchase.

**Multi-org invitee caveat (MVP acceptable)**

- Each invitee has **one** attribution row. `record_invitee_org_created(p_org_id)` sets `invitee_org_id = p_org_id` on that row (overwrites). So if an invitee creates org A then org B, only the **last** org (B) is stored. Package attribution lookup is by `invitee_org_id = p_org_id`. So only the most recently “recorded” org has a matching row; purchases by the earlier org (A) would get no attribution. For MVP with one org per user this is fine. **Later:** If we need multiple orgs per invitee to each get attribution, either only set `invitee_org_id` when null (first org only) or add a separate org–attribution structure.

---

## 7. Regression / QA (reliability pass)

- [ ] New user completes onboarding (referral → role → profession) → single POST to `/api/onboarding/complete` → profile has `onboarding_completed_at`, professions set, user has +1 profile_complete, inviter has +1 invitee_active (when applicable).
- [ ] Request to `/api/onboarding/complete` with invalid token → 401.
- [ ] Request with valid token and optional `profession_ids` → 200 and DB consistent.
- [ ] verified_social and org_active flows unchanged (link/finish and org create); no regression.
- [ ] Package: when billing exists, call `POST /api/invites/record-package-attribution` or RPC with `org_id` + `purchase_id` and confirm one inviter gets +3 and attribution row updated.

---

## 8. Founder summary

**Reliability**

- **Fixed:** profile_complete and invitee_active were the only rewards that depended on two separate client requests after a client-side profile update; they could be missed on tab close or failed second request. They now run in a **single server API** (`POST /api/onboarding/complete`) that updates profile, professions, grants profile_complete, and marks invitee_active. One success = all four done; failures are visible and retriable.

**What is good enough for MVP**

- profile_complete and invitee_active: server-side in one call.  
- verified_social: server-side in link/finish.  
- org_active: server-side in org create (fire-and-forget; optional later: await RPC for harder guarantee).

**What to move server-side later (optional)**

- Await org_active RPC in org create if we want to guarantee inviter reward.  
- first_activity: wire when product defines it.  
- package_purchase: call from billing webhook/success path when purchase flow exists.

**Package-purchase readiness**

- Hook points and payloads are defined; first-touch and idempotency are correct. A **bug was fixed:** `record_invite_package_attribution` now grants to the inviter via `grant_invite_reserve_for_milestone_for_user` (previously it used the public grant RPC, which would have rejected the grant when called from the API). When billing is added, call the existing API or RPC with `org_id` and `purchase_id`. One caveat: if an invitee creates multiple orgs, only the last one is linked for package attribution (MVP acceptable; can refine later).

**No broad refactor**

- Only the onboarding completion path was changed (one new API, client calls it instead of three separate operations). All other invite/reward behavior and semantics are unchanged.
