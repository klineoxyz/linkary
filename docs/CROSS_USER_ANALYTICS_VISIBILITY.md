# Cross-User Analytics Visibility Contract

**Purpose:** Define what eligible viewers can see when viewing another user's analytics, what remains owner-only, and what is public-profile-only. No privacy regression.

---

## 1. Boundaries

| Surface | Who | Data |
|--------|-----|------|
| **Owner analytics** (`/api/analytics/x`, `/app/analytics`) | Profile owner only | Full deep analytics: charts, KPIs, raw tweet metrics, follower growth, engagement series, prior-window comparison. |
| **Public profile** (`/{username}`) | Anyone | Snapshot only when `analytics_visibility = 'public'`: ethos, xscore, rep_score, followers_total, avg_engagement_rate (from view). No deep time-series, no raw tweets. |
| **Cross-user analytics viewer** (`/api/me/analytics/profile/[username]`, `/app/analytics/profile/[username]`) | Eligible users only (same entitlement as discovery) | Allowlisted analytics snapshot only: profile (username, display_name, avatar_url), and from `x_analytics_rollups`: posts_7d/30d/90d, avg_likes_30d, avg_replies_30d, engagement_rate_30d, reach_proxy_30d. No email, location, pricing, auth/account ids, private metadata, private notes, non-public contact. |

---

## 2. What eligible cross-user viewers CAN see

- **Profile (identity):** username, display_name, avatar_url (from `public_profile_view`).
- **Analytics (allowlisted only):** Aggregates from `x_analytics_rollups`: posts_7d, posts_30d, posts_90d, avg_likes_30d, avg_replies_30d, engagement_rate_30d, reach_proxy_30d.
- **Navigation:** Clear CTA to "View public profile" (canonical `/{username}`).

---

## 3. What remains owner-only

- Full engagement series (chart data).
- Follower growth series.
- Prior-window comparison.
- Raw tweets, impressions per tweet.
- Any internal job/backfill state.
- Private profile fields (email, location, pricing, pricing_notes, meta, auth ids).

---

## 4. What remains public-profile-only

- Whatever the profile owner has set to show on `/{username}` (analytics_visibility, public_location, public_pricing, is_public on links/skills/relations, etc.). Cross-user analytics viewer does not duplicate or replace the public profile; it is a separate, entitlement-gated analytics view.

---

## 5. What must NEVER be exposed in cross-user analytics

- Email (auth or contact).
- Exact location.
- Pricing / pricing_notes.
- Auth/account identifiers (user_id, internal ids).
- Private metadata.
- Private notes.
- Non-public contact info.
- Raw private metrics not in the allowlist above.

---

## 6. Entitlement and rate limiting

- Cross-user analytics uses the **same** eligibility as discovery: `isEligibleForDiscovery(userId, email, serviceSupabase)`.
- If not eligible: API returns 403 `ANALYTICS_VIEW_NOT_ELIGIBLE`; UI shows locked state.
- **Rate limiting:** Same policy as discovery (60 requests per 60 seconds per user, key `analytics-profile:u:{userId}`). When exceeded: 429 RATE_LIMITED with `resetAt` (ISO). UI shows "Too many requests" and optional try-again time.
- Route is authenticated and noindex; not a public SEO page.

---

## 7. API contract

- **GET /api/me/analytics/profile/[username]**
  - Auth: required (Bearer or cookie).
  - Entitlement: must be eligible for discovery/analytics view.
  - Rate limit: 60/60s per user (same as discovery).
  - Response (200): `{ ok: true, profile: { username, display_name, avatar_url }, analytics: { posts_7d, posts_30d, ... } | null }`.
  - Errors: 401 Unauthorized, 403 ANALYTICS_VIEW_NOT_ELIGIBLE, 404 NOT_FOUND, 400 USE_OWN_ANALYTICS (use owner analytics for self), 429 RATE_LIMITED (body may include `resetAt`).
