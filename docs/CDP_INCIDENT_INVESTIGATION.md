# Coinbase CDP Incident Investigation — Linkary

**Date:** 2025-03-12  
**Mission:** Identify root cause of CDP wallet issues without breaking existing flows.

---

## 1. Root cause summary

**The CDP provider never mounts on the main app wallet route.**

- **CdpProviderGate** only treats **`/settings/wallet`** and **`/wallet`** as wallet routes.
- The in-app wallet UI is reached at **`/app/settings/wallet`** (pathname from Next.js `usePathname()`).
- When the user opens **Wallet** from the app sidebar (or lands on `/app/settings/wallet`), `isWalletRoute("/app/settings/wallet")` returns **false**, so:
  - `shouldMountCdp` is false
  - CDP is never loaded; `CDPReactProvider` is never rendered
  - **WalletShell** and all CDP-dependent components (e.g. **LinkProfilePanel**, **SendTxPanel**) run **without** a CDP provider
  - CDP hooks (`useEvmAddress`, `useLinkOAuth`, etc.) either throw (“must be used within CDPReactProvider”) or return null/empty, causing “Link a profile” issues, no deposit address, and broken wallet flows

So the issue is **provider scope / route mismatch**, not dynamic import timing, auth, env, CSP, or build.

---

## 2. Exact broken flow(s)

| Step | What happens |
|------|----------------|
| 1 | User is in the app (e.g. on `/app/overview` or any `/app/*` route). |
| 2 | User clicks **Wallet** in the sidebar (or navigates to `/app/settings/wallet`). |
| 3 | Next.js pathname is **`/app/settings/wallet`**. |
| 4 | **CdpProviderGate** runs `isWalletRoute("/app/settings/wallet")` against `["/settings/wallet", "/wallet"]` → **false**. |
| 5 | Gate returns `<>{children}</>`; **no** CDP import, **no** `CDPReactProvider`. |
| 6 | **AppWithProviders** has already rendered; **LinkaryApp** shows route `wallet` and renders **WalletShell**. |
| 7 | **WalletShell** and **LinkProfilePanel** use `@coinbase/cdp-hooks` (e.g. `useEvmAddress`, `useLinkOAuth`). |
| 8 | Hooks run outside any **CDPReactProvider** → errors or empty state → “Link a profile” and wallet features appear broken. |

**Working flow (currently):** Direct visit to **`/settings/wallet`** (root-level settings page). Then pathname is `/settings/wallet`, which matches `WALLET_ROUTES`, so CDP mounts and wallet works there. Most users, however, use the app sidebar and thus hit **`/app/settings/wallet`**, where CDP does not mount.

---

## 3. Files inspected

| File | Purpose |
|------|--------|
| `apps/web/src/app/CdpProviderGate.tsx` | Defines `WALLET_ROUTES` and `isWalletRoute()`; dynamic import of CDP; only mounts CDP when pathname matches. |
| `apps/web/src/app/AppWithProviders.tsx` | Wraps content in `CdpProviderGate` when `cdpAppId` is set; used by both wallet pages. |
| `apps/web/src/app/layout.tsx` | Root layout; provides `CdpAppIdProvider` with `NEXT_PUBLIC_CDP_APP_ID`. |
| `apps/web/src/app/settings/wallet/page.tsx` | Renders `AppWithProviders` → pathname **`/settings/wallet`** (CDP mounts). |
| `apps/web/src/app/app/settings/wallet/page.tsx` | Renders `AppWithProviders` → pathname **`/app/settings/wallet`** (CDP did not mount before fix). |
| `apps/web/src/figma/app/App.tsx` | Route `wallet` → path `/app/settings/wallet`; renders `WalletShell` when `route.name === "wallet"`. |
| `apps/web/src/components/wallet/WalletShell.tsx` | Uses `useEvmAddress()` from `@coinbase/cdp-hooks`; calls `/api/wallet/cdp/status` and `/api/wallet/cdp/ensure`. |
| `apps/web/src/components/wallet/panels/LinkProfilePanel.tsx` | Uses CDP hooks (`useLinkOAuth`, `useSignInWithOAuth`, `useEvmAddress`, etc.); requires CDP provider. |
| `apps/web/src/app/CdpErrorBoundary.tsx` | Catches CDP auth errors; link to `/app/settings/wallet`. |

---

## 4. Env / config assumptions checked

| Assumption | Status |
|------------|--------|
| `NEXT_PUBLIC_CDP_APP_ID` in layout → `CdpAppIdProvider` | OK; used in `AppWithProviders` and `CdpProviderGate`. |
| CDP only loaded on wallet routes (performance) | OK; intent preserved. |
| Domain/redirect/CSP for CDP | Not the cause; provider never mounts on `/app/settings/wallet` so CDP code path not reached. |
| Supabase auth vs CDP auth | Not the cause; issue is provider scope. |
| Dynamic import of `@coinbase/cdp-react` | Not the cause; import is never run for `/app/settings/wallet` because route check fails first. |

---

## 5. Code change applied

**Single change:** extend wallet route list so the **app** wallet path is included.

**File:** `apps/web/src/app/CdpProviderGate.tsx`

- **Before:** `const WALLET_ROUTES = ["/settings/wallet", "/wallet"];`
- **After:** `const WALLET_ROUTES = ["/settings/wallet", "/wallet", "/app/settings/wallet", "/app/wallet"];`

This ensures that when the user is on `/app/settings/wallet` or `/app/wallet`, `isWalletRoute(pathname)` is true, so:

1. `shouldMountCdp` is true (when `cdpAppId` is set).
2. The dynamic `import("@coinbase/cdp-react")` runs.
3. `CDPReactProvider` wraps children and `CdpErrorBoundary`.
4. WalletShell and LinkProfilePanel run **inside** the provider; CDP hooks work.

No other edits: no refactor, no removal of the dynamic-import optimization, no auth/config changes.

---

## 6. Regression risk

- **Low.** Only additional pathnames are considered wallet routes; existing `/settings/wallet` and `/wallet` still match.
- Non-wallet routes are unchanged; CDP still does not load on `/`, `/app/overview`, etc.
- If a future route under `/app/wallet` is added, it will correctly get CDP (intended).

---

## 7. QA steps to verify the fix

1. **App wallet (primary path)**  
   - Log in, open app, click **Wallet** in sidebar (or go to `/app/settings/wallet`).  
   - Expect: “Loading wallet…” briefly, then wallet UI (Balance, Link a profile, Deposit USDC, etc.).  
   - Open **Link a profile**: no crash; CDP recovery/linking options appear when CDP is available.  
   - If wallet already linked: **Deposit USDC** shows address and QR.

2. **Root settings wallet**  
   - Go directly to **`/settings/wallet`**.  
   - Expect: same behavior as above (still a wallet route).

3. **No CDP on other routes**  
   - Visit `/app/overview`, `/app/dashboard`, `/`, etc.  
   - Expect: no CDP load (no “Loading wallet…” on those pages); app works as before.

4. **Env unset**  
   - With `NEXT_PUBLIC_CDP_APP_ID` unset, open `/app/settings/wallet`.  
   - Expect: wallet page renders without CDP (no provider), same as current behavior when env is missing.

---

## 8. Founder-friendly summary

- **What was wrong**  
  The wallet screen that most users see (when they click Wallet in the app) lives at **`/app/settings/wallet`**. Our code only turned on the Coinbase CDP provider for **`/settings/wallet`** and **`/wallet`**, so on the main wallet page the provider was never turned on. Everything that depends on it (linking profile, deposit address, etc.) then failed or showed empty.

- **Why it happened**  
  When we limited CDP to “wallet routes” for performance, we listed routes that matched the root-level settings URL and a possible `/wallet` URL. The in-app wallet route **`/app/settings/wallet`** was not in that list, so the provider never mounted there.

- **What fixed it**  
  We added **`/app/settings/wallet`** and **`/app/wallet`** to the list of routes where CDP is allowed to load. No other change: same dynamic loading, same auth, same env/config. Only the set of URLs that are treated as “wallet routes” was corrected.

- **Category**  
  **Provider scope (code):** wrong route list in our app code. Not config, not auth, not CDP portal/domain, not build.

---

## 9. Top causes (if not fully provable)

If the above were not provable, the ranked causes would be:

1. **Route scope mismatch (confirmed)** — Pathname check in `CdpProviderGate` did not include `/app/settings/wallet`; evidence: `WALLET_ROUTES` and `routeFromPathname` / `ROUTE_TO_PATH` in App.tsx.
2. **Dynamic import never run on app wallet route** — Because `shouldMountCdp` was false for `/app/settings/wallet`, the `import("@coinbase/cdp-react")` effect never ran there.
3. **CDP hooks used outside provider** — WalletShell and LinkProfilePanel render under LinkaryApp without a provider when pathname is `/app/settings/wallet`; hooks then fail or return empty.

No evidence pointed to env, domain allowlist, CSP, OAuth config, or production-only issues as the primary cause.
