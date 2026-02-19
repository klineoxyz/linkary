# Coinbase CDP Embedded Wallet Login (Linkary)

Linkary uses **Coinbase Developer Platform (CDP) Embedded Wallets** for sign-in. After the user signs in with their Coinbase wallet and proves ownership by signing a message, the app establishes a **Supabase session** so the rest of the app (profiles, orgs, jobs, messages, RLS) works unchanged.

## Flow

1. User clicks **Continue with Coinbase** and completes CDP embedded wallet auth (e.g. email OTP or social).
2. App gets the primary EVM address and asks the user to **Continue to Linkary** (signs a one-time message).
3. Client sends `address`, `message`, and `signature` to the Supabase Edge Function `auth-cdp-login`.
4. Edge Function verifies the signature (EIP-191), finds or creates an auth user and `wallet_identities` row, then returns a magic-link token.
5. Client exchanges the token with `supabase.auth.verifyOtp({ token_hash, type: 'magiclink' })`, then calls `ensureProfileForSession`, upserts `public.wallets`, and routes to onboarding or explore.

## Environment variables

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_CDP_APP_ID` | Yes (for Coinbase login) | CDP Project ID from [CDP Portal](https://portal.cdp.coinbase.com/). Used by `@coinbase/cdp-react` / `@coinbase/cdp-hooks`. |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Supabase project URL (used for Edge Function URL). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon key (client). |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes (Edge Function) | Set automatically for Supabase Edge Functions; used by `auth-cdp-login` to create users and read/write `wallet_identities`. |

## Local setup

1. **CDP Portal**
   - Create a project at [CDP Portal](https://portal.cdp.coinbase.com/).
   - Copy the **Project ID** into `NEXT_PUBLIC_CDP_APP_ID` in `.env.local`.
   - Under **Embedded Wallets → Domains**, add `http://localhost:3000` (and your production domain when you deploy).

2. **Supabase**
   - Ensure `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are in `.env.local`.
   - Run migrations so `wallet_identities` exists:  
     `pnpm db:push` or apply `supabase/migrations/20260218200000_wallet_identities.sql`.

3. **Edge Function**
   - Deploy the function:  
     `supabase functions deploy auth-cdp-login`
   - For local dev:  
     `supabase functions serve auth-cdp-login`  
     and point the client at your local functions URL if needed (e.g. override in app or use Supabase local URL).

4. **App**
   - From repo root: `cd apps/web && pnpm install && pnpm dev`.
   - Open the login route; you should see **Continue with Coinbase**. After CDP sign-in and the bridge step, you get a Supabase session and are redirected to onboarding or explore.

## Production (Vercel)

- In **Vercel** → Project → **Settings** → **Environment Variables**, add:
  - `NEXT_PUBLIC_CDP_APP_ID` = your CDP Project ID (same as local).
- The app reads this at **request time** from the server, so the Coinbase login option will show on https://www.linkary.xyz/login as soon as the variable is set (redeploy once if you add it after the first deploy).
- **Required:** Under **CDP Portal → Embedded Wallets → Domains**, add your production domain exactly as the browser origin, e.g. `https://www.linkary.xyz` (see [CORS / Domain allowlist](#cors--domain-allowlist) below).

## CORS / Domain allowlist

If you see in the browser console:

```text
Access to XMLHttpRequest at 'https://api.cdp.coinbase.com/...' from origin 'https://www.linkary.xyz' has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is present
```

the CDP API is rejecting your origin because it is not allowlisted.

**Fix:**

1. Go to [CDP Portal](https://portal.cdp.coinbase.com/) → select your project.
2. Open **Embedded Wallets** → **Domains** (or **Products → Embedded Wallets → Domains**).
3. Click **Add domain** and enter the **exact** origin your app uses:
   - Production: `https://www.linkary.xyz` (with `https://`, no trailing slash, no path).
   - If you also use the apex: `https://linkary.xyz`.
4. Save. Changes take effect immediately; no redeploy needed.

Format rules: use `https://domain` or `http://localhost:3000`; no path or query. If your site is served from `https://www.linkary.xyz`, that is the value to add.

## Security

- **Signature verification**: The Edge Function verifies EIP-191 `personal_sign` so only the owner of the wallet can get a session for that address.
- **No login without proof**: You cannot get a session for an address without a valid signature for the challenge message.
- **wallet_identities**: Maps `address` → `auth.users.id`; only the Edge Function (service role) writes to it. RLS blocks direct client access.

## Tables

- **wallet_identities**: `(id, user_id, address, created_at)`. Unique on `address`. Used by `auth-cdp-login` to find or create the Supabase user.
- **wallets**: After login, the client upserts `public.wallets` with `user_id`, `chain = 'evm'`, `address`, `is_primary = true` (existing RLS and usage unchanged).

## Optional: standalone figma build

If you run the figma app via a different entry (e.g. `figma/main.tsx`), wrap the root with `CDPReactProvider` there too, using the same `projectId` from env (e.g. `NEXT_PUBLIC_CDP_APP_ID` or your build’s public env name).
