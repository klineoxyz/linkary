# Onboarding redesign: X as source of truth — audit and insertion points

## 1. Current flow (before changes)

### A. Login entry
- **LoginPage** (`/login`): Single CTA "Sign in with X". Uses Supabase OAuth with `redirectTo = callbackUrl?next=/overview` (hardcoded `/overview`).
- No distinction yet between new vs returning user; everyone goes to same callback then redirect to `next`.

### B. Auth callback (`/auth/callback`)
1. Exchange code for session; set session cookies.
2. If org X flow: verify org, redirect to `redirectTo`.
3. Else: `ensureProfileForSession(user.id)` (creates profile row if missing).
4. `POST /api/auth/post-login-bootstrap`: ensures profile, upserts `social_accounts` from X identity, updates `profiles.twitter_username` / `twitter_user_id`, claims username from X handle.
5. `saveTwitterIdentityFromOAuth` (mirror X to profile).
6. **Branch by `next`**: if `next === "/onboarding"` → update bio/display_name only (do **not** set `onboarding_completed_at`). Else → set `onboarding_completed_at = now()` (marks complete).
7. `POST /api/integrations/x/link/finish`: upsert `social_accounts` (and 409 if X already linked to another account).
8. ensure-backfill (analytics); then redirect to `redirectTo` (or `/profile` if `skipOnboarding` and had identity).

**Gap**: Default `next` from LoginPage is `/overview`, so we set `onboarding_completed_at` for everyone. "New" users are only detected later in the app by missing `account_type`.

### C. App bootstrap (`runAuthGate` in App.tsx)
1. Get session; `ensureProfileForSession`; `getMyProfile`.
2. **Existing logic**: if `profile.account_type` is null/empty → `setRoute({ name: "accountType" })`. Else if no `onboarding_completed_at` → auto-set it and continue.
3. Call `GET /api/me/access`: when `LINKARY_INVITE_ONLY=true`, `allowed = true` only if profile has `inviter_id` or admin handle.
4. If `accessAllowed === false` → render **InviteRequiredView** (full-screen; user must redeem code).
5. After redeem, `onSuccess` sets `accessAllowed = true` and `refreshMe()`; user then sees main app. Route is still `accountType`, so **AccountTypePage** is shown (Individual / Company).

### D. Current onboarding UI
- **AccountTypePage**: Single step — choose Individual or Company; saves `account_type` + `onboarding_completed_at`, then `setRoute({ name: "profile" })`.
- **OnboardingPage** (legacy, 3 steps: claim username → account type → profile + professions) is **not** used by the main route; path `/onboarding` maps to `accountType` and renders AccountTypePage only.
- **Profession**: Editable in advanced profile (Roles & Skills); not collected in current AccountTypePage.

### E. X identity and “existing account”
- **Supabase**: One X identity → one `auth.users` row (OAuth link). No duplicate auth users for the same X.
- **Linkary**: Profile `id = auth.uid()`; `social_accounts` and `profiles.twitter_username` / `twitter_user_id` store X. **integrations/x/link/finish** forbids linking the same X to a second account (409).
- **“Existing account”** in practice: profile exists and has completed onboarding. We treat “existing” as: `account_type` set and `onboarding_completed_at` set. “New” = profile just created or missing `account_type` / `onboarding_completed_at`.

---

## 2. Desired flow (X-first, minimal onboarding)

| Step | Who | Action |
|------|-----|--------|
| A | User | Starts with X login / X connect. |
| B | System | After X auth: **check if this X identity already has a Linkary account** (profile with `account_type` + `onboarding_completed_at`). |
| C | Existing user | Complete login → go to app (no onboarding). |
| D | New user | Show **compact onboarding**: (1) Referral/invite code, (2) Role: Individual or Org, (3) Profession(s). Then create/finish account and route to Profile (or first in-app destination). |

Invite: keep current invite-only logic and redeem behavior; new users get invite step inside onboarding; existing users never see it again. Admin bypass unchanged.

---

## 3. Authoritative “account exists for this X” check

- **Where**: After session is established, use **profile** as source of truth: same user id as `auth.uid()`.
- **Definition**: “Account exists” ⇔ profile row exists and has `account_type` in `('individual','company')` and `onboarding_completed_at` is non-null.
- **Implementation**: In **post-login-bootstrap** (already has profile after ensure/upsert): before returning, read `account_type` and `onboarding_completed_at` for that user; return e.g. `needsOnboarding: boolean`. Callback then redirects new users to `/onboarding` and does **not** set `onboarding_completed_at` for them.

No separate “lookup by X only” is required: Supabase already maps X → one auth user; we only need to know if that user’s profile is “finished” or not.

---

## 4. Safest insertion points

| Location | Change |
|----------|--------|
| **POST /api/auth/post-login-bootstrap** | After ensuring profile and syncing X, query `profiles` for `account_type` and `onboarding_completed_at`; return `needsOnboarding: true` when either is null/empty. |
| **Auth callback (page.tsx)** | After bootstrap, if response `needsOnboarding === true`: set `redirectTo` to `/onboarding` (or `/app/onboarding` if that’s the path), and **do not** set `onboarding_completed_at` in the callback for this user. If `needsOnboarding === false`, keep current behavior (redirect to `next` or default, allow setting `onboarding_completed_at` when not coming from onboarding). |
| **LoginPage** | Optional: keep `next=/overview`; callback will override redirect for new users to `/onboarding`. So no change required; callback drives the flow. |
| **App.tsx runAuthGate** | When profile has no `account_type`, set route to `onboarding` (already “accountType” today; we’ll render the **new** unified onboarding component). |
| **App.tsx invite gate** | When `LINKARY_INVITE_ONLY` and `!accessAllowed`: show InviteRequiredView **unless** route is `onboarding`. When route is `onboarding`, render the new onboarding flow (which includes invite as step 1 when invite-only and no `inviter_id`). So: allow rendering onboarding route even when `accessAllowed === false`. |
| **New component: XFirstOnboarding (or replace AccountTypePage)** | Single flow: (1) **Invite** (if invite-only and profile has no `inviter_id`); (2) **Role**: Individual or Org; (3) **Profession(s)** multi-select. On finish: redeem if needed (step 1), save `account_type`, save `profile_professions`, set `onboarding_completed_at`, redirect to profile. |
| **Profession** | Persist via existing `setProfileProfessions`; keep editable in advanced profile (Roles & Skills). No schema change. |

---

## 5. Files to touch (exact)

| File | Purpose |
|------|--------|
| `apps/web/src/app/api/auth/post-login-bootstrap/route.ts` | Return `needsOnboarding` from profile. |
| `apps/web/src/app/auth/callback/page.tsx` | Use `needsOnboarding` to redirect new users to `/onboarding` and avoid setting `onboarding_completed_at` for them. |
| `apps/web/src/figma/app/App.tsx` | Invite gate: do not show InviteRequiredView when route is `onboarding`; render onboarding so step 1 can be invite. Optionally ensure route name `onboarding` for new users. |
| New: `apps/web/src/figma/app/components/XFirstOnboarding.tsx` (or rename/extend AccountTypePage) | Unified steps: invite (conditional) → role → profession; call set-account-type, setProfileProfessions, set onboarding_completed_at. |
| `apps/web/src/figma/app/App.tsx` | Render new onboarding component for route `onboarding` / `accountType`. |
| `apps/web/src/app/api/onboarding/set-account-type/route.ts` | No change; already saves `account_type`. |
| `apps/web/src/lib/profileProfessions.ts` | No change; already used for profession sync. |

---

## 6. Regression and edge-case risks

- **Existing user with linked X**: Bootstrap returns `needsOnboarding: false`; callback redirects to app; no onboarding. Low risk.
- **New user, invite-only, valid code**: Lands on onboarding; step 1 invite; after redeem, step 2/3; then profile. Medium (ensure redeem and accessAllowed/refreshMe are consistent).
- **New user, invite-only, invalid code**: Stuck on step 1 until valid code; InviteRequiredView no longer full-screen for onboarding route, so must show error in onboarding step 1. Low.
- **New user, invite-only off**: Step 1 skipped; only role + profession. Low.
- **Profession save**: Use existing `setProfileProfessions`; ensure step 3 submits before setting `onboarding_completed_at`. Low.
- **Professions editable later**: No change to Roles & Skills page; already uses same API. None.
- **Duplicate account**: Supabase + link/finish already prevent same X on two accounts. None.
- **Admin bypass**: Still in `/api/me/access`; unchanged. None.
- **Analytics / ensure-backfill**: Still run after login; no change to order. Low.
- **Session/cookie**: No change. None.

---

## 7. What we do not change

- Auth provider (Supabase); OAuth flow; session/cookie.
- Invite-only env and redeem RPC; canonical invite code handling.
- Profile creation (ensureProfileForSession, bootstrap); X mirroring (social_accounts, profiles).
- Org, wallet, analytics, invite wallet, or other app routes.
- Broad refactor of auth or profile beyond the above.

This audit is the insertion-point and safety reference for implementation.
