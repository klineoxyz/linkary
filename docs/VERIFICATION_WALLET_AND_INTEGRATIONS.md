# Verification: Wallet recovery methods & Integrations X connected

Use this to confirm the fixes for (1) Wallet "Link a profile" showing Email/X from CDP/profile, and (2) Integrations showing "Connected" + handle when X is linked.

## 1. Confirm code is present

Open these files and check they contain the following:

| File | Must contain |
|------|----------------|
| `apps/web/src/components/wallet/panels/LinkProfilePanel.tsx` | `const { data: { session } } = await supabase.auth.getSession();` and `Promise.all([ fetch(...cdp/status), supabase.from("profiles")... ])` |
| `apps/web/src/app/api/wallet/cdp/status/route.ts` | `profile_email_masked` and `twitter_username` in the `NextResponse.json({ ... })` body |
| `apps/web/src/figma/app/components/IntegrationsPage.tsx` | `for (let i = 0; i < 12; i++)` (token retry loop) and `tryApi` |

## 2. Enable Manual Linking in Supabase (Integrations “Connect X” persists after re-login)

So that “Connect X” **links** X to your current user (CDP/email) instead of signing in as a different user:

1. Supabase Dashboard → **Authentication** → **Providers** → **X (Twitter)**.
2. Enable **Manual linking** (or the project-level “Enable Manual Linking” in Auth settings).
3. Save.

Then when a logged-in user clicks “Connect X”, the app uses `linkIdentity()` so the X identity is attached to the same account. After log out and log back in (e.g. with CDP), Integrations will still show “Connected” and the handle.

## 3. Apply Supabase migration (Integrations fallback)

If not already applied, run in Supabase SQL Editor:

- File: `supabase/migrations/20260238000000_social_accounts_get_my_social_x.sql`

This allows the client to read X connection via RPC when the API isn’t used.

## 4. Clean run on localhost

1. Stop the dev server (Ctrl+C).
2. From repo root: `cd apps/web && pnpm run build` (or `npm run build`).
3. Start dev again: `pnpm run dev` (or `npm run dev`).
4. Hard refresh the browser: **Ctrl+Shift+R** (Windows/Linux) or **Cmd+Shift+R** (Mac).
5. Sign in again if needed, then open:
   - **Settings → Wallet** → "Link a profile"
   - **Settings → Integrations**

## 5. Check Network tab (DevTools)

- **Wallet**
  - Request: `GET /api/wallet/cdp/status` with `Authorization: Bearer ...`
  - Response (200): must include `recoveryMethods: { email: true/false, x: true/false }`, and when true, `profile_email_masked` and/or `twitter_username`.
  - If you see 401, the session token isn’t being sent; confirm you’re logged in and refresh.

- **Integrations**
  - Request: `GET /api/auth/social-x` with `Authorization: Bearer ...`
  - Response (200): when X is linked, expect `{ "connected": true, "username": "YourHandle", "provider_user_id": "..." }`.
  - If this request is missing or 401, the page didn’t get a token; after the code fix it retries up to ~6s.

## 6. Expected UI after fix

- **Wallet → Link a profile**
  - "Recovery methods" shows: **Wallet — CDP (0x…)** and, when set, **Email (m****@…)** and **X (@handle)**.
  - "Add X and email in Settings → Integrations" only appears when at least one of email/X is missing.

- **Integrations**
  - X card shows **Connected** and **@YourHandle** (and Sync / Disconnect) when X is linked in the DB.
  - It shows "Connect X" only when the API returns `connected: false` or after retries no token was available.

## 7. If it still fails

- Confirm you’re on **localhost:3000** (or your dev URL) and the built app is the one you just built.
- In DB: `social_accounts` has a row for your user with `provider = 'x'`, `status = 'connected'`, `revoked_at IS NULL`.
- In DB: `profiles` has your `email` and/or `twitter_username` / `twitter_username_candidate` for the same user.
