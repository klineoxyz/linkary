# Profile Surfaces, Cross-User Analytics & Review — Deliverables

**Mission:** Audit and fix Linkary’s 3 profile surfaces, bilateral review flow, and cross-user analytics access so the product behaves as intended without breaking the privacy model.

---

## 1. Exact files changed / added

| File | Change |
|------|--------|
| `apps/web/src/app/api/me/analytics/profile/[username]/route.ts` | **New.** GET cross-user analytics API: auth, discovery entitlement, resolve username via public_profile_view, return allowlisted profile + x_analytics_rollups snapshot only. 401/403/404/400 handling. |
| `apps/web/src/figma/app/components/CrossUserAnalyticsPage.tsx` | **New.** Cross-user analytics viewer UI: header (whose analytics), “View public profile” CTA, locked/unauthorized/not_found/error/loading/success states, allowlisted KPIs only. |
| `apps/web/src/app/app/analytics/profile/[username]/layout.tsx` | **New.** Layout with `metadata.robots = { index: false, follow: false }`. |
| `apps/web/src/app/app/analytics/profile/[username]/page.tsx` | **New.** Page renders AppWithProviders so in-app route resolves to analyticsProfile. |
| `apps/web/src/figma/app/App.tsx` | Import CrossUserAnalyticsPage; getPathForRoute(analyticsProfile) → `/app/analytics/profile/[username]`; routeFromPathname(analytics/profile/[username]); render CrossUserAnalyticsPage when route.name === "analyticsProfile"; Discover people click → setRoute(analyticsProfile, { username }) instead of profile; ProfilePage redirect when viewUsername !== publicSlug → analyticsProfile. |
| `docs/CROSS_USER_ANALYTICS_VISIBILITY.md` | **New.** Visibility contract: what eligible viewers see, owner-only, public-only, never exposed. |
| `docs/PROFILE_ANALYTICS_REVIEW_DELIVERABLES.md` | **New.** This document. |

**Unchanged by design:** Discovery API, public profile `/{username}`, owner analytics `/api/analytics/x`, review APIs (can-review, create, by-profile), entitlement discovery module.

---

## 2. Routes added / changed

| Route | Purpose |
|-------|---------|
| **/app/analytics/profile/[username]** | Cross-user analytics viewer. Authenticated, noindex. Resolves in-app as `analyticsProfile` with `data.username`. |
| **/api/me/analytics/profile/[username]** | API for cross-user analytics. Auth required; discovery entitlement required; returns allowlisted profile + analytics only. |

**Profile routes (behavior confirmed/fixed):**

- **/app/profile** — Self-only. If URL has `?username=other` and other !== current user, redirect to analytics viewer (analyticsProfile) so profile page never shows “other user” mode.
- **/app/profile/edit** — Source of truth for public profile content and visibility (unchanged).
- **/{username}** — Canonical public profile; snapshot-oriented; no deep analytics (unchanged).

---

## 3. Review-flow behavior confirmed

- **can-review:** GET /api/reviews/can-review?username=… returns canReview only when there is a completed org deal (caller is org admin) or active/completed gig deal between caller and target; no self-review; no open/fake path.
- **create:** POST /api/reviews requires verified_deal and deal_id (org) or reviewee_profile_id (gig); org deal must be completed; only parties to the deal can leave a review. POST /api/reviews/create uses collab_request_id and status=done for collab-based reviews.
- **Visibility:** Reviews are shown on public profile / by-profile API per existing rules. No changes made to review logic; audit only.

---

## 4. Cross-user analytics behavior

- **Eligible user** clicks a result from “Discover people” (profile search on Analytics/Profile) → navigates to **cross-user analytics viewer** (route analyticsProfile → /app/analytics/profile/[username]), not to public profile.
- **Public profile** remains the canonical identity page; “View public profile” CTA on the analytics viewer goes to `/{username}`.
- **Ineligible user** (403): sees locked state; no analytics data.
- **Unauthorized (401):** sign-in required state.
- **Not found (404):** profile not found or not published.
- **Owner viewing self:** API returns 400 USE_OWN_ANALYTICS; owner should use /api/analytics/x and /app/analytics.

---

## 5. Visibility rules implemented

- Cross-user API returns only: profile (username, display_name, avatar_url) and analytics (posts_7d/30d/90d, avg_likes_30d, avg_replies_30d, engagement_rate_30d, reach_proxy_30d). No email, location, pricing, auth ids, private metadata, or non-public contact. See `docs/CROSS_USER_ANALYTICS_VISIBILITY.md`.

---

## 6. API / schema changes

- **New API:** GET /api/me/analytics/profile/[username]. No DB schema changes. Uses existing `public_profile_view` and `x_analytics_rollups`.

---

## 7. Regression checklist

- [ ] **/app/profile** works as self-only; no other-user mode; if ?username=other (other ≠ me), redirect to analytics viewer.
- [ ] **/app/profile/edit** still controls public visibility correctly; no change.
- [ ] **/{username}** remains snapshot/public and not deep analytics; no change.
- [ ] **Reviews:** Eligible users can leave reviews only after verified collaboration (deal/collab); ineligible cannot; visibility correct on profile.
- [ ] **Eligible analytics viewers** can open other users’ analytics via Discover people → analytics viewer.
- [ ] **Analytics search click** (Discover people) goes to analytics viewer, not to public profile.
- [ ] **“View public profile”** from analytics viewer goes to /{username}.
- [ ] **No email/location/pricing/private metadata** in cross-user analytics API or UI.
- [ ] **No duplicate profile route** introduced; public profile remains /{username}.
- [ ] **Analytics profile route** is noindex (layout metadata).
- [ ] **Responsive layout** works for cross-user analytics page.
- [ ] **Non-eligible user** sees locked state on cross-user analytics; no data leak.
- [ ] **401** on cross-user API shows sign-in required in UI.

---

## 8. Updates and current state

- **Rate limiting:** Now implemented on GET /api/me/analytics/profile/[username] (same policy as discovery; 429 with resetAt). See CROSS_USER_ANALYTICS_VISIBILITY.md and PROFILE_ANALYTICS_VERIFICATION_DELIVERABLES.md.
- **Charts in cross-user viewer:** Only KPIs (snapshot) in v1; no engagement series or follower growth charts for other users.
- **Location/pricing controls:** Already in /app/profile/edit (single control plane). /app/profile shows read-only summary only. See PROFILE_ANALYTICS_VERIFICATION_DELIVERABLES.md.
- **Unifying “single source of truth”** for all public visibility: already in edit page. See PROFILE_ANALYTICS_VERIFICATION_DELIVERABLES.md. Deferred: additional filters only.
