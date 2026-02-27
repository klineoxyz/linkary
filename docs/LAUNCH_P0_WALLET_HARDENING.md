# Launch P0: Wallet Hardening (CDP 401 crash fix)

## Problem

`POST https://api.cdp.coinbase.com/platform/v2/embedded-wallet-api/projects/<id>/auth/refresh` could return **401 Unauthorized**, causing a client-side exception and breaking linkary.xyz (e.g. homepage, public profiles).

## Solution

1. **No wallet init on public routes**  
   CDP (Coinbase embedded wallet) is **not** mounted when the user has no Supabase session. So:
   - Incognito / logged-out visits to `https://linkary.xyz` and `https://linkary.xyz/<username>` never run CDP auth/refresh → no 401 from wallet.

2. **Session-gated CDP**  
   - `CdpProviderGate` (used by `AppWithProviders`) only wraps the app with `CDPReactProvider` when `cdpAppId` is set **and** the user has a Supabase session.
   - Wallet features still work for signed-in users; CDP loads after session is confirmed.

3. **401 handling**  
   - **Sync errors:** `CdpErrorBoundary` catches render errors that look like 401/auth (e.g. message contains "401", "Unauthorized", "auth/refresh"). It clears CDP-related `localStorage` and shows: *"Wallet session expired. Reconnect."* with a link to `/settings/wallet`.
   - **Async 401:** `CdpProviderGate` listens for `unhandledrejection`; if the reason looks like a CDP 401, it clears persisted CDP state and logs a short warning so the next load doesn’t retry with a bad token.

4. **No throw to user**  
   - Request creation and normal app flow never throw due to wallet refresh; at worst the wallet area shows the reconnect UI.

## Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/CdpErrorBoundary.tsx` | New: error boundary + `clearCdpPersistedState()` |
| `apps/web/src/app/CdpProviderGate.tsx` | New: session check, mount CDP only when session exists, unhandledrejection for async 401 |
| `apps/web/src/app/AppWithProviders.tsx` | Use `CdpProviderGate` instead of mounting `CDPReactProvider` directly |

## CDP config (production)

- **Env:** `NEXT_PUBLIC_CDP_APP_ID` = CDP Project ID (client-safe).
- **CDP Portal → Embedded Wallets → Domains:** allowlist must include the exact origin:
  - `https://linkary.xyz`
  - `https://www.linkary.xyz` (if you use www)
- No other wallet keys are required in the client; keep service keys server-only.

## QA

- Incognito: load `https://linkary.xyz` and `https://linkary.xyz/<public-profile>` → no crash.
- Signed-in user: wallet features (e.g. Settings → Wallet) work; CDP loads after session.
- Force 401 (e.g. clear cookies / invalid token): wallet area shows “Wallet session expired. Reconnect.” instead of app crash.
