# Phase 3 — Data Architecture & Multi-Provider Analytics

**Audit type:** Data platform, provider abstraction, caching, permissions, performance risks  
**Ownership:** Data Platform Architect (ex-Snowflake/Amplitude) + Staff Engineer  
**Scope:** X provider abstraction, YouTube/TikTok readiness, unified interface, caching, rate limits, cross-user analytics, chart performance.

---

## 1. Current X Provider Abstraction

### 1.1 Analytics (deep, auth-only)

- **APIs:** `GET /api/analytics/init-status`, `GET /api/analytics/x`, `GET /api/analytics/x/summary`, `POST /api/analytics/backfill-90`, `POST /api/analytics/x/rebuild`, `GET /api/analytics/x/job`, `POST /api/analytics/ensure-backfill`.
- **Data sources:** `profiles`, `x_analytics_rollups`, `x_top_drivers`, `profile_analytics_baseline`, `analytics_snapshots`, `x_daily_snapshots`, `x_window_aggregates`, `analytics_jobs`, `social_accounts`. All keyed by **profile_id** (current user from JWT).
- **Abstraction:** X-specific tables and APIs; no generic “provider” layer. Comments in AnalyticsPage reference “Platform-agnostic structure (X now, YouTube/TikTok later)” but implementation is X-only.

### 1.2 Social insights (profile-facing, cross-user)

- **API:** `GET /api/social/insights?provider=x|tiktok|youtube&username=...`
- **Contract:** `UnifiedInsightsResponse` in `socialInsightsUnifiedContracts.ts`: `provider`, `profile`, `topFollowersByTier`, `mentionsLastWeek`, `affiliatedAccounts`, `accountFeed`, `series`, `recommendedAccounts`, `meta.cache`.
- **X path:** Resolves `username` → `profile_id` via `public_profile_view`; then calls internal `GET /api/social/x/insights?username=...`; maps response to unified shape. **No auth required** — anyone can request any username; RLS and visibility are enforced by `public_profile_view` and by what the X insights backend returns.
- **TikTok/YouTube:** Same `username` → `profile_id`; then reads `tiktok_profile_cache` or `youtube_profile_cache` by `profile_id`. If missing, returns empty unified response with profile stub from `public_profile_view`.

### 1.3 Caching (X insights)

- **Tables:** `x_top_followers_cache`, `x_mentions_weekly_cache`, `x_account_feed_cache` (server-managed; RLS no policies; service role only).
- **Staleness:** 24h (configurable in `api/social/x/insights/route.ts`). Stale/miss returns empty arrays and `meta.cache` status.
- **Refresh:** `POST /api/admin/social/x/refresh-insights` (cron-secret); worker `sync:x:insights:daily` for batch. User-triggered: `POST /api/profile/refresh-x-insights` (rate-limited, own profile only).

### 1.4 Analytics backfill / snapshots

- **90d backfill:** `analytics_jobs`, worker, `x_daily_snapshots`, `x_window_aggregates`. Rate limited per user (e.g. 3 / 30 min for backfill-90).
- **ensure-backfill:** Called from auth callback and (optionally) app init; enqueues job and/or writes today snapshot.

---

## 2. Validation for YouTube / TikTok

### 2.1 Unified contract

- **UnifiedInsightsResponse** already supports `provider: "x" | "tiktok" | "youtube"` and a common `profile` shape (username, followers, following, posts, joinedAt). Top followers, mentions, feed, series are optional and provider-specific.
- **Gap:** TikTok and YouTube have no real fetch path; they only read from `tiktok_profile_cache` / `youtube_profile_cache`. No refresh pipeline, no external API integration yet.

### 2.2 Schema

- **Cache tables:** `tiktok_profile_cache`, `youtube_profile_cache` (profile_id, data, updated_at) are referenced in `/api/social/insights`. No schema audit was done here; assume they exist and match expected shape for `UnifiedInsightsResponse`.

### 2.3 Recommendation

- Keep **unified interface** at API and contract level (`/api/social/insights?provider=...`). Add provider-specific **fetch/refresh** when product prioritizes TikTok/YouTube (similar to X: cache tables + refresh endpoint + worker).
- **Unified analytics schema (deep):** For “Analytics” page (deep charts), introduce a **provider-agnostic** notion: e.g. `analytics_profiles` (profile_id, provider, enabled_at) and per-provider rollups/snapshots (e.g. `youtube_rollups`, `tiktok_snapshots`) so the Analytics UI can switch by provider without new page per platform.

---

## 3. Unified Provider Interface Model (Proposal)

### 3.1 Two layers

| Layer | Purpose | Current | Proposal |
|-------|---------|---------|----------|
| **Snapshot / insights** | Profile-facing: score, followers, top followers, feed (social insights). | `GET /api/social/insights?provider=&username=`; X from cache; TikTok/YouTube from cache or empty. | Keep. Add refresh pipelines per provider when needed. |
| **Deep analytics** | Logged-in user: time-series, rollups, top drivers, backfill. | `GET /api/analytics/x` (+ init-status, backfill, rebuild, job). | Add `GET /api/analytics?provider=x` (or `/api/analytics/x` keep) and later `provider=youtube`, `provider=tiktok` with same response shape where possible (rollups, snapshots, top content). |

### 3.2 Unified analytics schema (draft)

- **Profile-provider link:** `social_accounts` already has (profile_id, provider, username, ...). Use for “which providers this user has connected.”
- **Rollups:** Keep `x_analytics_rollups`; add `youtube_analytics_rollups`, `tiktok_analytics_rollups` with similar semantics (e.g. window, metrics).
- **Snapshots:** Keep `x_daily_snapshots`; add provider-prefixed daily snapshots for others.
- **Top content:** X has `x_top_drivers`; YouTube/TikTok could have `youtube_top_videos`, `tiktok_top_posts` with a common “driver” view (date, engagement, link to content) for the UI.

---

## 4. Caching Strategy

- **X insights (profile):** 24h TTL; refresh via cron or user “Refresh insights.” Acceptable for v1.
- **Analytics (deep):** Snapshots and rollups written by worker/backfill; no HTTP cache headers on API; client can cache in memory per session. For 100k+ users, consider short CDN or in-memory cache for `GET /api/analytics/x` (e.g. 60s) keyed by profile_id if read-heavy.
- **Cross-user insights:** `/api/social/insights` is stateless; internal call to `/api/social/x/insights` reads DB cache. Rate limit by IP or by username for unauthenticated calls if needed to avoid abuse.

---

## 5. Rate Limit Handling

- **ensure-backfill / backfill-90:** Documented rate limits (e.g. 3 / 30 min per user); 429 with `resetAt`; UI shows “Try again after {time}”.
- **refresh-x-insights:** Cooldown (e.g. 5 min) and optional global rate limit; UI shows “Refresh (cooldown)” or “Rate limited”.
- **Recommendation:** Centralize rate-limit responses (429 + body with `code: "RATE_LIMITED"`, `resetAt`) and a small client helper so all analytics/insights UIs show the same “Try again after …” pattern.

---

## 6. Cross-User Analytics (?username=)

### 6.1 Current behavior

- **Profile Insights tab:** Can pass `?username=` to view another user’s insights. InsightsTab fetches `GET /api/social/insights?provider=x&username=...` (and for own profile also me-stats and analytics/x).
- **GET /api/social/insights:** No auth. Resolves username → profile_id via `public_profile_view`. For X, calls internal `/api/social/x/insights?username=...`. Returns whatever that returns (cache or empty).
- **Permission:** Visibility is effectively “anyone who knows the username” gets the same unified response. There is no “private profile” or “insights visible only to me” at the API level for social insights; that would require a separate visibility flag and checks in the resolver.

### 6.2 RLS

- **Cache tables** (x_top_followers_cache, etc.): RLS enabled, **no select policies** — only service role. So only backend can read/write; front-end never sees raw cache.
- **public_profile_view:** Must restrict to “public” profiles or appropriate visibility; otherwise any username could leak existence. Audit that view for RLS or filter by `published`/visibility.

### 6.3 Blocked state UX

- If a profile is private or insights disabled, `/api/social/insights` can return empty or a 403/404. UI should show “Not available” or “Sign in to view” instead of empty charts. Recommendation: define a clear contract (e.g. 403 + `reason: "private"`) and handle in InsightsTab and any other consumer.

---

## 7. Performance Risks in Chart Rendering

- **Recharts:** Used in DashboardPage (Line, Area, Bar, Pie, Radar, ResponsiveContainer) and in SocialGraphCard (AreaChart, Line, XAxis, YAxis, Tooltip, Legend). Large datasets (e.g. 90 points) can cause layout and paint cost.
- **Risks:** (1) Dashboard loads many charts at once — consider lazy-loading below the fold or by tab. (2) Analytics page: multiple KPI tiles + top drivers table + charts — same. (3) SocialGraphCard: one AreaChart; keep data to last N points (e.g. 30) for smooth rendering.
- **Recommendation:** Lazy-load Analytics and Dashboard chart sections (e.g. IntersectionObserver or route-based dynamic import). Cap time-series to last 90 days or last N points; avoid rendering 1000+ points. Use `ResponsiveContainer` with explicit min height to avoid layout thrash.

---

## 8. Identified Risks (Summary)

| Risk | Severity | Mitigation |
|------|----------|------------|
| Cross-user insights: no auth; anyone can query by username | Medium | Add visibility check in resolver; return 403/empty for private profiles; consider rate limit by IP. |
| TikTok/YouTube: cache tables exist but no refresh; empty responses | Low | Document as “coming soon”; add refresh when product prioritizes. |
| Deep analytics: X-only; no unified schema for multi-provider | Medium | Introduce provider-agnostic analytics schema and API shape when adding YouTube/TikTok. |
| Chart performance: many charts on one page | Medium | Lazy-load and cap data points; consider virtualization for large tables. |
| Rate limit UX inconsistency | Low | Standardize 429 body and client handling. |

---

## 9. Multi-Provider Analytics Model (Proposal)

- **Snapshot layer:** Keep `GET /api/social/insights?provider=x|tiktok|youtube&username=`. Add refresh per provider (cron + optional user trigger) and cache tables per provider.
- **Deep layer:** Keep `/api/analytics/x` for current user; add optional `?provider=` or `/api/analytics/youtube` etc. with same mental model (rollups, snapshots, top content). Use shared “driver”/“top content” shape for UI.
- **Unified schema draft:** `analytics_providers` (profile_id, provider, connected_at); provider-specific rollup/snapshot/top tables; one “init status” and “backfill” concept per provider so Analytics page can show “X connected, YouTube coming soon.”
