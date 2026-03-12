# Linkary — Proof-Based Performance Verification

**Purpose:** Provide evidence for what changed in the performance passes, what can be proven from code/build, and what must be measured by running the app and Lighthouse.

---

## 1. Lighthouse results (evidence status)

**Status:** Lighthouse was **not** run in this environment. There is no browser, no running server, and no Chrome/Chromium available to execute Lighthouse.

**Required from you:** Run Lighthouse on a **production build** (or staging) and fill in the table below.

### How to capture results

1. From `apps/web`: `pnpm build && pnpm start` (or deploy to staging).
2. For each route, run Lighthouse **mobile** and **desktop** (Chrome DevTools → Lighthouse, or CLI below).
3. Record LCP, FCP, INP, CLS, TBT (and overall Performance score if desired).

**CLI example (one route, mobile):**
```bash
cd apps/web
npx lighthouse http://localhost:3000/app --output=json --output-path=./.lighthouse/app-mobile.json --chrome-flags="--headless" --form-factor=mobile --only-categories=performance
```

**Routes to measure:**

| Route | Mobile LCP | Mobile FCP | Mobile INP | Mobile CLS | Mobile TBT | Desktop LCP | Desktop FCP | Desktop INP | Desktop CLS | Desktop TBT |
|-------|------------|------------|------------|------------|------------|-------------|-------------|-------------|-------------|-------------|
| `/` | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |
| `/app` | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |
| `/app/dashboard` | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |
| `/app/analytics` | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |
| `/org/[id]` | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ | _fill_ |

Until this table is filled from real runs, **no before/after Lighthouse proof exists**. The script `apps/web/scripts/run-lighthouse.js` prints the commands; run them locally or in CI.

---

## 2. Route-level timing: auth callback

**Evidence from code (no live timing):**

- **Before (conceptual):** After `link/finish`, the flow did:
  1. `await fetch(ensure-backfill)`
  2. then `fetch(refresh-scores)` (fire-and-forget).
  Redirect happened after (1) completed. So total wait = T(ensure-backfill) + 0 (refresh-scores not awaited).
- **After (code):** `const [ebfRes, _refreshRes] = await Promise.all([ fetch(ensure-backfill), fetch(refresh-scores) ]);` then redirect after both complete. Total wait = max(T(ensure-backfill), T(refresh-scores)).

**Proof that the change is in place:**  
`apps/web/src/app/auth/callback/page.tsx` lines 193–196 (code path) and the equivalent session path both use `Promise.all` for these two calls.

**Measurable proof:**  
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

So **wall-clock time before redirect is max(ensure-backfill, refresh-scores) instead of sum** (if refresh-scores had been awaited). If refresh-scores was already fire-and-forget, the change mainly ensures both run in parallel and redirect waits for ensure-backfill only (same as before), but both requests are in flight at once.

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
| a5f4cd58edf91a16.js | 712.69 | Shared by app routes (main app shell / framework). |
| c8e9d8b2c02b5be1.js | 581.70 | Shared. |
| 60b050a32b12e590.js | 534.85 | Shared. |
| 0f013a6fee9dc4bf.js | 219.25 | Route-specific or shared. |
| 5a2f0fb9cc76b59d.css | 207.54 | CSS. |
| a220356259de057e.css | 205.14 | CSS. |
| e239a704ca38c394.js | 172.90 | — |
| 47022278d403583c.js | 163.92 | Shared (in RSC chunk lists for app routes). |
| 0c779f38c54a44f0.js | 108.70 | — |
| 0115ca7239dff91a.js | 98.72 | — |
| b427f9768204791e.js | 94.58 | Shared. |

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

- **Proven from code:**  
  - SWR dedup is configured for overview stats and dashboard me-stats; auth callback runs ensure-backfill and refresh-scores in parallel.  
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
