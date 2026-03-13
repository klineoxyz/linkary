# X-first onboarding — final QA + hardening deliverables

## 1. Bugs or risks found

### Fixed (one bug)

| Bug | Location | Risk | Fix |
|-----|----------|------|-----|
| **Session branch in auth callback did not check needsOnboarding** | `apps/web/src/app/auth/callback/page.tsx` (no-code path when user has existing session) | New users who hit the callback without the `code` query param (e.g. refresh, bookmark, or session restored) were treated like returning users: `onboarding_completed_at` was set and they were redirected to `redirectTo` (e.g. /overview). They would skip onboarding entirely. | Session branch now calls `POST /api/auth/post-login-bootstrap`, reads `needsOnboarding`, and uses it to: (1) avoid setting `onboarding_completed_at` when `needsOnboardingSession` is true; (2) redirect to `/onboarding` when `needsOnboardingSession` is true, otherwise keep existing redirect logic. |

### Verified (no code change)

- **Existing user bypass:** Bootstrap returns `needsOnboarding: false` when profile has `account_type` and `onboarding_completed_at`; callback and session branch both redirect to app. No loop.
- **onboarding_completed_at set too early:** Only set in callback when `!(isOnboardingNext \|\| needsOnboarding)` (code path) or `!(isOnboardingNextSession \|\| needsOnboardingSession)` (session path). Only set in runAuthGate in the branch where profile already has `account_type`. Only set in XFirstOnboarding in `handleProfessionFinish` after profession save. No early set.
- **Optional referral + invalid code:** When referral is optional, "Skip" is always shown; user can skip and proceed. Not trapped.
- **Invite gate vs onboarding route:** When route is onboarding/accountType we render XFirstOnboarding even if `accessAllowed === false`; InviteRequiredView only when not on onboarding route. No conflict.
- **Duplicate account for same X:** Unchanged; Supabase 1:1 and link/finish 409.
- **Sign out:** `accessAllowed`, `inviteOnly` (and me, authUserId) reset in `handleSignOut`.
- **Race (bootstrap vs callback vs access):** Callback runs bootstrap then redirects. App loads on new URL; runAuthGate runs, fetches profile and access. Order is well-defined. No fix needed.
- **accessAllowed / inviteOnly stale:** After redeem we call `onAccessGranted()` which refreshes me and sets accessAllowed. inviteOnly is not refetched but is constant for the session. OK.

### Low-risk (not fixed this pass)

- **Access API failure (e.g. 401/5xx):** If `/api/me/access` fails, `inviteOnly` is set to null from response, so referral step shows as optional. On an invite-only platform this could allow treating referral as optional until next load. Mitigation: ensure access endpoint is stable; optional follow-up could default `inviteOnly` when response is missing (e.g. from env or separate health response).
- **No-session path in runAuthGate:** When there is no session we never set `authBootstrapped = true`. Effect runs once per mount; after login we get a full-page redirect so mount is fresh. No change made.

---

## 2. Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/auth/callback/page.tsx` | In the "no code, has session" branch: call `POST /api/auth/post-login-bootstrap`, read `needsOnboardingSession`; use it to avoid setting `onboarding_completed_at` for new users and to redirect new users to `/onboarding`; keep existing redirect logic for returning users. |

No other files modified. No redesign, no new product scope.

---

## 3. Fixes made

**Session branch (callback, no `code` param):**

1. After `ensureProfileForSession`, call `POST /api/auth/post-login-bootstrap` with current session token.
2. Parse `needsOnboardingSession = bootstrapJsonSession.needsOnboarding === true`.
3. When updating profile: if `isOnboardingNextSession || needsOnboardingSession`, update only bio/display_name (do **not** set `onboarding_completed_at`). Else set `onboarding_completed_at` (returning user).
4. When redirecting: if `needsOnboardingSession`, `finalUrl = base + "/onboarding"`. Else keep previous logic: if `skipOnboardingSession` then `/profile`, else `redirectTo`.

Result: New users who hit the callback without a code (e.g. refresh or revisit) are sent to onboarding and do not get `onboarding_completed_at` set. Returning users keep previous behavior.

---

## 4. What was verified (16 scenarios + inspections)

| # | Scenario | Result |
|---|----------|--------|
| 1 | Existing user with linked X logs in | Skip onboarding; land in app. Bootstrap `needsOnboarding: false`; redirect to `next` or default. |
| 2 | New user, invite-only ON, valid code | Referral required; redeem → role → profession; `inviter_id` and `onboarding_completed_at` set only after finish. |
| 3 | New user, invite-only ON, invalid code | Blocked on step 1; error shown; no Skip. |
| 4 | New user, invite-only OFF, no code | Skip referral; role → profession; finish. |
| 5 | New user, invite-only OFF, valid code | Enter code → redeem (attribution) → role → profession. |
| 6 | New user, invite-only OFF, invalid code | Error on submit; "Skip" remains visible; user can skip and continue. Not trapped. |
| 7 | Individual selection | `POST /api/onboarding/set-account-type` with `account_type: "individual"`; DB updated. |
| 8 | Company selection | Same API with `account_type: "company"`. |
| 9 | Profession empty | Allowed; `setProfileProfessions(userId, [])`; then `onboarding_completed_at` set. |
| 10 | Profession selected | `setProfileProfessions` then profile update; both persisted. |
| 11 | Profession editable later | Roles & skills / advanced profile use same `profile_professions` and APIs; no change. |
| 12 | No duplicate account for same X | Supabase + link/finish 409; no change. |
| 13 | No onboarding loop after completion | After finish we set route to profile; runAuthGate sees `account_type` and does not set route to accountType. |
| 14 | Callback redirect stable | Code path: needsOnboarding → /onboarding. Session path (after fix): needsOnboardingSession → /onboarding. |
| 15 | Sign out / sign in resets state | Sign out clears authUserId, me, accessAllowed, inviteOnly; sign in runs runAuthGate again. |
| 16 | Invite-only gate and onboarding route | Gate shows InviteRequiredView only when `!isOnboardingRoute`; onboarding route always shows XFirstOnboarding. |

**Inspections:**

- **Race (bootstrap / callback / access / route):** Callback runs bootstrap then full-page redirect. App mount runs runAuthGate (profile + access). Order is deterministic.
- **onboarding_completed_at too early:** Only set when not needsOnboarding (callback both paths) or when profile has account_type (runAuthGate) or in handleProfessionFinish (onboarding). Verified.
- **Stale accessAllowed / inviteOnly:** Only updated from access response and on redeem (accessAllowed); inviteOnly from access only. Sufficient for session.
- **Optional referral UX:** Skip always visible when optional; invalid code shows error but user can skip.
- **Existing users sent to onboarding:** Only when bootstrap returns `needsOnboarding: true` (missing or invalid `account_type` or `onboarding_completed_at`). Existing users have both set.

---

## 5. Remaining low-risk follow-ups

1. **Access API failure:** If `/api/me/access` fails, client may show optional referral in an invite-only environment. Consider returning or inferring `inviteOnly` so the client can degrade safely (e.g. require referral when in doubt).
2. **runAuthGate when no session:** Optionally set `authBootstrapped(true)` when `!session` so the app has a single “auth check done” signal (current behavior is safe because login does a full redirect and new mount).

---

## 6. Founder summary

**Is onboarding ship-safe?**  
Yes, for the intended X-first flow. One real bug was found and fixed; the rest of the flow was verified against your 16 scenarios and inspection list.

**Edge case fixed:**  
If a new user hit the auth callback without the `code` query param (e.g. refresh, bookmark, or returning to the callback URL with an existing session), the app used to set `onboarding_completed_at` and send them into the app, skipping onboarding. The callback’s session branch now uses bootstrap’s `needsOnboarding` so new users are always sent to `/onboarding` and never get `onboarding_completed_at` set there.

**Intentionally deferred:**  
- No change to product (referral/role/profession rules, optional profession).  
- Access-failure edge case and no-session `authBootstrapped` left as documented low-risk follow-ups.  
- No broad refactor; only the callback session branch was changed for stability and rollout safety.
