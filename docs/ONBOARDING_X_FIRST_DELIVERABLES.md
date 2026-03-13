# Onboarding X-first — deliverables

## 1. Current flow vs new flow

| Phase | Before | After |
|-------|--------|--------|
| **Entry** | Login with X → callback with `next=/overview` (or stored) | Unchanged. Login with X only. |
| **Callback** | Bootstrap; if `next !== /onboarding` set `onboarding_completed_at`; redirect to `next`. | Bootstrap returns `needsOnboarding`. If `needsOnboarding` → redirect to `/onboarding` and do **not** set `onboarding_completed_at`. Else → redirect to `next` (existing user). |
| **“Existing” vs “new”** | Inferred in app by missing `account_type`; `onboarding_completed_at` sometimes set in callback. | **Authoritative**: `needsOnboarding` from bootstrap (profile missing `account_type` or `onboarding_completed_at`). New users always sent to `/onboarding`. |
| **Invite gate** | If invite-only and no `inviter_id` → full-screen InviteRequiredView; redeem → then app (AccountTypePage). | If invite-only and no access **and** route is **not** onboarding → InviteRequiredView. If route **is** onboarding → show XFirstOnboarding (step 1 = invite). |
| **Onboarding UI** | AccountTypePage only: Individual/Company → set `account_type` + `onboarding_completed_at` → profile. | XFirstOnboarding: (1) Invite code if required, (2) Role Individual/Company, (3) Profession(s) → set `account_type`, `profile_professions`, `onboarding_completed_at` → profile. |

---

## 2. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/api/auth/post-login-bootstrap/route.ts` | After ensuring profile and syncing X, read `account_type` and `onboarding_completed_at`; return `needsOnboarding: boolean`. Return `needsOnboarding` on all exit paths (including no X identity / no provider_user_id). |
| `apps/web/src/app/auth/callback/page.tsx` | Call bootstrap and read `needsOnboarding`. If `needsOnboarding`: do not set `onboarding_completed_at`; set redirect to `/onboarding`. Else: keep existing redirect and optional `onboarding_completed_at`. |
| `apps/web/src/figma/app/components/XFirstOnboarding.tsx` | **New.** Three steps: invite (when `accessAllowed === false`), role (Individual/Company via set-account-type API), profession (ProfessionSelect + setProfileProfessions), then set `onboarding_completed_at` and redirect to profile. |
| `apps/web/src/figma/app/App.tsx` | Invite gate: show InviteRequiredView only when `accessAllowed === false` **and** route is not onboarding/accountType. Render XFirstOnboarding for route onboarding/accountType with `accessAllowed`, `onAccessGranted`. Removed AccountTypePage import; use XFirstOnboarding. |

**Unchanged:** `/api/me/access`, `/api/invites/redeem`, `/api/onboarding/set-account-type`, `profile_professions` / `setProfileProfessions`, Roles & Skills (advanced profile), LoginPage (still X-only), ensure-social-x, link/finish, analytics backfill.

---

## 3. Auth / account matching logic for X

- **Source of truth:** Supabase Auth. One X identity → one `auth.users` row.
- **“Account exists” for this session:** Profile row for `auth.uid()` with `account_type` in `('individual','company')` and `onboarding_completed_at` non-null.
- **Where computed:** `POST /api/auth/post-login-bootstrap`. After profile ensure and X sync, selects `account_type` and `onboarding_completed_at` for current user; `needsOnboarding = !account_type || account_type not in ('individual','company') || !onboarding_completed_at`.
- **No duplicate accounts:** Same as before. Supabase links one X to one user; `integrations/x/link/finish` returns 409 if X already linked to another account.

---

## 4. Onboarding steps implemented

| Step | Condition | Action |
|------|-----------|--------|
| **1. Invite** | `accessAllowed === false` (invite-only, not yet redeemed). | Input code → `POST /api/invites/redeem` → on success `onAccessGranted()`, go to step 2. |
| **2. Role** | Always (or after invite when required). | Choose Individual or Company → `POST /api/onboarding/set-account-type` with `account_type` → go to step 3. |
| **3. Profession** | After role. | Multi-select (ProfessionSelect) → `setProfileProfessions(userId, ids)` → `updateMyProfile(userId, { onboarding_completed_at })` → `onComplete()`, `setRoute({ name: "profile" })`. |

Profession remains editable later in Settings → Roles & skills (unchanged).

---

## 5. Fields stored and where

| Field | Table / store | Set when |
|-------|----------------|----------|
| `account_type` | `profiles.account_type` | Step 2 (role) via `POST /api/onboarding/set-account-type`. |
| `onboarding_completed_at` | `profiles.onboarding_completed_at` | Step 3 (profession) in XFirstOnboarding on finish. |
| Profession(s) | `profile_professions` (profile_id, profession_id) | Step 3 via `setProfileProfessions(userId, professionIds)`. |
| `inviter_id` | `profiles.inviter_id` | Step 1 via existing `redeem_invite_code` RPC (unchanged). |

---

## 6. Regression risks

| Risk | Mitigation |
|------|-------------|
| Existing user with linked X | Bootstrap returns `needsOnboarding: false`; redirect to `next`; no onboarding. |
| New user, invite-only, valid code | Onboarding step 1; redeem; step 2 → 3; finish. `onAccessGranted` refreshes me and access. |
| New user, invite-only, invalid code | Stuck on step 1 with error until valid code. |
| Invite-only off | Step 1 skipped (`accessAllowed !== false`); only role + profession. |
| Session / no X identity in callback | Bootstrap still returns `needsOnboarding` from profile; redirect logic unchanged for that path. |
| Profession save failure | Step 3 shows error; does not set `onboarding_completed_at` until both profession sync and profile update succeed. |
| Duplicate account for same X | Unchanged; Supabase + link/finish 409. |
| Admin bypass | Unchanged; `/api/me/access` still allows admin handle. |

---

## 7. QA checklist

- [ ] **Existing user with linked X:** Sign in with X → no onboarding; redirect to app (e.g. overview or `next`).
- [ ] **New user, valid invite code (invite-only on):** Sign in with X → onboarding step 1 → enter code → step 2 (role) → step 3 (profession) → profile; `inviter_id` and `account_type` and professions set.
- [ ] **New user, invalid invite code (invite-only on):** Step 1 shows error; cannot proceed until valid code.
- [ ] **Invite-only off:** New user → no step 1; step 2 (role) → step 3 (profession) → profile.
- [ ] **Individual selection:** Step 2 choose Individual → step 3 → profile; `account_type = 'individual'`.
- [ ] **Org/Company selection:** Step 2 choose Company → step 3 → profile; `account_type = 'company'`.
- [ ] **Profession save:** Step 3 select one or more professions → Finish → `profile_professions` and `onboarding_completed_at` set.
- [ ] **Professions editable later:** After onboarding, Settings → Roles & skills; change professions; save; no regression.
- [ ] **No duplicate account:** Same X used twice (e.g. link/finish or second signup) does not create second profile; 409 or single account.
- [ ] **Callback redirect:** New user → redirect to `/onboarding`; existing user → redirect to `next` or default.
- [ ] **Onboarding route when accessAllowed false:** User on `/onboarding` sees XFirstOnboarding (step 1 invite), not full-screen InviteRequiredView.

---

## 8. Founder-facing summary

**What changed**

- Onboarding is now **X-first**: we decide “new” vs “existing” right after X login using profile state (`account_type` + `onboarding_completed_at`). New users are always sent to a single onboarding flow; existing users go straight into the app.
- **One compact onboarding:** Invite code (when invite-only) → Role (Individual or Company) → Profession(s). No long wizard; profession is optional and editable later.
- **Invite and access:** When the platform is invite-only, users who land on onboarding see the invite step first; after redeeming they continue to role and profession. Existing invite-only and admin bypass behavior is unchanged.

**Why this is better**

- **X as source of truth:** We use the same X identity → one account; “existing” is defined clearly (profile has role + completed onboarding), so we never show onboarding to returning users and never create a second account for the same X.
- **Clear funnel:** New users get a short, ordered path: invite (if required) → role → profession → profile, with data stored in the right places and profession editable later in Settings.
- **Safe and backward compatible:** No change to auth provider, invite redeem RPC, org/wallet/analytics, or other flows. Only bootstrap response, callback redirect, and onboarding UI were updated.

**What remains deferred**

- **Session-only callback:** When the user hits the callback without a code (e.g. already has session), we do not call bootstrap there; that path is unchanged. If you want “existing vs new” there too, we can add a bootstrap call and the same redirect logic.
- **Non-X sign-in:** Still not supported; onboarding is designed for X-first only.
- **Org vs Individual routing after onboarding:** We always send to profile after finish; routing to orgs list for Company could be added later if desired.
