# Launch P0: Client error hardening (no white screen)

## Goal

- **linkary.xyz** and **/{username}** must never white-screen due to CDP (Coinbase embedded wallet) or any other client exception.
- CDP must **never** initialize on non-wallet routes, even if the user is logged in.
- Global error boundary + global error capture so we can see the real root cause in Vercel logs (and optionally Sentry later).

---

## Why session-gating was insufficient

We previously gated CDP by **Supabase session**: CDP mounted only when the user had a session. That still meant:

- **Any logged-in visit** (e.g. `/`, `/explore`, `/profile`, `/{username}`) could mount CDP, because those pages use `AppWithProviders` and the user has a session.
- CDP SDK runs **auth/refresh** on mount. If that request returns **401** (expired/invalid token), the SDK can throw and the app crashes with “Application error: a client-side exception…”.
- So **session-gating** reduced crashes for anonymous users but did **not** protect logged-in users on homepage or public routes. We needed to **never load CDP** on those routes at all.

---

## Route-gate rules (CDP only on wallet routes)

CDP is mounted **only** when **both**:

1. `NEXT_PUBLIC_CDP_APP_ID` is set, and  
2. **Pathname** is a wallet-required route.

**Wallet routes (CDP allowed):**

- `/settings/wallet`
- `/wallet`
- `/wallet/*` (any path under `/wallet`)

**Non-wallet routes (CDP never loads):**

- `/` (homepage)
- `/{username}` (public profile)
- `/u/[username]/insights`
- `/explore`
- `/profile/*` (including `/profile/inbox`, `/profile/requests`, etc.) unless it is wallet-specific
- All other app routes

**Implementation:** `CdpProviderGate.tsx` uses `usePathname()` (Next App Router). `shouldMountCdp = !!cdpAppId && isWalletRoute(pathname)`. No session check. So incognito and logged-in users on `/` or `/{username}` never trigger CDP or any request to `api.cdp.coinbase.com`.

---

## CDP error handling (wallet routes only)

Even on wallet routes, CDP errors must not crash the app:

- **CdpErrorBoundary** wraps content inside `CDPReactProvider`. Detection is broadened:
  - Handles `Error`, strings, and objects with `status` / `code`.
  - Matches: 401, Unauthorized, auth/refresh, “CDP”, “embedded-wallet”.
- **unhandledrejection** listener is registered in `CdpProviderGate` **before** CDP mounts (same component, effect runs first; when on a wallet route we then render `CDPReactProvider`).
- On CDP auth/refresh 401: clear CDP persisted state (localStorage), show “Wallet session expired. Reconnect.” on wallet pages, do not rethrow.

---

## Global app error boundary (prevent white screen)

**ClientErrorBoundary** wraps the entire app UI at the root layout (around `{children}`).

- If **any** error occurs in the React tree, we show a friendly fallback:
  - “Something went wrong”
  - “Reload” button
  - “Go home” link
  - Small debug code (timestamp + random id) for user reports
- **componentDidCatch** logs to console (including production):
  - `error.message`
  - `error.stack`
  - `window.location.pathname`
  - `navigator.userAgent` (truncated)
- No secrets are logged or exposed.

---

## Global window error capture (non-React errors)

**GlobalErrorCapture** is a client component mounted once in the root layout (next to the boundary).

- `window.addEventListener("error", ...)`
- `window.addEventListener("unhandledrejection", ...)`

Logs a **single-line** structured message so it shows clearly in Vercel browser logs:

```text
[CLIENT_ERROR] type=error|unhandledrejection path=... message=... stack=...
```

- `path` = `window.location.pathname` at event time.
- Helps reproduce and see the real crash cause (e.g. CDP 401, hydration, or other runtime errors).

---

## How to verify in the network panel

1. **Incognito**
   - Open DevTools → Network.
   - Visit `https://linkary.xyz/` and `https://linkary.xyz/{username}`.
   - **Verify:** No requests to `api.cdp.coinbase.com` at all (filter by “cdp” or “coinbase” if needed).

2. **Logged in**
   - Same: visit `/` and `/{username}`.
   - **Verify:** Still no requests to `api.cdp.coinbase.com`.

3. **Wallet route**
   - Log in, visit `/settings/wallet`.
   - **Verify:** CDP mounts; you may see requests to `api.cdp.coinbase.com`. If the token is bad and refresh returns 401, the app does **not** crash; you see “Wallet session expired. Reconnect.” on the wallet page.

4. **Global boundary**
   - Force a throw in a random component (e.g. `throw new Error("test")` in a button click).
   - **Verify:** No white screen; “Something went wrong” with Reload and Go home, and a debug code. Console shows `[CLIENT_ERROR_BOUNDARY]` and/or `[CLIENT_ERROR]` with path and message.

---

## Files changed

| File | Change |
|------|--------|
| `apps/web/src/app/CdpProviderGate.tsx` | Route-gate by pathname only; wallet routes list; unhandledrejection before CDP |
| `apps/web/src/app/CdpErrorBoundary.tsx` | Broader CDP error detection; log in production |
| `apps/web/src/app/ClientErrorBoundary.tsx` | **New:** global app error boundary (fallback UI + console log) |
| `apps/web/src/app/GlobalErrorCapture.tsx` | **New:** global `error` + `unhandledrejection` capture, single-line log |
| `apps/web/src/app/layout.tsx` | Wrap `{children}` with `ClientErrorBoundary`; mount `GlobalErrorCapture` |
| `apps/web/src/app/AppWithProviders.tsx` | Comment updated for route-gating |

---

## Step 0 — Reproducing and capturing the real thrown error

When debugging “Application error: a client-side exception…”:

1. Run locally: `pnpm dev` and (separately) `pnpm build && pnpm start`.
2. Visit `/` in incognito (logged out) and while logged in; visit `/{username}`.
3. Open DevTools → Console and Network. Capture the **first** thrown error (message + stack), not just the generic overlay.
4. Optionally add temporary `console.log` in `AppWithProviders`, `CdpProviderGate`, or layout to see whether the throw happens before App, in CDP gate, or elsewhere.
5. Check Network for the first failing request (e.g. `auth/refresh` → 401 to `api.cdp.coinbase.com`).
6. After deploying, use **GlobalErrorCapture** output: look for `[CLIENT_ERROR] type=... path=... message=...` in Vercel logs or browser console.

**Put the actual error message + stack in the PR description** so the root cause is documented.
