# Linkary — Launch Readiness Report

**Pre-launch structural audit for scale (100k+ users)**  
**Outcome:** Remove ambiguity on where analytics belongs; define P0/P1/P2 and implementation order.

---

## Executive Summary

Linkary today has **three places** that surface analytics-like content: **Dashboard** (brand + personal KPIs + summary charts), **Analytics** (deep X time-series, backfill, top drivers), and **Profile Insights** (X score, social graph, top followers, refresh). This creates duplication and user confusion. The audit defines a **single owner for deep analytics** (`/analytics`), a clear role for **Dashboard** (command center, no deep X charts), and a **final decision on Profile Insights** (remove or snapshot-only). It also documents design-system gaps (dark tokens on light shell), data and multi-provider readiness, SEO and performance work required before launch.

**Structural decision:** **Analytics** = the only page for deep charts and backfill/refresh. **Dashboard** = brands, deals, summary KPIs and summary charts only. **Profile** = identity and credibility snapshot; **Profile Insights tab = remove (recommended) or reduce to a small Snapshot module** with a “See full analytics” link to `/analytics`.

---

## 1. Structural Decision on Analytics Placement

| Question | Answer |
|----------|--------|
| **What is Dashboard?** | Command center: “My work, my brands, my deals.” High-level KPIs (volume, completion rate, rating, profile views), brand list and brand metrics, summary charts (volume trend, reputation growth, weekly activity). **No** deep X time-series, no top drivers, no backfill. |
| **What is Analytics?** | **Single deep analytics hub.** X (and later YouTube/TikTok): init status, 90d backfill, rollups, snapshots, top drivers, rebuild. Only `/analytics` owns “deep charts” and “full analytics” for the logged-in user. |
| **What is Profile?** | Identity + credibility snapshot: bio, score, reviews, volume, links, featured work, case studies. Snapshot only; no time-series, no “Refresh insights.” |
| **Should Profile Insights exist?** | **Recommendation: No.** Remove the Profile “Insights” tab for v1. On Profile (Overview), add one “Credibility” or “X summary” card: score + follower count + “See full analytics” → `/analytics`. **Alternative:** Keep a “Snapshot” tab with score + follower count + link to Analytics only; no duplicate charts, no refresh. |
| **Where do deep charts live?** | **Only on `/analytics`.** |
| **Where does snapshot credibility live?** | On **Profile** (Overview): score, reviews, volume, links. Optional small X summary (score + followers + link). |
| **How to avoid duplicated analytics modules?** | One place for deep analytics (Analytics page); Dashboard uses only summary metrics and summary charts; Profile shows only snapshot + optional link. Remove or drastically reduce Profile Insights. |
| **How to support multi-provider expansion?** | Keep unified contract at API level (`/api/social/insights?provider=x|tiktok|youtube`). Deep analytics: add provider dimension to schema and APIs (e.g. `/api/analytics?provider=x`); Analytics UI switches by provider. See AUDIT_DATA_ARCHITECTURE.md. |

---

## 2. Critical Launch Blockers

1. **Analytics ownership not enforced:** Profile Insights still duplicates deep analytics (social graph, top followers, refresh). **Action:** Remove Profile Insights tab or convert to snapshot-only and link to Analytics.
2. **Internal app routes indexable:** No robots.txt/sitemap; no noindex for /dashboard, /analytics, /profile, etc. **Action:** Add robots.ts, sitemap.ts, noindex for app routes (see AUDIT_SEO.md).
3. **Contrast/readability on light shell:** Dashboard and Analytics pages still use dark-theme tokens (text-white/*, border-white/*) on light background. **Action:** Apply light variant or light-by-default to AnalyticsPage, DashboardPage, SharedComponents (see AUDIT_DESIGN_SYSTEM.md).
4. **Bundle and duplicate fetch:** Heavy Recharts in main bundle; duplicate fetches for me-stats and analytics/x across Profile and Analytics. **Action:** Dynamic import Dashboard and Analytics; client cache for analytics and profile APIs (see AUDIT_PERFORMANCE.md).

---

## 3. P0 Must-Fix Before Launch

| P0 | Item | Doc reference |
|----|------|----------------|
| 1 | **Remove Profile Insights tab** (or replace with snapshot-only: score + “See full analytics” link). Redirect `/profile/dashboard` to `/analytics` if intent is “see my analytics.” | AUDIT_INFORMATION_ARCHITECTURE.md |
| 2 | **Noindex + robots + sitemap:** robots.ts (Disallow app routes), sitemap.ts (landing + published profiles), noindex meta/layout for app routes. | AUDIT_SEO.md |
| 3 | **Design: Analytics + Dashboard readable on light.** Add variant="light" (or light default) to AnalyticsPage, AnalyticsTabContent, DashboardPage, SharedComponents; use design tokens. | AUDIT_DESIGN_SYSTEM.md |
| 4 | **Performance:** Dynamic import Dashboard and Analytics routes; client cache (e.g. SWR/React Query) for /api/profile/me-stats and /api/analytics/x to avoid duplicate fetches. | AUDIT_PERFORMANCE.md |
| 5 | **Cross-user insights:** Define visibility (e.g. public_profile_view); return 403/empty for private; rate limit /api/social/insights if needed. | AUDIT_DATA_ARCHITECTURE.md |

---

## 4. P1 Improvements

- **Dashboard:** Do not fetch full /api/analytics/x for charts; at most summary or cached snapshot for one “X summary” tile with link to Analytics.
- **Design:** App.tsx Overview section (featured events, creators, projects) and OrgDetailPage: replace inline styles and white/black opacity with Tailwind tokens; PrivacyDataPage, VerificationCenterPage, VerificationInboxPage: consistent tokens.
- **SEO:** Landing OG, Twitter, canonical; keyword strategy in metadata and copy.
- **Performance:** Lazy-load below-the-fold charts; memoize chart data; add error tracking (Sentry) and Web Vitals reporting.
- **Data:** Standardize rate-limit response shape; document visibility for cross-user insights.

---

## 5. P2 Long-Term Optimizations

- **Design:** Link3Components, ReputationCardGenerator, CalendarPage, XSpacesPage, GlobalSearch, DailyDropBanner: tokens + variant; AccountFeedCard, MentionsCard light variant if still used; mobile pass (320/375px) for Dashboard, Profile, Analytics, Org.
- **Data:** Multi-provider deep analytics schema and API (YouTube/TikTok); refresh pipelines for TikTok/YouTube when product prioritizes.
- **SEO:** Structured data (Person/ProfilePage); CWV monitoring and tuning.
- **Performance:** RUM; structured logging; alerts on error rate and CWV.

---

## 6. Estimated Complexity

| Area | P0 | P1 | P2 |
|------|----|----|-----|
| IA / Profile Insights removal | 1–2 d | 0.5 d | — |
| SEO (robots, sitemap, noindex, landing) | 1 d | 0.5 d | 0.5 d |
| Design (light variant for Analytics, Dashboard, shared) | 2–3 d | 1–2 d | 1 d |
| Performance (dynamic import, cache) | 1–2 d | 1 d | 0.5 d |
| Data (visibility, rate limit) | 0.5 d | 0.5 d | 1 d |

**Rough total P0:** ~5–8 days. **P1:** ~3–4 days. **P2:** ~2–3 days.

---

## 7. Suggested Implementation Order

1. **IA first:** Decide and implement Profile Insights removal (or snapshot-only); update sidebar and redirects; document in IA.
2. **Design P0:** Apply light variant and tokens to Analytics and Dashboard so all key surfaces are readable.
3. **SEO P0:** Add robots.ts, sitemap.ts, noindex for app routes; landing metadata.
4. **Performance P0:** Dynamic import for Dashboard and Analytics; add client cache for analytics and profile APIs.
5. **Data P0:** Cross-user visibility and rate-limit contract.
6. Then P1 (design polish, SEO keywords, monitoring, data docs), then P2 (mobile, multi-provider, RUM).

---

## 8. Document Index

| Document | Purpose |
|----------|---------|
| **AUDIT_INFORMATION_ARCHITECTURE.md** | Routes, duplication, mental model, sitemap, page responsibility, analytics ownership, P0 structural changes. |
| **AUDIT_DESIGN_SYSTEM.md** | Typography contrast, dark tokens on light, variant system, component list, refactor plan (P0/P1/P2), mobile. |
| **AUDIT_DATA_ARCHITECTURE.md** | X provider, YouTube/TikTok readiness, unified interface, caching, rate limits, cross-user analytics, chart performance, multi-provider proposal. |
| **AUDIT_SEO.md** | Public vs internal routes, indexing, metadata, canonical, sitemap, robots, keywords, CWV. |
| **AUDIT_PERFORMANCE.md** | Bundle, duplicate fetch, re-renders, lazy loading, route performance, monitoring stack. |
| **LAUNCH_READINESS_REPORT.md** | This document: executive summary, structural decision, blockers, P0/P1/P2, complexity, implementation order. |

---

## 9. Outcome

- **Clear:** One place for deep analytics (Analytics); Dashboard and Profile have defined, non-overlapping roles.  
- **Scalable:** Unified provider contract and schema direction for multi-provider; client cache and lazy loading for performance.  
- **SEO-ready:** Indexing strategy and technical SEO tasks defined.  
- **Performance-ready:** Bundle and fetch optimizations and monitoring proposed.  
- **Multi-provider-ready:** Data audit and multi-provider model documented.

**No code was modified in this audit; only documentation was produced.**
