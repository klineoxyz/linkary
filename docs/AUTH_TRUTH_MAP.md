# Linkary Auth Truth Map

**Single source of login:** X (Supabase OAuth, provider `x` or `twitter`). CDP is **not** an auth identity; it is used only for wallet creation **after** the user is logged in.

---

## 1. Source of truth for user identity

| What | Truth |
|------|--------|
| **Who is the user?** | Supabase Auth: `auth.uid()` from a session created by **X OAuth only**. |
| **Where is it stored?** | `auth.users` (Supabase). Our app uses `auth.uid()` as the primary key for profiles and social_accounts. |
| **How does the user log in?** | **Only** via Supabase OAuth with provider X (Twitter): `signInWithOAuth({ provider: 'x' })` → redirect to X → callback with code → `exchangeCodeForSession(code)`. |

**Deprecated / removed for MVP:**  
- **CDP as login:** Previously, "Sign in with Coinbase" created a **second** Supabase user (magic-link flow with wallet address). That produced a different `auth.uid()` from the X login, so the same person had two users (e.g. one with X, one with CDP wallet). **CDP must not create or sign in a Supabase user.** CDP runs only after a session exists, to create/attach the embedded wallet for the **current** `auth.uid()`.

---

## 2. Table that stores X connection

| What | Truth |
|------|--------|
| **X connection** | `public.social_accounts`: one row per user per provider. For X we use `provider IN ('x','twitter')` (canonical write: `twitter`). |
| **Columns** | `user_id` (= auth.uid()), `provider`, `provider_user_id`, `username`, `status`, `revoked_at`, `connected_at`, etc. |
| **Active row** | `user_id = auth.uid()` AND `provider IN ('x','twitter')` AND `status = 'connected'` AND `revoked_at IS NULL`. |
| **Who creates/updates it?** | Auth callback and **post-login bootstrap** (and link/finish, claim). Never rely on identities alone; DB row is the source of truth for "Connected". |

---

## 3. What creates the profile?

| What | Truth |
|------|--------|
| **Profile row** | `public.profiles`: `id` = `auth.uid()` (one row per user). |
| **When is it created?** | On first login: `ensureProfileForSession(auth.uid())` (or equivalent) in auth callback / post-login bootstrap. |
| **Onboarding** | When `profiles.onboarding_completed_at` is NULL, user is sent to onboarding: **claim username** → **choose account type** (Individual / Company) → optional org creation. |

---

## 4. What creates the wallet?

| What | Truth |
|------|--------|
| **CDP embedded wallet** | Stored on **the same user** as the profile: `profiles.cdp_wallet_address`, `profiles.cdp_wallet_chain`, `profiles.cdp_wallet_type`, `profiles.cdp_wallet_created_at`. |
| **When is it created?** | **After** Supabase session exists. Client calls `POST /api/wallet/cdp/ensure` (Bearer token) → server resolves `auth.uid()` → CDP create/get wallet → upsert profile columns. No auth.uid() is created by CDP. |
| **Wallet address vs email** | Wallet address must **never** be stored in `profiles.email` or displayed as "email". It lives only in `profiles.cdp_wallet_address`. Display label: "Wallet (CDP) 0x…". |

---

## 5. What drives analytics?

| What | Truth |
|------|--------|
| **Handle for twitterapi.io** | Resolved in order: `social_accounts.username` (active row for auth.uid()) → `profiles.twitter_username` → `profiles.twitter_username_candidate`. |
| **Who is tracked?** | Users with an active `social_accounts` row (provider x/twitter, connected, not revoked). |
| **When does backfill run?** | On login (ensure-backfill) and daily cron; no manual "Connect X" required once the user has logged in with X (row exists). |

---

## 6. Current flows and where a second auth user was created

| Flow | Status | Note |
|------|--------|------|
| **Login with X (OAuth)** | ✅ Single source of login | Creates one auth user; callback creates profile + social_accounts. |
| **Login with CDP (Coinbase AuthButton + bridge)** | ❌ Deprecated for MVP | Created a **second** auth user via magic-link; different auth.uid() → duplicate profiles, X on "other" user. |
| **Integrations "Connect X"** | ✅ Link only | Uses `linkIdentity`; link/finish writes social_accounts for current auth.uid(). |
| **Claim** | ✅ Repair | Moves X connection from another user_id to current auth.uid() when identities match. |

---

## 7. Target flow (X-only login)

1. User visits app → not logged in → **Login** page shows **only** "Sign in with X".
2. User clicks → `signInWithOAuth({ provider: 'x' })` → redirect to X → user authorizes → callback with `code`.
3. Callback: `exchangeCodeForSession(code)` → one auth user; then **post-login bootstrap** (ensure profile, upsert social_accounts + profile mirror from X identity).
4. If `profiles.onboarding_completed_at` is NULL → redirect to **onboarding**: claim username → Individual/Company → optional org.
5. After onboarding (or if already completed): user can open **Wallet** → `POST /api/wallet/cdp/ensure` → CDP wallet created/attached for **this** auth.uid(); displayed as "Wallet (CDP) 0x…".
6. Integrations shows Connected (from social_accounts); analytics uses handle from social_accounts/profile; no second user.

This document is the single reference for "who is the user", "where is X stored", "what creates profile", "what creates wallet", and "what drives analytics".
