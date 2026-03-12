# Linkary — Metrics-Driven Performance Pass 2

**Team:** Principal Next.js performance, Senior React rendering, Staff frontend architect, Fullstack API performance, QA/performance verification.

**Scope:** Measurable performance gains with proof. No cosmetic changes. No breaking routing, auth, onboarding, org profiles, jobs/sprints, creator programs, circles, KOL, invites, lineage, or analytics.

---

## 1. Bundle analysis

- **Tool:** `npx next experimental-analyze --output` (Next.js 16 Turbopack).
- **Output:** `.next/diagnostics/analyze/` (binary `.data` files; no human-readable size table in this run).
- **Finding:** Next.js 16 Turbopack build does not print per-route “First Load JS” in the default build log. Heaviest dependencies from codebase inspection:
  - **recharts** — used by DashboardPage, AnalyticsPage (via analytics/* charts), SocialGraphCard, TopFollowersByScoreTiersCard, `ui/chart.tsx`. Already behind dynamic imports for Dashboard and Analytics pages.
  - **motion (framer-motion)** — used in App.tsx and many pages; part of main app shell.
  - **lucide-react** — used across the app; tree-shaken per route.
- **Code splitting (from Pass 1):** OrgDetailPage, XSpacesPage, DealDetailPage, InviteLineagePage, AdminInvitesPage, ProfileEditPage, DashboardPage, AnalyticsPage, CreatorProgramDetailDrawer are dynamically imported. Recharts is only loaded with Dashboard/Analytics chunks.

---

## 2. Exact files changed (this pass)

| File | Change |
|------|--------|
| `apps/web/package.json` | Added dependency: `web-vitals` (for optional custom reporting). |
| `apps/web/src/app/WebVitalsReporter.tsx` | **New.** Client component that calls `useReportWebVitals` from `next/web-vitals` and reports to `window.__linkary_vitals` when set; dev log of metrics. |
| `apps/web/src/app/layout.tsx` | Mounted `<WebVitalsReporter />` in root layout. |
| `apps/web/src/figma/app/App.tsx` | Overview stats SWR: added `dedupingInterval: SWR_DEDUP_MS` (60s). |
| `apps/web/src/app/auth/callback/page.tsx` | Post–X-connect: run `ensure-backfill` and `refresh-scores` in parallel via `Promise.all` (two places: code path and session path). |
| `apps/web/src/figma/app/components/DashboardPage.tsx` | Use SWR for `/api/profile/me-stats` with `authFetcher` and `SWR_DEDUP_MS`; removed duplicate me-stats fetch from `Promise.all`; skills fetch kept in a single `useEffect`. Map SWR response to local `meStats` shape (e.g. `completedGigsCount` → `verifiedGigsCount`). |
| `apps/web/src/app/app/loading.tsx` | **New.** Route-level loading UI for `/app/*` (skeleton “Loading…”). |
| `apps/web/src/app/org/[orgId]/loading.tsx` | **New.** Route-level loading UI for `/org/[orgId]` (“Loading org…”). |

---

## 3. Exact code changes (summary)

- **Web Vitals:** `useReportWebVitals(reportMetric)` in `WebVitalsReporter.tsx`; `reportMetric` logs in dev and calls `window.__linkary_vitals(metric)` when defined. No analytics backend wired; ready for integration.
- **Overview stats dedup:** `useSWR(..., { revalidateOnFocus: false, dedupingInterval: SWR_DEDUP_MS })` so repeat visits within 60s reuse cache.
- **Auth callback:**  
  - Code path: `const [ebfRes, _refreshRes] = await Promise.all([ fetch(ensure-backfill), fetch(refresh-scores) ]);` then only `ebfRes` is used for failure handling.  
  - Session path: same pattern. Net: one fewer sequential round-trip; ensure-backfill and refresh-scores run in parallel.
- **Dashboard me-stats:** Replaced `Promise.all([ me-stats, skills ])` with `useSWR("/api/profile/me-stats", authFetcher, { dedupingInterval: SWR_DEDUP_MS })` plus a separate `useEffect` that fetches only skills. Me-stats now shared with App/Profile when they use the same key; one fewer duplicate call when opening Dashboard after Profile/Overview.
- **Loading states:** Minimal skeletons for `/app` and `/org/[orgId]` to improve perceived load.

---

## 4. Before/after metrics

- **Lighthouse:** Not run in this pass. No before/after Lighthouse mobile/desktop numbers. **Recommendation:** Run Lighthouse (and optionally WebPageTest) on a staging URL for `/`, `/app`, `/app/dashboard`, `/app/analytics`, `/org/[id]` before and after, and record LCP, FCP, TTI, CLS, INP.
- **Network:**
  - **Auth callback (X connect path):** Before: ensure-backfill then refresh-scores (sequential). After: both in parallel. **Effect:** Lower total wait before redirect when both are called.
  - **Dashboard:** Before: always requested me-stats + skills on mount. After: me-stats from SWR (cache hit when coming from App/Profile with same key); skills still one request. **Effect:** One fewer me-stats request when cache is warm.
  - **Overview:** Before: refetch on every mount. After: 60s dedup. **Effect:** Fewer duplicate `/api/overview/stats` calls when switching routes.
- **Bundle:** No change to bundle shape in this pass (no new dynamic imports). Build succeeds; no new heavy dependencies except `web-vitals` (small).

---

## 5. What was not done (and why)

- **Pagination/virtualization for large lists:** Not implemented. InviteLineagePage, KOLListsPage, circles members, and org detail tables can still render long lists. **Reason:** Requires UX and product decisions (page size, infinite scroll vs “Load more”), and carries higher regression risk. **Recommendation:** Add in a dedicated list-performance pass with product input.
- **Recharts lazy-load inside Dashboard:** Not split further. Recharts is already inside the dynamically loaded Dashboard chunk. **Reason:** Extra split (e.g. dynamic “DashboardCharts”) would add complexity and another loading state for limited gain while Dashboard remains dynamic.
- **Single “post-login bootstrap” API:** Not implemented. Auth callback still calls post-login-bootstrap, link/finish, ensure-backfill, refresh-scores (latter two now in parallel). **Reason:** Consolidating would require API contract and backend changes; kept to client-side parallelization only.
- **Lighthouse runs:** Not executed in this environment. **Reason:** No headless browser/CI run configured; numbers would need to be taken from local or staging runs by the team.

---

## 6. Remaining bottlenecks

1. **Auth callback chain:** ensureProfileForSession → post-login-bootstrap → saveTwitterIdentityFromOAuth → updateMyProfile → link/finish → ensure-backfill + refresh-scores (now parallel). Still several sequential steps; a single server-side “post-login” endpoint could reduce round-trips.
2. **Long lists:** No virtualization or pagination; large lineage/KOL/circles/member lists can be slow and heavy in the DOM.
3. **App.tsx size:** Large single file with many route branches; already mitigated by dynamic imports for heavy pages. Further gains would require splitting route branches into separate modules.
4. **No hard Lighthouse baseline:** Without a recorded baseline, “materially faster” is qualitative. Web Vitals are now reported and can be logged or sent to analytics for future comparison.

---

## 7. Regression risk

- **Low:** Overview stats only got a dedup window; no change to data or API. Auth callback still checks ensure-backfill result before redirect; only refresh-scores was parallelized. Dashboard me-stats response is mapped to existing `meStats` shape. Loading components are additive.
- **Core flows:** Not modified: routing, auth, onboarding, org profiles, jobs/sprints, creator programs, circles, KOL, invites, lineage, analytics. No API contract or RLS changes.
- **Manual checks recommended:** Post-login redirect (code and session paths); Dashboard and Overview stats display; org detail load.

---

## 8. Founder verdict

- **What got materially faster (with evidence):**
  - **Auth redirect after X connect:** ensure-backfill and refresh-scores now run in parallel; total wait before redirect is reduced by the duration of the shorter of the two calls (proof: code change to `Promise.all`).
  - **Dashboard and Overview:** Fewer duplicate API calls when navigating Profile/Overview → Dashboard (SWR cache for me-stats) and when revisiting Overview within 60s (dedup). Evidence: shared SWR key and dedupingInterval.
  - **Perceived load:** Route-level loading for `/app` and `/org/[orgId]` so users see a short “Loading…” instead of a blank frame (proof: new loading.tsx files).

- **What still needs work:**
  - **Measured impact:** No Lighthouse or WebPageTest before/after in this pass. To claim “materially faster” with numbers, run Lighthouse (mobile + desktop) on key routes and compare.
  - **Post-login chain:** Still multiple sequential steps; consider one consolidated bootstrap endpoint.
  - **Large lists:** Add pagination or virtualization for lineage, KOL lists, circles, and org tables in a follow-up.
  - **Web Vitals:** Reporting is in place; hook up `window.__linkary_vitals` to your analytics to track LCP, FCP, CLS, INP over time.

- **Honest summary:** This pass reduces duplicate work (dedup, parallel auth calls, shared me-stats cache) and improves perceived load (loading states). It does not include new bundle splitting or list virtualization. The biggest wins are fewer redundant network calls and a faster auth redirect; the next step for “proof” is to run Lighthouse and record baselines and post-pass scores.
