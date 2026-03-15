# Profile Surfaces & Cross-User Analytics — Verification Deliverables

**Mission:** Targeted verification and cleanup so there are no contradictory states, stale docs, or missing protections. Code and docs aligned with actual behavior.

---

## 1. Exact files changed (this pass)

| File | Change |
|------|--------|
| `apps/web/src/app/api/me/analytics/profile/[username]/route.ts` | Added rate limiting (same as discovery: 60/60s per user, key `analytics-profile:u:{userId}`). Use `ok`/`fail` from api-response; 429 with `resetAt`. |
| `apps/web/src/figma/app/components/CrossUserAnalyticsPage.tsx` | Added `rate_limited` status and UI state; 429 response sets `rateLimitResetAt`; "Too many requests" message with optional try-again time; "Back to Analytics" button. |
| `docs/CROSS_USER_ANALYTICS_VISIBILITY.md` | Documented rate limiting (policy, 429, resetAt) in Entitlement and API contract sections. |
| `docs/PROFILE_ANALYTICS_VERIFICATION_DELIVERABLES.md` | **New.** This document: verification results, actual control plane, rate limiting, review findings, regression checklist. |

**Unchanged:** Profile surfaces (no code change to /app/profile, /app/profile/edit, /{username}); review APIs; discovery API.

---

## 2. Verification results — four surfaces

### 2.1 /app/profile (self-only profile dashboard)

| Check | Result |
|-------|--------|
| **Who sees it** | Self only. No other-user mode. |
| **URL** | `/app/profile` (and `/app/profile?tab=…`). If `?username=other` and other ≠ current user → redirect to cross-user analytics viewer. |
| **Visibility/pricing controls** | **Read-only summary only.** Section "Public visibility & pricing" shows: "Location on public: Shown/Hidden", "Pricing on public: Shown/Hidden", and link "Edit in Advanced editor" to `/app/profile/edit`. **No editable toggles or price inputs on this page.** |
| **Source of truth for public visibility** | Not here. Single control plane is Advanced editor (see 2.2). |

### 2.2 /app/profile/edit (Advanced editor)

| Check | Result |
|-------|--------|
| **Who sees it** | Self only (owner). |
| **Visibility/pricing controls** | **Yes — single control plane.** ProfileEditPage contains: (1) "Public visibility" — checkboxes "Show location on public profile", "Show pricing on public profile" (`public_location`, `public_pricing` in meta). (2) "Monetization / Pricing" — post/podcast price_usd, platforms, notes; saved in `meta.pricing`. All saved via profile update (meta). |
| **Conclusion** | **Location and pricing controls are already in /app/profile/edit.** /app/profile shows only a read-only summary and link to edit. No contradiction; no further move needed. |

### 2.3 /{username} (canonical public profile)

| Check | Result |
|-------|--------|
| **Who sees it** | Anyone (anonymous or logged-in). |
| **Data** | From public_profile_view and related public data; location/pricing gated by `meta.public_location` / `meta.public_pricing`. Snapshot-oriented; no deep analytics. |
| **Conclusion** | Unchanged; no code or doc change in this pass. |

### 2.4 /app/analytics/profile/[username] (cross-user analytics viewer)

| Check | Result |
|-------|--------|
| **Who sees it** | Authenticated, entitlement-gated (same as discovery). Noindex. |
| **Search result click** | "Discover people" (profile search) click → `setRoute({ name: "analyticsProfile", data: { username } })` → navigates to this viewer (not to public profile). |
| **View public profile** | Button "View public profile" → `router.push(\`/${username}\`)` (canonical public profile). |
| **Self-view** | API returns 400 USE_OWN_ANALYTICS when profile id equals viewer user id; owner should use /app/analytics. |
| **States** | 401 → sign-in required; 403 → locked; 404 → not found; **429 → rate limited** (with resetAt); error → retry. |

---

## 3. Location/pricing controls — centralized in /app/profile/edit

- **Verified in code:** Editable controls for `public_location`, `public_pricing`, and pricing values (post/podcast USD, platforms, notes) live **only** in ProfileEditPage (`/app/profile/edit`). They are written to `profiles.meta` on save.
- **/app/profile** shows only a read-only summary ("Location on public: Shown/Hidden", "Pricing on public: Shown/Hidden") and the link "Edit in Advanced editor". There are no checkboxes or price inputs on /app/profile.
- **Docs:** Previous deliverables (PROFILE_SURFACES_AUDIT, PROFILE_ANALYTICS_REVIEW_DELIVERABLES) had recommended "move" or listed "deferred". **Current reality:** the move is already done. This doc is the single source of truth for that.

---

## 4. Rate limiting on cross-user analytics

- **Added:** GET /api/me/analytics/profile/[username] now uses the same rate limit as discovery: 60 requests per 60 seconds per user, key `analytics-profile:u:{userId}`, via `rateLimit()` and DISCOVERY_RATE_LIMIT / DISCOVERY_RATE_WINDOW_SEC.
- **429 response:** `fail("RATE_LIMITED", "Too many requests. Try again later.", 429, { resetAt: rl.resetAt })`. Retry-After header set when resetAt present (api-response).
- **UI:** CrossUserAnalyticsPage handles 429: shows "Too many requests", optional "Try again after HH:MM", "Back to Analytics" button.

---

## 5. Review flow findings

- **Eligibility:** GET /api/reviews/can-review returns canReview only when there is a completed org deal (caller is org admin) or active/completed gig deal between caller and target; no self-review.
- **Create:** POST /api/reviews requires verified_deal and deal_id (org) or reviewee_profile_id (gig); org deal must be completed; only parties to the deal can leave a review. Collab-based path: POST /api/reviews/create with collab_request_id and status=done.
- **UI entry points:** (1) Profile page "Leave Review" button → navigates to overview (generic CTA). (2) Public profile page (e.g. u/[username]) → LeaveReviewBlock calls can-review; **the review form is rendered only when canReview is true** (`if (loading || !state?.canReview) return null`). No duplicate or open review path in UI.
- **Conclusion:** Review actions are shown only when allowed; no fake/open path. Both people and projects (org/gig) can review only when eligible (verified deal or done collab).

---

## 6. Regression checklist

- [ ] **/app/profile** shows only read-only visibility summary + link to Advanced editor; no editable location/pricing controls.
- [ ] **/app/profile/edit** contains all public visibility and pricing controls (public_location, public_pricing, pricing values).
- [ ] **/app/profile** self-only; ?username=other (other ≠ me) redirects to analytics viewer.
- [ ] **/{username}** remains public snapshot; no deep analytics.
- [ ] **Discover people** click → /app/analytics/profile/[username] (analytics viewer), not /{username}.
- [ ] **View public profile** from analytics viewer → /{username}.
- [ ] **429** on cross-user analytics API shows rate-limited state and optional resetAt time.
- [ ] **401/403/404** on cross-user analytics show correct states (sign-in, locked, not found).
- [ ] **Review form** on public profile only when canReview; no open/fake review path.
- [ ] **No sensitive data** in cross-user analytics API or UI.
- [ ] **Analytics profile route** noindex.

---

## 7. Stale or corrected documentation

- **PROFILE_SURFACES_AUDIT.md:** Contains recommendations that were later implemented (location/pricing in edit). Use this verification doc for **current** state; audit doc remains historical context.
- **PROFILE_ANALYTICS_REVIEW_DELIVERABLES.md:** Listed "Rate limiting … not added" and "Moving location/pricing … deferred." **Corrected:** Rate limiting is now added; location/pricing controls are already in edit (no move deferred).
- **CROSS_USER_ANALYTICS_VISIBILITY.md:** Updated to include rate limiting and 429 in API contract.
- **Single source of truth for current behavior:** This document (PROFILE_ANALYTICS_VERIFICATION_DELIVERABLES.md).

---

## 8. Intentionally deferred (unchanged)

- Charts in cross-user viewer (only KPIs in v1).
- Additional filters/sorting on discovery or analytics search.
