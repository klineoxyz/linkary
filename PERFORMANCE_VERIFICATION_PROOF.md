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

**How to get real app-route metrics:** Run Lighthouse **with an authenticated profile** (e.g. Chrome user data dir with logged-in session, or use a tool that injects cookies). Then run against `http://localhost:3000/app`, `http://localhost:3000/app/dashboard`, `http://localhost:3000/app/analytics`, `http://localhost:3000/org/<real-org-id>`.

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

## 6. Bottlenecks still open

1. **No Lighthouse for authenticated app content** — All app-route runs so far were unauthenticated; results are for redirect/login flow, not the actual app.
2. **Large shared JS** — After CDP move, the main shell is still large (React, Supabase, SWR, motion). Further gains need motion or other libs lazy-loaded per route.
3. **Long lists** — No pagination/virtualization yet on invite lineage, KOL lists, org members/jobs.
4. **Auth callback** — Multiple round-trips; a single post-login bootstrap API could reduce latency.

---

## 7. Summary

- **Lighthouse:** One real run for **requested `/app`** (mobile): FCP 3149 ms, LCP 7309 ms, TBT 1030 ms, CLS 0 (redirect flow; not authenticated app). Homepage (previous): FCP 938 ms, LCP 1538 ms, TBT 0, CLS 0.
- **Auth callback:** Only ensure-backfill is awaited before redirect; refresh-scores is non-blocking. Performance marks are in place for manual timing.
- **SWR dedup:** Configured; verification steps are in §3 (must be done in DevTools).
- **Chunk reduction:** CDP is loaded only on wallet routes via dynamic import in `CdpProviderGate.tsx`. Main app chunk no longer includes CDP/wallet on non-wallet routes.
- **Stale text removed:** All references to Promise.all for auth callback and template placeholders have been removed; report reflects current behavior only.
