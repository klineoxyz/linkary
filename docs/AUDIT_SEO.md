# Phase 4 — SEO & Google Crawl Strategy

**Audit type:** Indexing, metadata, duplicate content, keywords, Core Web Vitals  
**Ownership:** SEO & Web Performance Specialist (ex-Google Search team)

---

## 1. Public Routes

- **Indexable:** `/` (landing), `/(public)/[username]` when published, optionally `/terms`, `/privacy-policy`.
- **Internal (noindex):** `/dashboard`, `/analytics`, `/profile`, `/overview`, `/market`, `/messages`, `/settings`, `/login`, `/onboarding`, `/org`. These are client-routed app views; should not be indexed as distinct pages.

## 2. Current Metadata & Canonical

- **Root layout:** title "Linkary", description "Web3 reputation-driven gigs and reviews"; no OG, no canonical, no robots.
- **Public profile:** `(public)/[username]/page.tsx` has `generateMetadata`: title, description, `alternates.canonical`, `robots: published ? undefined : { index: false, follow: false }`, openGraph, twitter. Good.
- **SEO component:** `figma/app/components/SEO.tsx` supports canonical, noindex, OG, twitter; ensure it drives server-rendered head where needed.
- **Gaps:** No sitemap; no robots.txt/robots.ts; landing has no OG/canonical; app routes have no explicit noindex.

## 3. Recommendations

- **Robots:** Add `app/robots.ts`: Disallow `/dashboard`, `/analytics`, `/profile`, `/overview`, `/market`, `/messages`, `/settings`, `/login`, `/onboarding`, `/org`. Allow `/`. Sitemap URL.
- **Sitemap:** Add `app/sitemap.ts`: `https://domain/` plus published profile URLs `https://domain/{username}`. Exclude app routes.
- **Noindex:** Set noindex (layout or meta) for app routes so crawlers do not index them.
- **Landing:** Add openGraph, twitter, and canonical for `/`.
- **Canonical:** Public profile canonical = public URL; avoid indexing `/profile?username=...`.

## 4. Duplicate Content

- Ensure canonical for public profile is the server-rendered public page (`/(public)/[username]`), not the in-app profile view. Do not index `/profile?tab=...` or `?username=...`.

## 5. Keyword Positioning

- **Themes:** Web3 reputation, crypto influencer analytics, creator reputation infrastructure.
- **Use in:** Landing title/description and H1; public profile title/description. Optional Person/ProfilePage structured data.

## 6. Core Web Vitals

- **LCP:** Ensure landing and public profile above-the-fold content is fast (server-render, priority images, minimal blocking JS).
- **CLS/INP:** Use fixed min heights for charts/lists; defer non-critical JS.
- **Measure:** Lighthouse on `/` and `/{username}`; monitor CWV in production.

## 7. Indexing Strategy Summary

| URL | Index | Noindex |
|-----|--------|--------|
| `/` | Yes | |
| `/(public)/[username]` published | Yes | |
| `/(public)/[username]` unpublished | | Yes |
| App routes (dashboard, analytics, profile, etc.) | | Yes |

## 8. Required Technical SEO Changes

1. Add robots.ts (Disallow app routes; Sitemap).
2. Add sitemap.ts (landing + published profiles).
3. Noindex for app routes in layout/meta.
4. Landing: OG, Twitter, canonical.
5. Keyword strategy in metadata and copy.
6. CWV: measure and optimize LCP/INP/CLS.
