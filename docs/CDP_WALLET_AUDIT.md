# CDP Embedded Wallet — Implementation Reality Report & Upgrade Plan

**Date:** 2025  
**Scope:** Current CDP integration vs CDP-recommended Custom Authentication (JWT) and Auth Method Linking.  
**Constraint:** Supabase X OAuth remains the only login identity; no new auth providers.

---

## 1. SDK usage map

### 1.1 Package and version

| Package | Version | Location |
|--------|---------|----------|
| `@coinbase/cdp-core` | ^0.0.85 | `apps/web/package.json` (dependency of cdp-hooks / cdp-react) |
| `@coinbase/cdp-hooks` | ^0.0.85 | `apps/web/package.json` |
| `@coinbase/cdp-react` | ^0.0.85 | `apps/web/package.json` |

No server-side CDP API client is used; all CDP usage is client-side via these packages.

### 1.2 Where CDP is initialized

| File | What |
|------|------|
| `apps/web/src/app/AppWithProviders.tsx` | `CDPReactProvider` with `config.projectId`, `ethereum.createOnLogin: "eoa"`, `appName: "Linkary"`, **`authMethods: ["oauth:x"]`** |
| `apps/web/src/figma/main.tsx` | Same `CDPReactProvider` (used when app is run from figma entry); `authMethods: ['oauth:x']` |

So CDP is configured with **CDP-managed OAuth (X)** as the only auth method. There is no `customAuth` or `getJwt`; we are **not** using Custom Authentication (JWT).

### 1.3 Where CDP SDK is used in code

| File | Usage |
|------|--------|
| `apps/web/src/components/wallet/WalletShell.tsx` | `require("@coinbase/cdp-hooks")` → `useEvmAddress()` to read `evmAddress` (CDP session). Used to show “Create wallet” / “Link wallet” and to POST address to backend. |
| `apps/web/src/components/wallet/panels/SendTxPanel.tsx` | `require("@coinbase/cdp-hooks")` → `useSendEvmTransaction`, `useEvmAddress` for sending EVM txs. |

No other files use CDP hooks or components. We do **not** use: `useLinkOAuth`, `LinkAuth`, `useAuthenticateWithJWT`, `useCurrentUser`, or any custom-auth APIs.

---

## 2. How the wallet is created today

### 2.1 Flow (current)

1. User logs in with **Supabase X OAuth** only (no CDP as login).
2. User opens Wallet. `WalletShell` calls `GET /api/wallet/cdp/status` (Bearer = Supabase token). If no wallet in DB, UI shows “Create wallet”.
3. CDP session: `CDPReactProvider` is configured with `authMethods: ["oauth:x"]`, so the **client** can have a CDP session if the user has signed in with X **via CDP’s own OAuth** (separate from Supabase). So there are effectively two “X” flows: Supabase X (our login) and CDP oauth:x (CDP’s session).
4. When the user clicks “Link wallet”, `WalletShell` reads `evmAddress` from `useEvmAddress()` (CDP hooks) and POSTs it to **`/api/wallet/cdp/get-or-create`** with body `{ address }`. Backend does **not** talk to CDP; it only:
   - Verifies Bearer (Supabase session), gets `auth.uid()`
   - Validates address format
   - Writes to `profiles.cdp_wallet_*` and `cdp_wallets` (upsert by `user_id`)

So: **wallet creation is “client creates wallet in CDP (via CDP oauth:x session) → client sends address to our API → we persist by auth.uid()”.** The identifier that keys the wallet in our DB is **auth.uid()** (Supabase). The identifier that keys the wallet in CDP is **whatever CDP uses for oauth:x** (CDP user id from X), which is **not** tied to auth.uid() unless we switch to custom JWT with `sub = auth.uid()`.

### 2.2 Does it rely on CDP auth/session?

- **Backend:** No. `/api/wallet/cdp/get-or-create` and `/api/wallet/cdp/ensure` only need a valid Supabase Bearer token; they never call CDP.
- **Frontend:** Yes. We need `useEvmAddress()` to return an address so the user can “Link wallet”. That address comes from the **CDP** session (oauth:x). So today the user must have (or create) a CDP session via CDP’s oauth:x flow to get an address to send to our API.

### 2.3 Custom auth JWT vs client SDK flow

- We do **not** use CDP Custom Authentication (JWT). There is no `customAuth.getJwt`, no JWKS, no `authenticateWithJWT()`.
- We use a **client SDK flow**: CDP React/Hooks with `authMethods: ["oauth:x"]`. Wallet identity in CDP is whatever oauth:x gives; our backend then associates the **address** with `auth.uid()` when the client POSTs it.

### 2.4 Identifier summary

| System | Identifier used |
|--------|------------------|
| Our app (Supabase) | `auth.uid()` |
| Our DB (profiles, cdp_wallets) | `user_id = auth.uid()` |
| CDP (today) | CDP’s own user id from oauth:x (not bound to auth.uid()) |

So we have **two identities**: Supabase user (auth.uid()) and CDP user (oauth:x). They are only linked by “same person pastes address into our app after signing into CDP with X”.

---

## 3. Environment variables (CDP-related)

| Variable | Where used | Purpose |
|----------|------------|---------|
| `NEXT_PUBLIC_CDP_APP_ID` | `apps/web/src/app/layout.tsx`, `CdpAppIdProvider`; `figma/main.tsx`; `AppWithProviders.tsx` (via `useCdpAppId`) | CDP Project ID for `CDPReactProvider` config |
| (None other in app code) | — | No server-side CDP API key or JWKS URL in repo |

Docs (`docs/COINBASE_LOGIN.md`) also mention Supabase Edge Function `auth-cdp-login` and `SUPABASE_SERVICE_ROLE_KEY` for that flow; that path is deprecated if we use X-only login.

---

## 4. Endpoints — confirmed list

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/wallet/cdp/ensure` | GET, POST | Re-exports `../get-or-create/route` (same implementation). GET: return wallet or `needsCreate`. POST: persist client-provided address. |
| `/api/wallet/cdp/get-or-create` | GET, POST | **Actual implementation.** GET: read profile + optional cdp_wallets sync; return address or `needsCreate`. POST: validate address, write profiles + cdp_wallets, optional wallet_handles. |
| `/api/wallet/cdp/recovery/x/start` | POST | Bearer required. Creates row in `cdp_recovery_enrollment_state`, returns `{ recoveryUrl, state }` with `recoveryUrl = /settings/wallet?recovery=x&state=...`. |
| `/api/wallet/cdp/recovery/x/callback` | GET, POST | Reads `state` and `provider_user_id` from query or body. Resolves user from state table; cross-checks `provider_user_id` with `social_accounts`; on match updates `cdp_wallets` recovery fields and redirects to `/settings/wallet?recovery=enabled`. |
| `/api/wallet/cdp/status` | GET | Bearer required. Returns wallet address (profile + cdp_wallets), chain, recovery_verified_at, recovery methods, twitter_username. |
| `/api/wallet/cdp/export` | (used by ExportKeysPanel) | Export keys flow (not audited in detail). |
| `/api/wallet/cdp/send-test` | (exists) | Send test tx (not audited in detail). |

**Redundancy:** `ensure` and `get-or-create` are the same; only the route file differs. The UI currently calls **get-or-create** (WalletShell), not ensure.

---

## 5. Recovery flow — where does `provider_user_id` come from?

### 5.1 Current implementation

- **Start:** `POST /api/wallet/cdp/recovery/x/start` creates state, returns `recoveryUrl = ${baseUrl}/settings/wallet?recovery=x&state=${stateToken}`. So the “recovery URL” is **our** wallet page with a query param, not a CDP URL.
- **Callback:** `GET/POST /api/wallet/cdp/recovery/x/callback` reads:
  - `state` from query or body
  - `provider_user_id` (or `providerUserId`) from **query or body only**

There is **no** integration with CDP’s redirect. CDP’s X OAuth callback (per docs) is:

`https://api.cdp.coinbase.com/platform/v2/end-users/auth/oauth/x/callback`

So CDP does **not** redirect to our callback. Our callback is never invoked by CDP. Any `provider_user_id` we see today would be from manual testing (query/body) or a future integration we haven’t built.

### 5.2 Redirect URL configured in code

- The only redirect URL we set in code is **our** `recoveryUrl`: `/settings/wallet?recovery=x&state=...` (same-origin).
- No code sets a CDP callback URL or a “redirect after CDP” URL. CDP’s callback URL is configured in the CDP Portal / X Developer Portal and points at CDP’s host, not ours.

### 5.3 Conclusion

- Recovery is **simulated**: we have state and cross-check logic, but **provider_user_id is only from request query/body**, not from a real CDP redirect.
- We are **not** doing CDP Auth Method Linking in the way CDP documents it (client-side `useLinkOAuth("x")` / `LinkAuth` with CDP handling the OAuth redirect).

---

## 6. Gaps vs CDP Custom Authentication

### 6.1 Are we using CDP Custom Authentication (JWT)?

**No.** We use `authMethods: ["oauth:x"]` (CDP-managed OAuth). There is no `customAuth`, no JWT, no JWKS.

### 6.2 What’s missing for Custom Auth

| Requirement | Status | Notes |
|-------------|--------|--------|
| JWKS endpoint | Missing | Need a public URL (e.g. `GET /.well-known/jwks.json` or `/api/auth/jwks`) that returns RS256/ES256 public keys. |
| JWT minting | Missing | Need a way to mint JWTs with `iss`, `sub`, `exp`, `iat` (and optional `aud`). `sub` should be stable and unique — e.g. `auth.uid()`. |
| CDP Portal config | Not done | In CDP Portal: enable Custom Authentication, set JWKS URL, set Issuer (and optional Audience). Optionally set “User Identifier Claim” (default `sub`). |
| SDK config | Not done | Replace `authMethods: ["oauth:x"]` with `customAuth: { getJwt: async () => supabaseSession?.access_token or app-mint JWT }`. Note: Supabase JWT may be usable if it has `sub` = auth.uid() and correct `iss`/`aud`/`exp`/`iat`; otherwise we mint our own. |
| Trigger auth with CDP | Not done | After Supabase login, call `authenticateWithJWT()` so CDP creates/gets wallet keyed by `sub` (auth.uid()). |

### 6.3 Auth Method Linking — are we doing it properly?

**No.** We do not use:

- `useLinkOAuth("x")` or `LinkAuth` from CDP
- Any CDP redirect back to our app after linking

So we are **not** using CDP’s Auth Method Linking. Our “Secure wallet with X” flow only redirects to our own page and expects a callback that CDP never calls.

### 6.4 What CDP would send if we used their linking

- When using **CDP’s** OAuth (or link) flow, the **redirect goes to CDP** (`https://api.cdp.coinbase.com/.../callback`), not to our server.
- So we do **not** receive `provider_user_id` (or a code) on our callback from CDP. Linking is completed inside CDP; we’d learn about success via:
  - Client: `useLinkOAuth("x")` then `onLinkSuccess` (or similar) in the SDK, or
  - Some CDP API that returns linked methods / user identity (if available).

We would need to either:

- Use the client SDK (`useLinkOAuth("x")`) and on success call our backend to set `recovery_verified_at` (and optionally pass a handle for display), or
- If CDP ever supports a server redirect or webhook with `provider_user_id`, adapt our callback to that payload. Today no such redirect to our callback is documented or implemented.

---

## 7. Current flow diagram (simplified)

```
[User] --> Supabase X OAuth --> [Supabase Session] (auth.uid())
                                      |
[User] --> (optional) CDP oauth:x --> [CDP Session] --> useEvmAddress() --> evmAddress
                                      |                        |
                                      |                        v
                                      |              [WalletShell] POST { address }
                                      |                        |
                                      v                        v
                              [GET /api/wallet/cdp/status]   [POST /api/wallet/cdp/get-or-create]
                                      |                        |
                                      |                        v
                                      |              [Backend: profiles + cdp_wallets by auth.uid()]
                                      v
                              [Backend: profile + cdp_wallets by auth.uid()]
```

Recovery (current):

```
[User] clicks "Secure wallet with X"
  --> POST /api/wallet/cdp/recovery/x/start
  --> redirect to /settings/wallet?recovery=x&state=...
  --> (no CDP redirect in practice)
  --> Our callback is only hit if someone manually calls it with ?state=...&provider_user_id=...
```

---

## 8. Recommended minimal-change upgrade plan

### 8.1 Principles

- Keep `/api/wallet/cdp/ensure` as the **single** stable entry for the UI (GET/POST). Implement it by delegating to shared logic (or inlining get-or-create) so we can later swap to custom-auth without changing the URL.
- Introduce Custom Auth behind that same route: after upgrade, “ensure” still means “ensure wallet for auth.uid()”; under the hood we use JWT with `sub = auth.uid()` so CDP’s wallet is keyed by our identity.
- Do not add new login providers; keep Supabase X OAuth as the only login.

### 8.2 Step-by-step

1. **Single entry for wallet provisioning**
   - Treat **`/api/wallet/cdp/ensure`** as the only public endpoint for “get or create wallet” (GET/POST).
   - Move implementation from `get-or-create` into a shared module or into `ensure`, and have `ensure` own the logic. Deprecate or remove **`/api/wallet/cdp/get-or-create`** and point the UI (WalletShell) to **ensure** only.

2. **Add JWKS and JWT for Custom Auth**
   - Add route `GET /api/auth/jwks` (or `/.well-known/jwks.json`) that returns the app’s public keys (e.g. RS256) used to sign custom JWTs.
   - Add a small JWT utility: mint short-lived JWTs with `iss` (your app/domain), `sub` = `auth.uid()`, `exp`, `iat` (and `aud` if required by CDP). Use a key pair (private key in env or secret manager; public key in JWKS).

3. **Configure CDP Portal**
   - Enable Custom Authentication; set JWKS URL and Issuer (and Audience if needed). Leave user identifier as `sub` (auth.uid()).

4. **Switch SDK to Custom Auth**
   - In `AppWithProviders.tsx` (and figma `main.tsx`): remove `authMethods: ["oauth:x"]`, add `customAuth: { getJwt: async () => { ... get Supabase session; return Supabase access_token or app-mint JWT with sub = auth.uid() } }`.
   - After Supabase login (and when wallet page loads), call `authenticateWithJWT()` so CDP creates/retrieves wallet keyed by `sub` = auth.uid().

5. **Recovery: use CDP Auth Method Linking**
   - In the wallet UI, replace “Secure wallet with X” redirect to our start URL with CDP’s **`useLinkOAuth("x")`** (or `LinkAuth` with X). User signs in with X inside CDP’s flow; no redirect to our callback.
   - On success (e.g. `onLinkSuccess` or equivalent), call our backend to set `recovery_verified_at` (and optionally store display handle). Optionally keep a lightweight **`/api/wallet/cdp/recovery/x/callback`** only if we later get a redirect or webhook from CDP with identity; otherwise remove or simplify to “client reports success, backend sets recovery_verified_at”.

6. **Remove or consolidate redundant pieces**
   - Remove or redirect **`/api/wallet/cdp/get-or-create`** once ensure is the single entry and UI is updated.
   - Simplify **recovery/x/start** if we no longer need server state for a CDP redirect (e.g. only need “client completed link, backend set recovery”).
   - Keep **recovery/x/callback** only if we introduce a real CDP or IdP redirect that hits it; otherwise delete or reduce to a no-op redirect.

---

## 9. Files to change / delete / merge

### 9.1 Single entry (ensure vs get-or-create)

| Action | File / area |
|--------|-------------|
| Keep | `apps/web/src/app/api/wallet/cdp/ensure/route.ts` — **single** GET/POST entry for wallet. |
| Change | Move full logic from `get-or-create/route.ts` into `ensure` (or into a shared `lib` used by ensure). |
| Change | `WalletShell.tsx`: replace `fetch(…/api/wallet/cdp/get-or-create`, …)` with `fetch(…/api/wallet/cdp/ensure`, …)`. |
| Delete or deprecate | `apps/web/src/app/api/wallet/cdp/get-or-create/route.ts` after ensure owns the behavior. |

### 9.2 Custom Auth (new)

| Action | File / area |
|--------|-------------|
| Add | `apps/web/src/app/api/auth/jwks/route.ts` (or similar) — return JWKS. |
| Add | Shared JWT helper (e.g. `apps/web/src/lib/cdp-jwt.ts`) — mint JWT with `sub = auth.uid()`, `iss`, `exp`, `iat`. |
| Change | `AppWithProviders.tsx` — use `customAuth.getJwt` and remove `authMethods: ["oauth:x"]` when custom auth is enabled. |
| Change | `figma/main.tsx` — same config as above. |
| Change | After Supabase session is ready (e.g. in WalletShell or app bootstrap), call CDP `authenticateWithJWT()` so wallet is keyed by sub. |

### 9.3 Recovery

| Action | File / area |
|--------|-------------|
| Change | `LinkProfilePanel.tsx` — “Secure wallet with X” should use CDP `useLinkOAuth("x")` (or `LinkAuth`) instead of redirecting to our start URL. On success, call backend to set recovery (e.g. POST to a small “recovery-linked” endpoint). |
| Simplify or remove | `apps/web/src/app/api/wallet/cdp/recovery/x/start/route.ts` — remove if we no longer need server state for redirect; or keep minimal (e.g. return a flag for client). |
| Adapt or remove | `apps/web/src/app/api/wallet/cdp/recovery/x/callback/route.ts` — keep only if we get a real CDP/IdP redirect with identity; otherwise remove or redirect to wallet page. |

### 9.4 Safe to leave as-is (no breaking change)

- `apps/web/src/app/api/wallet/cdp/status/route.ts` — keep; continue returning wallet + recovery state.
- `profiles.cdp_wallet_*` and `cdp_wallets` — keep; ensure still writes them.
- All Supabase X OAuth and post-login-bootstrap flows — unchanged.

### 9.5 Summary table

| File | Action |
|------|--------|
| `api/wallet/cdp/ensure/route.ts` | Keep as single entry; own get-or-create logic (or shared lib). |
| `api/wallet/cdp/get-or-create/route.ts` | Remove after ensure is canonical and UI updated. |
| `api/wallet/cdp/status/route.ts` | No change. |
| `api/wallet/cdp/recovery/x/start/route.ts` | Simplify or remove once linking is client-driven. |
| `api/wallet/cdp/recovery/x/callback/route.ts` | Keep only if we have a real redirect; else remove or simplify. |
| `AppWithProviders.tsx`, `figma/main.tsx` | Switch to customAuth + getJwt; add authenticateWithJWT after login. |
| `WalletShell.tsx` | Call ensure instead of get-or-create; ensure authenticateWithJWT when session exists. |
| `LinkProfilePanel.tsx` | Use useLinkOAuth("x") for “Secure with X”; on success call backend to set recovery. |
| (New) `api/auth/jwks/route.ts` | Add JWKS endpoint. |
| (New) `lib/cdp-jwt.ts` (or similar) | Add JWT minting with sub = auth.uid(). |

---

## 10. Deliverable B — Concrete list of files to change / delete / merge

### Files to change

| File | What to do |
|------|------------|
| `apps/web/src/app/api/wallet/cdp/ensure/route.ts` | Inline or import get-or-create logic here; stop re-exporting from get-or-create so ensure is the single implementation. |
| `apps/web/src/components/wallet/WalletShell.tsx` | Call `/api/wallet/cdp/ensure` instead of `/api/wallet/cdp/get-or-create` for GET and POST. After custom auth: call `authenticateWithJWT()` when session exists. |
| `apps/web/src/app/AppWithProviders.tsx` | For custom auth: set `customAuth: { getJwt }` and remove `authMethods: ["oauth:x"]`; ensure getJwt returns JWT with sub = auth.uid(). |
| `apps/web/src/figma/main.tsx` | Same CDP config as AppWithProviders when on custom auth. |
| `apps/web/src/components/wallet/panels/LinkProfilePanel.tsx` | Replace "Secure wallet with X" redirect with CDP `useLinkOAuth("x")`; on success call backend to set recovery_verified_at. |

### Files safe to delete or merge

| File | Recommendation |
|------|----------------|
| `apps/web/src/app/api/wallet/cdp/get-or-create/route.ts` | **Delete** after ensure owns the logic and WalletShell calls ensure. This removes the redundant route. |

### Files to add

| File | Purpose |
|------|---------|
| `apps/web/src/app/api/auth/jwks/route.ts` | GET endpoint returning JWKS for CDP custom auth. |
| `apps/web/src/lib/cdp-jwt.ts` (or under `lib/auth/`) | Mint JWT with iss, sub = auth.uid(), exp, iat for CDP. |

### Recovery routes — optional delete/simplify

| File | Recommendation |
|------|----------------|
| `apps/web/src/app/api/wallet/cdp/recovery/x/start/route.ts` | **Simplify or remove** once linking is done via useLinkOAuth("x") and we no longer need server state for a redirect. |
| `apps/web/src/app/api/wallet/cdp/recovery/x/callback/route.ts` | **Keep only if** we later have a real CDP or IdP redirect to our app with identity. Today CDP does not redirect here; **can remove** or replace with a simple “client reported success” endpoint. |

### Final single entry (recommended)

- **Wallet provisioning:** One route only — **`/api/wallet/cdp/ensure`** (GET and POST). All UI and future server-side callers should use this. Remove get-or-create.

---

## 11. Constraints respected

- No changes to working Supabase X OAuth or post-login-bootstrap flows in this audit.
- No new auth providers; X remains the only login.
- `/api/wallet/cdp/ensure` remains the stable API surface for the UI; implementation can be upgraded behind it to Custom Auth and optional consolidation of get-or-create.
