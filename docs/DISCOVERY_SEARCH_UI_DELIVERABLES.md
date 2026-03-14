# Discovery Search UI — Deliverables

**Mission:** Build the first authenticated Linkary discovery/search experience on top of the hardened discovery API, without redesigning the product and without weakening privacy boundaries.

---

## 1. Exact files changed / added

| File | Change |
|------|--------|
| `apps/web/src/figma/app/components/DiscoveryPage.tsx` | **New.** Full discovery page: search input, debounced `q`, Profiles/Orgs tabs, card results, all entitlement and error states, navigation to `/{username}` and `/{slug}`. |
| `apps/web/src/app/explore/layout.tsx` | Set `metadata.robots = { index: false, follow: false }` so the explore/discovery page is not indexable (no public SEO). |
| `apps/web/src/figma/app/App.tsx` | Import `DiscoveryPage`; when `route.name === "explore"` render `<DiscoveryPage setRoute={setRoute} />` (replacing previous demo ExplorePage for that route). |
| `docs/DISCOVERY_SEARCH_UI_DELIVERABLES.md` | **New.** This document. |

**Unchanged (by design):**

- Discovery API routes: `GET /api/me/discovery/profiles`, `GET /api/me/discovery/orgs` — no changes.
- `discoveryAllowlist.ts`, `discoveryResponseShape.ts`, entitlement, rate limit, audit — unchanged.
- Public profile `/{username}` and org `/{slug}` behavior — unchanged; no new duplicate routes.

---

## 2. Route / page added

- **Next.js route:** `/explore` (page: `apps/web/src/app/explore/page.tsx`; layout: `apps/web/src/app/explore/layout.tsx`).
- **Rendering:** The explore page renders the app shell (`AppWithProviders`). When the in-app route is `explore`, the shell renders `DiscoveryPage`.
- **In-app navigation:** Internal route name `explore` maps to this discovery experience (e.g. sidebar “Explore”, dashboard CTA). No public discovery URL other than the existing canonical profile/org routes.
- **Indexability:** `layout.tsx` sets `robots: { index: false, follow: false }` so `/explore` is not indexed.

---

## 3. Components added

| Component | Location | Purpose |
|-----------|----------|---------|
| `DiscoveryPage` | `apps/web/src/figma/app/components/DiscoveryPage.tsx` | Single page component: search input, Profiles/Orgs tabs, result cards, and all states (idle, loading, success, locked, unauthorized, rate_limited, error, empty). Receives optional `setRoute` for in-app navigation (e.g. Back to overview, Sign in). |

No separate sub-components were added; the first version keeps the UI in one component for simplicity. Layout (e.g. sidebar) is handled by the existing app shell.

---

## 4. States handled

| State | Trigger | UI behavior |
|-------|--------|-------------|
| **idle** | Initial load with session; no query yet | “Start searching” placeholder; no API call on mount. |
| **loading** | User has typed (debounced) or switched tab; request in flight | Skeleton cards (4 placeholders). |
| **success** | API 200 with data | Show profile or org cards (depending on tab). |
| **Empty (no results)** | API 200 with empty list for current tab | “No results” message; suggest trying a different search term. |
| **locked** | API 403 with `code === "DISCOVERY_NOT_ELIGIBLE"` | Message that discovery is not available on current access level; “Back to overview” CTA. No discovery results shown. |
| **unauthorized** | No session on mount, or API 401 | “Sign in required” and “Sign in” button (navigates to login route). |
| **rate_limited** | API 429 | “Too many requests”; optional “Try again after &lt;time&gt;” from `resetAt`; OK button resets to idle. |
| **error** | API non-2xx (other than 401/403/429) or network failure | “Something went wrong” (or API message) and “Retry” button. |

Session check on mount: if there is no Supabase session, status is set to `unauthorized` immediately so unauthenticated users see “Sign in required” without typing.

---

## 5. Hooks / utilities added

- **None.** Search state, debounce (350 ms), and fetch are implemented inside `DiscoveryPage` with `useState`, `useEffect`, and `useCallback`. No shared `useDiscoverySearch` (or similar) hook was added; can be extracted later if desired.

---

## 6. Result fields shown (discovery-safe only)

UI consumes only the discovery API response; no enrichment from private or owner-only DTOs.

**Profile cards:**

- `avatar_url` (or placeholder)
- `display_name` (fallback: `username` → `twitter_username` → “—”)
- Handle line: `@username` or `@twitter_username`
- `bio` (line-clamp 2)
- `profile_type` (badge)
- `xscore` (badge, only if present and finite)
- No: email, location, pricing, internal ids, private metadata, contact info.

**Org cards:**

- `logo_url` (or placeholder)
- `name`
- `@slug`
- `tagline` (line-clamp 2)
- `xscore` (badge, only if present and finite)
- `ecosystem_categories` (first two, badge)
- No: internal ids, private metadata, contact info.

`analytics_snapshot` is allowlisted by the API but not currently rendered in the cards; it can be added later without changing the allowlist.

---

## 7. Regression checklist

- [ ] **Eligible user** can open discovery, type in search, and see profile and org results in respective tabs.
- [ ] **Non-eligible user** (403 `DISCOVERY_NOT_ELIGIBLE`) sees locked state only; no discovery results or sensitive data.
- [ ] **Anonymous / session failure** (no session or 401): “Sign in required” is shown; no discovery results.
- [ ] **429** is handled with a clear message and optional “Try again after &lt;time&gt;”; no results leaked.
- [ ] **No sensitive fields** appear in any card (no email, location, pricing, internal ids, private metadata, contact).
- [ ] **Profile result click** navigates to `/{username}` (canonical public profile).
- [ ] **Org result click** navigates to `/{slug}` (canonical public org route); no duplicate org route introduced.
- [ ] **Public profile and org pages** behave unchanged; discovery does not alter them.
- [ ] **No duplicate profile route**; discovery only links to existing `/{username}`.
- [ ] **Responsive layout** works on desktop and mobile (grid, search, tabs, cards).
- [ ] **/explore** is not indexable (robots noindex/nofollow).
- [ ] **No fetch on initial mount** when status is idle and search is empty (start-searching state).
- [ ] **Debounce** applied to search input (e.g. 350 ms) so API is not spammed.

---

## 8. Intentionally deferred

- **Filters / sorting:** Only minimal safe filters (e.g. type, profile type, org vs profile) considered for a later iteration; no complex ranking or filters that depend on sensitive fields.
- **Pagination:** First version uses a single page (limit/offset with default limit); “Load more” or page controls can be added later.
- **`useDiscoverySearch` hook:** Logic remains in `DiscoveryPage`; extraction is optional refactor.
- **Analytics snapshot in cards:** Not displayed in v1; API already returns it when approved; UI can show it later.
- **Billing/checkout:** No billing or checkout flow; locked state only explains that discovery is available on eligible plans.
- **Public discovery surface:** No public SEO discovery page; discovery stays authenticated and in-app only.

---

## 9. Navigation and privacy summary

- **Profile result** → `router.push(\`/${encodeURIComponent(username)}\`)` (canonical public profile).
- **Org result** → `router.push(\`/${encodeURIComponent(slug)}\`)` (canonical public org route).
- **No new public routes** for profiles or orgs; no mixing of discovery DTOs with owner/private DTOs on this page.
- **UI data source:** Only responses from `GET /api/me/discovery/profiles` and `GET /api/me/discovery/orgs`; no raw DB rows or owner/private payloads.
