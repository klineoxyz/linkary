# Robots: App Shell Disallow (SEO Cleanup)

**Goal:** Align `robots.txt` with noindex / non-public intent for the app shell by explicitly disallowing `/app` and `/app/`.

**Classification:** Non-blocking SEO cleanup only. No routing, redirects, or sitemap changes.

---

## 1. Exact change made

**File:** `apps/web/src/app/robots.ts`

**Change:** Added two entries to the `disallow` array for `userAgent: "*"`:

- `/app`
- `/app/`

Inserted at the **start** of the `disallow` list so the app shell is clearly excluded. All existing entries (profile, dashboard, analytics, u, api, auth, login) are unchanged.

**Before:**  
`disallow: ["/profile", "/profile/", "/dashboard", ...]`

**After:**  
`disallow: ["/app", "/app/", "/profile", "/profile/", "/dashboard", ...]`

No other edits in `robots.ts`. `allow`, `sitemap`, and `host` are unchanged.

---

## 2. Final robots intent summary

- **Allow:** `/` (site remains crawlable; public pages are under `/` and `/:username`, `/:slug`).
- **Disallow:**  
  - **App shell:** `/app`, `/app/` — in-app product UI; not for indexing.  
  - **Legacy root app paths:** `/profile`, `/dashboard`, `/analytics` (and trailing slashes) — these 301 to `/app/...`; disallow reinforces that the destination app shell is not indexable.  
  - **In-app user:** `/u`, `/u/` — in-app profile route.  
  - **API / auth:** `/api`, `/api/`, `/auth`, `/auth/`, `/login`, `/login/`.
- **Sitemap:** Unchanged; still `{base}/sitemap.xml` (homepage + `/:username` + `/:slug` only).

Crawlers that follow 301s from old root app URLs to `/app/...` will now see that `/app` and `/app/` are disallowed and should not index those pages.

---

## 3. Confirmation: non-blocking cleanup only

- **Routing:** No change. Middleware and Next.js routes unchanged.
- **Redirects:** No change. Phase 7 301s (root app → `/app/...`) unchanged.
- **Sitemap:** No change. Still only public URLs.
- **Behavior:** Only `robots.txt` output changes; crawlers are instructed not to index the app shell. Users and app behavior are unaffected.

This implements the optional recommendation from `LINKARY_FINAL_URL_QA_REPORT.md` (Check 11). No blockers; cleanup only.
