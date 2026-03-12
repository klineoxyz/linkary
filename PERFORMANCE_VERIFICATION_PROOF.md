# Linkary — Proof-Based Performance Verification

**Purpose:** Provide evidence for what changed in the performance passes, what can be proven from code/build, and what must be measured by running the app and Lighthouse.

**One structural fix (this pass):** Auth callback no longer awaits `refresh-scores`; only `ensure-backfill` is awaited before redirect. Redirect time = T(ensure-backfill) only. Previously, Promise.all made redirect wait for both—so if refresh-scores was slower, redirect got slower. Performance marks were added for measuring (see §2).

---

## 1. Lighthouse results (evidence status)

**Status:** One Lighthouse run was executed against a production build. Result below is **real** (not a template). Other routes were not run in this pass (single run; server port conflict for follow-up runs).

### Real measurement: `/` (home)

- **Run:** `npx lighthouse http://localhost:3000/ --output=json --output-path=./.lighthouse-home.json --only-categories=performance` (Lighthouse 13.0.3).
- **Environment:** Headless Chrome; network user agent was **mobile** (`environment.networkUserAgent` in the JSON).
- **Metrics (from `audits` in `.lighthouse-home.json`):**

| Metric | Value | Unit |
|--------|--------|------|
| **FCP** | 938 | ms |
| **LCP** | 1538 | ms |
| **TBT** | 0 | ms |
| **CLS** | 0 | — |
| **Max Potential FID** (INP proxy) | 16 | ms |

**Evidence file:** `apps/web/.lighthouse-home.json` (if present after run).

### Routes not measured in this pass

| Route | Mobile | Desktop |
|-------|--------|---------|
| `/app` | _not run_ | _not run_ |
| `/app/dashboard` | _not run_ | _not run_ |
| `/app/analytics` | _not run_ | _not run_ |
| `/org/[id]` | _not run_ | _not run_ |

**Required from you:** Run Lighthouse mobile and desktop on the routes above (production or staging), record LCP, FCP, INP, CLS, TBT, and fill the table in your own copy of this report. CLI example:

```bash
cd apps/web
npx lighthouse http://localhost:3000/app --output=json --output-path=./.lighthouse/app-mobile.json --chrome-flags="--headless" --form-factor=mobile --only-categories=performance
```

---

## 2. Route-level timing: auth callback

**Evidence from code (no live timing):**

- **Before (conceptual):** After `link/finish`, the flow did:
  1. `await fetch(ensure-backfill)`
  2. then `fetch(refresh-scores)` (fire-and-forget).
  Redirect happened after (1) completed. So total wait = T(ensure-backfill) + 0 (refresh-scores not awaited).
- **After (code):** Redirect waited for **both** (Promise.all). Total wait = max(T(ensure-backfill), T(refresh-scores)). So if refresh-scores is slower, redirect got **slower**.

### Fix implemented (this pass): non-blocking refresh-scores

**Proof that the change is in place:**  
`apps/web/src/app/auth/callback/page.tsx` lines 193–196 (code path) and the equivalent session path we no longer await refresh-scores: we fire `fetch(refresh-scores).catch(() => null)` (no await), then `await fetch(ensure-backfill)`, then redirect. Same on the session path. **Redirect time = T(ensure-backfill) only.**

### Timestamp logging (for proof)

`performance.mark()` was added. Marks: `auth-callback-link-finish-end`, `auth-callback-ensure-backfill-start`, `auth-callback-ensure-backfill-end`, `auth-callback-redirect`, and session-path variants. In the console after callback run: `performance.getEntriesByType('mark').filter(m => m.name.startsWith('auth-callback'))` to get timings. Duration from `link-finish-end` to `redirect` = time to redirect; `ensure-backfill-start` to `ensure-backfill-end` = T(ensure-backfill).

**Note:**  
To prove “auth callback is measurably faster” you need to measure time from “link/finish returns” to “redirect” before and after. Options:

1. Add a timestamp log when entering the block and when calling `window.location.href`; compare runs with and without the parallel change (e.g. revert and re-run).
2. In DevTools Network: filter by “ensure-backfill” and “refresh-scores”; confirm they run in parallel (same start time) and note total time until redirect.

Without one of these, the claim “auth callback is measurably faster” is **inferred from code**, not proven with numbers.

---

## 3. Before/after API request counts (from code)

Counts below are **derived from the source**. They are the number of API calls made on **initial load** (or in the stated scenario), not including user-triggered actions.

### Overview (route showing overview stats)

| Scenario | Before (code) | After (code) | Proof |
|----------|----------------|--------------|--------|
| First load of Overview | 1 × `/api/overview/stats` | 1 × `/api/overview/stats` | Same. |
| Navigate away and back to Overview within 60s | 1 × `/api/overview/stats` (refetch on mount) | 0 (SWR cache; key `/api/overview/stats`, dedupingInterval 60s) | App.tsx useSWR has `dedupingInterval: SWR_DEDUP_MS`. |

So **SWR dedup prevents a duplicate request only when revisiting Overview within 60s**. On first load there is no change.

### Dashboard

| Scenario | Before (code) | After (code) | Proof |
|----------|----------------|--------------|--------|
| First load of Dashboard (no prior App/Profile) | 1 me-stats + 1 skills | 1 me-stats (SWR) + 1 skills | DashboardPage uses useSWR for me-stats and separate useEffect for skills. |
| Load Profile (or App with me) then navigate to Dashboard | 1 me-stats + 1 skills (Dashboard mounted fresh) | 0 me-stats (cache hit, same key) + 1 skills | Same SWR key `/api/profile/me-stats` and authFetcher; dedupingInterval 60s. |

So **one fewer `/api/profile/me-stats` request when opening Dashboard after Profile/App within the dedup window**.

### Org detail (initial load only)

| Scenario | Before (Pass 1) | After (current) | Proof |
|----------|------------------|----------------|--------|
| Load org page (authenticated) | 10 parallel + listApplicationsForJobs + creator-programs; previously also influence-rollup | 9 parallel (no influence-rollup; influence from dashboard) + listApplicationsForJobs + creator-programs | OrgDetailPage.tsx: Promise.all has 9 items; influenceRollup set from dashboardRes.influenceRollup. |

Initial API set: listOrgMembers, affiliates, ambassadors, getOrgMetrics, listJobs, listCaseStudiesForOrg, supporters, support-status, dashboard. Then listApplicationsForJobs; then creator-programs if token. **No separate influence-rollup** (removed in Pass 1). So **initial request count is unchanged from Pass 1**; only the redundant influence-rollup was removed earlier.

### Auth callback (X connect path only)

| Phase | Before (code) | After (code) | Proof |
|-------|----------------|--------------|--------|
| After link/finish, before redirect | ensure-backfill then refresh-scores (sequential in practice for “wait”) | ensure-backfill and refresh-scores in parallel; redirect after both | callback/page.tsx uses Promise.all for the two fetches. |

**Correction (this pass):** With Promise.all, redirect waited for **both**; if refresh-scores is slower than ensure-backfill, redirect got **slower**. We reverted to non-blocking refresh-scores: redirect now happens after ensure-backfill only. See §2.

---

## 4. Verification: does SWR dedup actually prevent duplicate requests?

**Evidence from code:**

- Overview: `useSWR("/api/overview/stats", fetcher, { dedupingInterval: SWR_DEDUP_MS })`. Same key on every mount; SWR will not refetch within 60s.
- Dashboard me-stats: `useSWR(authToken ? "/api/profile/me-stats" : null, authFetcher, { dedupingInterval: SWR_DEDUP_MS })`. App/Profile use the same key and authFetcher, so they share the cache.

**How to verify in the browser:**

1. Open DevTools → Network. Clear.
2. Go to `/app` (or Overview). Confirm one request to `/api/overview/stats`.
3. Navigate to another app route, then back to Overview within 60s. Confirm **no second** `/api/overview/stats` request (or only one if cache expired).
4. Open Profile (or App with me), confirm one `/api/profile/me-stats`.
5. Navigate to Dashboard within 60s. Confirm **no second** `/api/profile/me-stats` (only skills).

If you see a second request in step 3 or 5 within the dedup window, then something (e.g. remount, different key) is bypassing dedup; otherwise, **dedup is proven for that flow**.

---

## 5. Bundle/chunk analysis (human-readable)

**Source:** `apps/web/.next/static/chunks` after `pnpm build` in apps/web. Sizes are uncompressed (KB).

### Largest client JS chunks (by file size)

| Chunk file | Size (KB) | Notes |
|------------|-----------|--------|
| a5f4cd58edf91a16.js | 713 | Shared; contains React, viem/ethers-style wallet code, base64, node_modules refs. |
| c8e9d8b2c02b5be1.js | 582 | Shared; next/image, Button/Input UI. |
| 60b050a32b12e590.js | 535 | Shared; supabase getSession, SWR (authFetcher), motion (PresenceContext). |
| 0f013a6fee9dc4bf.js | 219 | Route-specific or shared. |
| 5a2f0fb9cc76b59d.css | 208 | CSS. |
| a220356259de057e.css | 205 | CSS. |
| e239a704ca38c394.js | 173 | — |
| 47022278d403583c.js | 164 | Shared (in RSC chunk lists for app routes). |
| a6dad97d9634a72d.js | 110 | — |
| 0c779f38c54a44f0.js | 109 | — |
| 0115ca7239dff91a.js | 99 | — |
| b427f9768204791e.js | 95 | Shared. |

### What is inside the largest shared chunks (grep of built JS)

| Chunk | Contents (from grep) | Split safely? |
|-------|----------------------|----------------|
| a5f4cd58 (713 KB) | React (createContext, useState, useEffect), viem/ethers-style (getTransactionCount, eth_sendRawTransaction), base64; 104+ refs to react/supabase/swr/lucide/motion/node_modules. | Hard: core + wallet. Consider lazy-loading wallet if not on critical path. |
| c8e9d8b2 (582 KB) | next/image (findClosestQuality, getDeploymentId), Button/Input UI (r8, r7), Next.js config. | Possible: image loader separate; UI primitives shared. |
| 60b050a3 (535 KB) | Supabase getSession, SWR (SWR_DEDUP_MS, authFetcher), motion (data-motion-pop-id, PresenceContext), useConstant, useIsomorphicLayoutEffect. | Possible: motion lazy per route; supabase+SWR needed early. |

Chunk hashes are content-dependent; the mapping “hash → component” is not in a single manifest. From RSC segment files, **app routes** (e.g. `/app`, `/app/dashboard`, `/app/analytics`, `/app/xspaces`, `/app/profile`, `/app/invites/lineage`) all load a common set including: 468ed1d69ccc2000.js, 7be31a3bafdb6671.js, 013fea97aa03559b.js, 79b0844d1243eb4e.js, 4dc41f05087a3e1d.js, 433abbcf4383df7e.js, 60b050a32b12e590.js, b427f9768204791e.js, ebbe27b2b78ae2bd.js, a5f4cd58edf91a16.js, c9e6e5a316db01b4.js, c8e9d8b2c02b5be1.js, 47022278d403583c.js. Route-specific entry chunks differ (e.g. analytics: cf26616bdec33737.js; dashboard: 249b7126c8bd6240.js; xspaces: 39be4000522ed20e.js, etc.).

### Route → chunk summary (from RSC)

| Route | Route-specific JS (examples) | Shared chunks |
|-------|------------------------------|----------------|
| `/app` | 468ed1d69ccc2000.js (entry) | a5f4cd58, c8e9d8b2, 60b050a3, 47022278, b427f976, … |
| `/app/dashboard` | 249b7126c8bd6240.js | same shared set (Dashboard + recharts loaded here) |
| `/app/analytics` | cf26616bdec33737.js | same shared set (Analytics + charts) |
| `/app/xspaces` | 39be4000522ed20e.js, 7be31a3bafdb6671.js, … | same shared set |
| `/app/profile` | cc0d6048aeeda9fb.js | same shared set |
| `/app/invites/lineage` | 44f02d204b580d8b.js | same shared set |
| `/org/[orgId]` | (same app shell; OrgDetailPage dynamic) | same shared set + OrgDetailPage chunk when navigated |

---

## 6. Largest dependencies and which routes load them

| Dependency | Where used | Loaded by route |
|------------|------------|------------------|
| recharts | DashboardPage, AnalyticsPage, analytics/* charts, SocialGraphCard, TopFollowersByScoreTiersCard, ui/chart | /app/dashboard, /app/analytics, profile dashboard (if uses charts) |
| motion (framer-motion) | App.tsx, many pages | All app routes (part of shell) |
| lucide-react | Globally | All (tree-shaken) |
| react-force-graph-2d | InviteLineagePage (dynamic) | /app/invites/lineage only when opened |
| @supabase/supabase-js | Client auth, many components | Any authenticated route |
| swr | App.tsx, DashboardPage, AnalyticsPage, InsightsSnapshot | Overview, Dashboard, Analytics, Profile insights |

Heavy route-only chunks (dynamic): Dashboard (recharts), Analytics (recharts), XSpacesPage, OrgDetailPage, InviteLineagePage (force-graph), AdminInvitesPage, ProfileEditPage, DealDetailPage, CreatorProgramDetailDrawer.

---

## 7. Bottlenecks still unresolved

1. **No Lighthouse baseline or follow-up** — No numbers to prove “faster” or regressions. Must run Lighthouse (and optionally WebPageTest) and fill §1.
2. **Auth callback chain length** — ensureProfileForSession → post-login-bootstrap → saveTwitterIdentityFromOAuth → updateMyProfile → link/finish → ensure-backfill + refresh-scores. Still multiple round-trips; only the last two were parallelized. A single “post-login” API could reduce latency.
3. **Large shared JS** — a5f4cd58 (~713 KB), c8e9d8b2 (~582 KB), 60b050a3 (~535 KB) are shared by app routes; first load of any /app route pays for them. Further splitting would require moving more route trees into dynamic imports.
4. **Long lists** — InviteLineagePage, KOLListsPage, circles, org members/jobs: no pagination or virtualization; large lists can hurt TBT and INP.
5. **Org detail initial requests** — Still 9 parallel + listApplicationsForJobs + creator-programs; no batching into one backend call.
6. **Recharts on Dashboard/Analytics** — Loaded when those routes are opened; still a large dependency. Splitting “charts” into a sub-chunk would add complexity for limited gain unless Dashboard is on the critical path.

---

## 8. Next 3 optimizations (highest ROI, lowest regression risk)

1. **Run and record Lighthouse**  
   Run mobile + desktop on `/`, `/app`, `/app/dashboard`, `/app/analytics`, `/org/[id]` on production build; fill the table in §1. Add a CI job (e.g. Lighthouse CI) to track regressions. **ROI:** Proof of impact and regression detection. **Risk:** None (measurement only).

2. **Single post-login bootstrap API**  
   One server endpoint that, after X OAuth, does: ensure profile, upsert social_accounts, update profile mirror, optional ensure-backfill (or enqueue), optional refresh-scores (or enqueue). Auth callback then does: exchangeCodeForSession → set-session → single POST bootstrap → redirect. **ROI:** Fewer round-trips and faster redirect. **Risk:** Low if API is additive and callback is updated to use it and fall back on failure.

3. **Pagination or virtualization for one high-traffic list**  
   Pick one of: invite lineage list, KOL list, or org members. Add either cursor/limit pagination or a virtual list (e.g. react-window) so only a window of items is rendered. **ROI:** Lower TBT and INP on large lists. **Risk:** Low if limited to one list and UX (e.g. “Load more”) is agreed.

---

## 9. Honest summary

- **Real measurement (this pass):** Lighthouse was run once on `/`: FCP 938 ms, LCP 1538 ms, TBT 0 ms, CLS 0, Max Potential FID 16 ms (mobile UA). File: `apps/web/.lighthouse-home.json`. Other routes not run.

- **Correction:** Pass 2's Promise.all made redirect wait for both ensure-backfill and refresh-scores; if refresh-scores is slower, redirect got slower. That claim was wrong.

- **Fix implemented:** refresh-scores is non-blocking again; we only await ensure-backfill before redirect. Performance marks added (see §2). Chunk breakdown in §5.

- **Proven from code:**  
  - SWR dedup is configured for overview stats and dashboard me-stats; auth callback now awaits ensure-backfill only (refresh-scores fire-and-forget).  
  - Org detail no longer calls influence-rollup separately (influence from dashboard).  
  - Route loading states exist for `/app` and `/org/[orgId]`.

- **Not proven without running the app:**  
  - That SWR actually prevents duplicate requests (must be checked in Network tab).  
  - That auth callback is measurably faster (needs timestamps or Network timing).  
  - Any Lighthouse or Web Vitals improvement (no Lighthouse run in this environment).

- **Evidence you can collect:**  
  - Lighthouse table (§1) from real runs.  
  - Network tab: duplicate requests on Overview revisit and Dashboard after Profile.  
  - Auth callback: parallel ensure-backfill and refresh-scores and time to redirect.

No vague “should be faster” claims are made; only code-level evidence and the steps to get numeric proof are stated.
