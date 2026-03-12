# Linkary — Proof-Based Performance Verification

**Purpose:** Evidence for performance changes, what is proven from code/build, and what must be measured in a running environment.

**Fixes in this doc:** (1) Auth callback: only `ensure-backfill` is awaited before redirect; `refresh-scores` is fire-and-forget. (2) CDP (Coinbase wallet) is loaded only on wallet routes via dynamic import, so it is no longer in the main app chunk.

---

## 1. Lighthouse results (app routes)

### What was run

- **Environment:** Production build (`pnpm build`), Lighthouse 13.0.3, headless Chrome.
- **Caveat:** Unauthenticated requests to `/app` redirect to `/`. So metrics for “requested /app” reflect the **redirect flow** (load /app → redirect → load /), not the authenticated app shell.

### Real measurement: requested `/app` (mobile, redirected to `/`)

| Metric | Value | Unit |
|--------|--------|------|
| **FCP** | 3149 | ms |
| **LCP** | 7309 | ms |
| **TBT** | 1030 | ms |
| **CLS** | 0 | — |
| **Max Potential FID** | 539 | ms |

- **Source:** `apps/web/.lighthouse/app-mobile.json`.
- **Run warning:** “The page may not be loading as expected because your test URL (http://localhost:3000/app) was redirected to http://localhost:3000/.”
- **Interpretation:** Poor scores are from loading the app route, then redirecting and loading the destination; they are **not** scores for a fully loaded authenticated app.

### Routes not measured in this environment

| Route | Why not measured |
|-------|-------------------|
| `/app/dashboard` | Requires authenticated session; Lighthouse run is unauthenticated → redirect. |
| `/app/analytics` | Same. |
| `/org/[id]` | Same; needs valid org id and auth. |

**How to get authenticated app-route metrics:**

1. **Script (recommended):** From `apps/web`, with your app server running (`pnpm start`):
   - Start Chrome with remote debugging: e.g. `"C:\...\chrome.exe" --remote-debugging-port=9222` (Windows) or `"/Applications/Google Chrome.app/.../Google Chrome" --remote-debugging-port=9222` (macOS).
   - In that Chrome, open your app (e.g. http://localhost:3000) and **log in**.
   - Run: `node scripts/run-lighthouse-authenticated.js 9222`  
     Optional: `node scripts/run-lighthouse-authenticated.js 9222 http://localhost:3000 YOUR_ORG_ID` to include `/org/[id]`.
   - The script runs Lighthouse for `/app`, `/app/dashboard`, `/app/analytics`, and optionally `/org/ORG_ID` (mobile + desktop), keeps your session (`--disable-storage-reset`, `--port=9222`), and prints a summary table. JSON reports go to `.lighthouse/`.

2. **DevTools:** Open the app in Chrome, log in, open DevTools → Lighthouse. Uncheck "Clear storage". Run a report for each URL and record FCP, LCP, TBT, CLS.

### Homepage (previous run)

| Metric | Value | Unit |
|--------|--------|------|
| FCP | 938 | ms |
| LCP | 1538 | ms |
| TBT | 0 | ms |
| CLS | 0 | — |
| Max Potential FID | 16 | ms |

---

## 2. Auth callback timing

### Current behavior (code)

- After `link/finish`: we **do not** await `refresh-scores`. We call `fetch(refresh-scores).catch(() => null)` (fire-and-forget), then `await fetch(ensure-backfill)`, then redirect.
- **Redirect time** = T(ensure-backfill) only.

### Performance marks (for manual measurement)

In `apps/web/src/app/auth/callback/page.tsx` we set:

- `auth-callback-link-finish-end` — after `link/finish` completes (code path).
- `auth-callback-ensure-backfill-start` / `auth-callback-ensure-backfill-end` — around the ensure-backfill request.
- `auth-callback-redirect` — just before `window.location.href`.
- Session path: `auth-callback-session-ensure-backfill-start` / `-end`, and `auth-callback-redirect`.

**How to measure:** Complete the auth callback in the browser, then on the next page (or before redirect) run:

```js
performance.getEntriesByType('mark').filter(m => m.name.startsWith('auth-callback'))
```

Compute:

- Time to redirect after link/finish = from `auth-callback-link-finish-end` to `auth-callback-redirect`.
- T(ensure-backfill) = from `auth-callback-ensure-backfill-start` to `auth-callback-ensure-backfill-end`.

**Why not measured here:** Requires a live OAuth run (real or test provider). Not run in this environment.

---

## 3. SWR dedup verification (DevTools)

**Claim:** SWR with `dedupingInterval: 60_000` and shared keys should prevent duplicate requests for the same key within 60s.

**How to verify:**

1. Open DevTools → Network. Clear.
2. Go to `/app` (or Overview). Note one request to `/api/overview/stats`.
3. Navigate away, then back to Overview within 60s. There should be **no second** `/api/overview/stats` (or only one if cache expired).
4. Open a route that fetches `/api/profile/me-stats` (e.g. Profile or App with me). Note one request.
5. Navigate to Dashboard within 60s. There should be **no second** `/api/profile/me-stats` (only skills may be requested).

If a second request appears within the dedup window, dedup is not effective for that flow (e.g. different key or remount).

**Why not verified here:** Requires interactive browser session; not run in this environment.

---

## 4. Shared-chunk reduction: CDP (wallet) off critical path

### Problem

- The largest shared JS chunk (~713 KB) included React, Supabase, SWR, and **viem/ethers-style wallet code** (from `@coinbase/cdp-react` and its dependencies).
- `CdpProviderGate` was imported on every page that uses `AppWithProviders`; it **statically** imported `CDPReactProvider` from `@coinbase/cdp-react`, so the CDP (and wallet) bundle loaded on every app route even though CDP is only used on `/settings/wallet` and `/wallet`.

### Candidate (implemented)

- **Move:** Load `@coinbase/cdp-react` only when the user is on a wallet route.
- **Exact change:** In `apps/web/src/app/CdpProviderGate.tsx`, remove the static `import { CDPReactProvider } from "@coinbase/cdp-react"`. When `shouldMountCdp` is true, dynamically `import("@coinbase/cdp-react")` and then render `CDPReactProvider`. Until the module is loaded, show a short “Loading wallet…” state on wallet routes.
- **Effect:** CDP and its dependency tree (including heavy wallet/crypto code) are in a separate chunk that is only fetched when the user navigates to `/settings/wallet` or `/wallet`. All other app routes no longer pull that chunk on first load.
- **Risk:** Low. Behavior on wallet routes is unchanged after the chunk loads; only the loading sequence is explicit.

### Other chunks (no change in this pass)

| Chunk (approx.) | Contents | Safe to split? |
|-----------------|----------|----------------|
| ~713 KB (post-CDP move, main app shell) | React, Supabase, SWR, motion, UI. | CDP moved; further splits would need per-route lazy loading of motion or other libs. |
| ~582 KB | next/image, Button/Input UI. | Shared primitives; splitting is possible but higher effort. |
| ~535 KB | Supabase getSession, SWR, motion (PresenceContext). | Motion could be lazy per route; Supabase/SWR needed early for auth. |

---

## 5. API request counts (from code)

- **Overview:** First load = 1× `/api/overview/stats`. Revisit within 60s = 0 (SWR cache, same key, dedupingInterval 60s).
- **Dashboard:** First load = 1× me-stats + 1× skills. After opening Profile/App within 60s, Dashboard = 0× me-stats (SWR cache) + 1× skills.
- **Org detail:** 9 parallel + listApplicationsForJobs + creator-programs; influence from dashboard (no separate influence-rollup).
- **Auth callback (X path):** After link/finish we await only ensure-backfill; refresh-scores is fire-and-forget.

---

## 6. This pass: measured, verified, unproven, next fix

### What was measured

- **Authenticated Lighthouse:** Not run in this environment. There is no Chrome instance with a logged-in session here, and OAuth cannot be automated without real credentials.
- **Added:** `apps/web/scripts/run-lighthouse-authenticated.js` so you can run Lighthouse on `/app`, `/app/dashboard`, `/app/analytics`, and `/org/[org-id]` with your existing session (Chrome with remote debugging + login, then script with `PORT=9222`). Run it locally and record the printed FCP, LCP, TBT, CLS (and any interaction metric) for each route.

### What was verified

- **Nothing in a real browser** was verified in this environment. SWR dedup (§3) and auth callback timing (§2) must be verified by you in DevTools / console.

### What remains unproven

- Authenticated app-route metrics (FCP, LCP, TBT, CLS, INP) for `/app`, `/app/dashboard`, `/app/analytics`, `/org/[id]`.
- That SWR actually prevents duplicate `/api/overview/stats` and `/api/profile/me-stats` within 60s when navigating as in §3.
- Auth callback timings (link/finish → redirect, ensure-backfill duration) from the existing `performance.mark` entries.
- Whether login/app entry is the main bottleneck (needed to choose the next fix from data).

### Next fix (one only, after measurement)

- **No structural change was implemented in this pass.** The next fix should be chosen only after you have authenticated metrics and, if possible, auth-callback timings.

- **Recommended next fix if login/app entry is slow:** **Single post-login bootstrap API.**  
  **Why ROI is high:** The auth callback today does several round-trips (ensureProfileForSession, set-session, saveTwitterIdentityFromOAuth, updateMyProfile, link/finish, ensure-backfill). A single server endpoint that performs profile ensure, social upsert, optional ensure-backfill (or enqueue), and optional refresh-scores in the background would reduce round-trips and time-to-redirect. One request from the client after session is set, then redirect when the server has finished (or after a minimal wait).  
  If authenticated Lighthouse instead shows that app-route JS or first load is the main cost, then **pagination/virtualization for one major list** or **further shared-shell reduction** may be better; use the numbers to decide.

---

## 8. Bottlenecks still open

1. **No Lighthouse for authenticated app content** — All app-route runs so far were unauthenticated; results are for redirect/login flow, not the actual app.
2. **Large shared JS** — After CDP move, the main shell is still large (React, Supabase, SWR, motion). Further gains need motion or other libs lazy-loaded per route.
3. **Long lists** — No pagination/virtualization yet on invite lineage, KOL lists, org members/jobs.
4. **Auth callback** — Multiple round-trips; a single post-login bootstrap API could reduce latency.

---

## 9. Summary

- **Existing fixes (unchanged):** Auth callback awaits only ensure-backfill (refresh-scores fire-and-forget). CDP loads only on wallet routes (dynamic import in `CdpProviderGate.tsx`). Performance marks and SWR dedup config in place.
- **This pass:** No authenticated Lighthouse runs in this environment (no browser session). Added `scripts/run-lighthouse-authenticated.js` so you can measure `/app`, `/app/dashboard`, `/app/analytics`, `/org/[id]` with a logged-in Chrome. No new structural fix; next fix is to be chosen after you have real authenticated metrics.
- **Recommendation:** If authenticated metrics show login/app entry is slow, implement the single post-login bootstrap API next (best ROI). Otherwise choose pagination/virtualization or shell reduction from the data.
- **Redirect-flow metrics** (§1) are explicitly not presented as app metrics; they are from unauthenticated requests and reflect redirect behavior only.
