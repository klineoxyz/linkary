# Phase 5 — Performance & Scalability

**Audit type:** Bundle size, data fetching, re-renders, lazy loading, monitoring  
**Ownership:** Staff Fullstack Engineer (ex-Google/Meta)  
**Scope:** Bundle, duplicate fetch, re-render risks, lazy loading for analytics, route-level performance, monitoring stack.

---

## 1. Bundle Size

### 1.1 Observations

- **Recharts:** Used by DashboardPage (Line, Area, Bar, Pie, Radar, ResponsiveContainer, etc.) and SocialGraphCard (AreaChart, Line, XAxis, YAxis, Tooltip, Legend). Recharts is a large dependency; importing the full library in the main app bundle increases initial JS.
- **Single app shell:** The main experience is one client-routed app (App.tsx) that conditionally renders OverviewPage, DashboardPage, AnalyticsPage, ProfilePage, etc. So all route components and their dependencies (Recharts, motion, supabase, etc.) are likely in the same bundle or few chunks unless code-split.
- **Recommendation:** (1) Measure bundle (e.g. `next build` with analyzer or `@next/bundle-analyzer`). (2) Dynamic import Dashboard and Analytics (and any other heavy routes) so Recharts and heavy charts load only when user navigates to those routes. (3) Ensure SocialGraphCard (recharts) is only loaded when Profile Insights (or equivalent) is rendered; if Insights tab is removed, that dependency is only needed where the social graph remains (e.g. Analytics).

### 1.2 Duplicate dependencies

- **Motion (framer-motion / motion):** Used in App.tsx, DashboardPage, AnalyticsPage, and others. Single import path and tree-shaking can reduce duplication.  
- **Lucide icons:** Many components import icons; ensure tree-shaking and avoid full library import.

---

## 2. Duplicate Data Fetching

### 2.1 Current overlap

- **Profile Overview:** Fetches `GET /api/profile/me-stats` (and profile search).  
- **Profile Insights:** Fetches `me-stats`, `GET /api/analytics/x`, `GET /api/social/insights?provider=x&username=...`.  
- **Analytics page:** Fetches `GET /api/analytics/init-status`, `GET /api/analytics/x`, `GET /api/analytics/x/summary`.  
- So when a user opens Profile then switches to Insights, both me-stats and analytics/x can be fetched again; when they then open Analytics, init-status and analytics/x are fetched again. No shared client cache (e.g. React Query or SWR) was audited; if each page fetches on mount, there is duplicate work.

### 2.2 Recommendation

- Introduce a **client-side cache** for analytics and profile (e.g. React Query, SWR) with a short stale time (e.g. 60s) so that navigating Profile → Insights → Analytics does not refetch the same analytics payload three times.  
- **ensure-backfill:** Called from app init (and auth callback); ensure it is not called on every route change, only once per session or after login.

---

## 3. Re-render and Loops

### 3.1 Risks

- **App.tsx:** Large component with many state variables and effects; route change triggers re-render of the whole tree. Child pages (Dashboard, Analytics, Profile) may re-fetch if they use `useEffect` with no deps or with route in deps.  
- **Analytics init banner:** State like `analyticsInitFailed`, `analyticsRateLimitResetAt` can cause re-renders when updated; ensure retry handler does not trigger unnecessary parent re-renders.  
- **Charts:** Recharts re-renders on data or size change; ensure parent does not pass new array references every render (e.g. memoize chart data).

### 3.2 Recommendation

- Memoize callbacks (setRoute, handlers) where passed to children.  
- Use stable data references for chart props (useMemo).  
- Avoid setting state in render; keep effects minimal and deps correct.

---

## 4. Lazy Loading for Analytics Modules

- **Route-level:** Use `next/dynamic` or `React.lazy` for DashboardPage and AnalyticsPage so their chunks (and Recharts) load only when the user navigates to /dashboard or /analytics.  
- **Below-the-fold:** Within Analytics and Dashboard, lazy-load chart sections (e.g. when in view via IntersectionObserver) to reduce main-thread work on first paint.  
- **Profile Insights:** If retained as snapshot-only, the “snapshot” component should be light; if a small chart is kept, load Recharts for that chart lazily.

---

## 5. Route-Level Performance

- **Overview:** Many cards and lists; ensure list virtualization if lists are long (e.g. featured creators/projects).  
- **Dashboard:** Many charts and brand cards; lazy-load charts and consider pagination or “Show more” for brands.  
- **Analytics:** Init status + KPIs + top drivers + charts; load charts after KPIs; consider splitting “Top drivers” into a separate chunk.  
- **Profile:** Overview is mostly static content per user; Insights (if present) is the heavier part (multiple cards and optional chart).  
- **Org detail:** Similar to Dashboard; lazy-load heavy sections.

---

## 6. Monitoring Stack (Proposal)

| Concern | Tool / approach |
|---------|------------------|
| **Error tracking** | Sentry (or similar): capture unhandled errors and API failures (e.g. 4xx/5xx from fetch). Tag by route and user. |
| **Performance monitoring** | Web Vitals (LCP, INP, CLS) via `web-vitals` and report to analytics or Sentry. Optionally Real User Monitoring (RUM) for TTFB and FCP. |
| **Logging** | Structured logs for API routes (request id, profile_id, route, status, duration). Avoid logging PII. Use log aggregation (e.g. Datadog, Logtail) for search and alerts. |
| **Alerts** | Alert on error rate spike, 5xx rate, and (if available) CWV degradation. |
| **Analytics** | Product analytics (e.g. events for “opened Analytics”, “clicked Backfill”) to understand usage and drop-off. |

---

## 7. Identified Risks (Summary)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Large initial bundle (Recharts + all routes) | High | Dynamic import Dashboard and Analytics; lazy-load chart components. |
| Duplicate fetches (me-stats, analytics/x across Profile and Analytics) | Medium | Client cache (React Query/SWR) with short stale time. |
| Re-renders and unstable chart data | Medium | Memoize chart data and callbacks; avoid new array refs every render. |
| No error/performance monitoring | Medium | Add Sentry and Web Vitals reporting; structured logging for API. |
| ensure-backfill on every load | Low | Call only once per session or after login; not on every route. |

---

## 8. Optimization Roadmap

1. **P0:** Bundle analysis; dynamic import for Dashboard and Analytics routes; lazy-load Recharts in those routes.  
2. **P0:** Introduce client cache for /api/profile/me-stats and /api/analytics/x (and init-status) to avoid duplicate requests.  
3. **P1:** Lazy-load below-the-fold chart sections; memoize chart data.  
4. **P1:** Add error tracking (Sentry) and Web Vitals reporting.  
5. **P2:** Structured logging and RUM; alerts on error rate and CWV.
