# Profile, Cross-User Analytics & Review — Test Coverage Deliverables

**Mission:** Add the next layer of real test coverage for profile surfaces, cross-user analytics, and review flows using route-level and browser-level tests. Build on existing tests; no replacement.

---

## 1. Exact tests added

### 1.1 Route-level (Vitest)

| File | Tests |
|------|--------|
| `apps/web/src/app/api/me/analytics/profile/[username]/route.test.ts` | **Existing** (unchanged): 401 unauthorized, 403 not eligible, 404 not found, 400 USE_OWN_ANALYTICS, 429 rate limited, 200 success allowlisted payload only, 200 null analytics when no rollup. |
| `apps/web/src/app/api/reviews/can-review/route.test.ts` | **New.** 401 no token; 400 no username; 404 target profile not found; 400 self-review (target === reviewer); canReview false when no eligible deals; canReview true with dealId for eligible org deal; canReview true for eligible gig deal. |
| `apps/web/src/app/api/reviews/route.test.ts` | **New.** 401 no token; 400 when verified_deal not true; 400 when neither deal_id nor reviewee_profile_id; 400 self-review (gig path); 404 org deal not found; 400 org deal not completed; 403 not a party to org deal; 403 no gig deal (not a party). |

### 1.2 Browser / E2E (Playwright)

| File | Tests |
|------|--------|
| `apps/web/e2e/profile-analytics-review.spec.ts` | Cross-user analytics: analytics profile URL shows `[data-page=cross-user-analytics]`; unauthorized state shows “Sign in required”; not found state shows “Profile not found”; locked state shows “Analytics view not available”. Public profile: /[username] loads. Profile redirect: /app/profile?username=other results in analytics profile view (URL or content). LeaveReviewBlock: hidden when can-review returns false; visible with “Leave a review” when can-review returns true. |

### 1.3 Existing tests (unchanged)

- `apps/web/src/lib/crossUserAnalyticsAllowlist.test.ts` — allowlist shaping
- `apps/web/src/lib/profileRedirect.test.ts` — profile redirect helpers
- `apps/web/src/lib/appRouting.test.ts` — analytics path helpers
- `apps/web/src/lib/reviewsContract.test.ts` — review payload/contract shape

---

## 2. Framework used

| Layer | Framework | Run command |
|-------|-----------|-------------|
| Route / API | **Vitest** (Node) | `pnpm test:route` or `pnpm exec vitest run "src/app/api/me/analytics/profile/[username]/route.test.ts"` and same for `reviews/can-review/route.test.ts`, `reviews/route.test.ts` |
| E2E / browser | **Playwright** | `pnpm test:e2e` (starts dev server if not CI). Optional: `pnpm test:e2e:ui` |

---

## 3. Real route behavior covered

- **GET /api/me/analytics/profile/[username]:** 401, 403, 404, 400 USE_OWN_ANALYTICS, 429 (with resetAt), 200 allowlisted-only payload, 200 null analytics.
- **GET /api/reviews/can-review:** 401, 400 (no username), 404 (target not found), 400 (self), 200 canReview false (no deals), 200 canReview true (org deal with membership), 200 canReview true (gig deal).
- **POST /api/reviews:** 401, 400 (verified_deal missing), 400 (missing deal_id and reviewee_profile_id), 400 (self-review), 404 (deal not found), 400 (deal not completed), 403 (not party to org deal), 403 (no gig deal).

---

## 4. Browser behavior covered

- Navigating to `/app/analytics/profile/[username]` shows the cross-user analytics page (`data-page=cross-user-analytics`).
- Unauthorized (401) shows “Sign in required”.
- Not found (404) shows “Profile not found”.
- Locked (403 eligible) shows “Analytics view not available”.
- Public profile route `/[username]` loads.
- `/app/profile?username=other` leads to analytics profile view (URL or in-app route state).
- LeaveReviewBlock is not visible when can-review returns `canReview: false`.
- LeaveReviewBlock is visible with “Leave a review” when can-review returns `canReview: true` (with `data-testid="leave-review-block"`).

---

## 5. Privacy boundaries (strict)

Tests do not weaken privacy. Coverage verifies:

- Cross-user analytics route test asserts **allowlisted payload only** (no keys in `CROSS_USER_ANALYTICS_FORBIDDEN`: email, location, pricing, auth/account ids, private metadata).
- No new exposure of email, location, pricing, auth ids, or private metadata in any added test or mock.

---

## 6. Remaining gaps

- **Discover people click → /app/analytics/profile/[username]:** Not asserted end-to-end (would require search + click in app; can be added later with stable selectors).
- **LeaveReviewBlock E2E:** Requires authenticated session on `/u/[username]` for the “visible when canReview true” case; without auth the app redirects to login. Either run E2E with test auth or document as “auth required” for that test.
- **POST review success path:** Route tests cover rejection cases; 200 + review body not exercised in route tests (could add with full insert mock).
- **Rate limit E2E:** No browser test that triggers 429 and checks “Too many requests” UI (covered by route test only).

---

## 7. Final regression checklist

Before release, run:

1. **Unit / route tests**
   - [ ] `pnpm test:profile-analytics` (allowlist, profile redirect, app routing, reviews contract)
   - [ ] `pnpm test:route` (all Vitest route tests: analytics profile, can-review, POST reviews)

2. **E2E (dev server or CI)**
   - [ ] `pnpm test:e2e` (profile-analytics-review.spec.ts). If LeaveReviewBlock “visible” test fails without auth, run with test session or treat as optional in CI.

3. **Privacy**
   - [ ] Confirm no cross-user analytics response includes email, location, pricing, auth ids, or private metadata (allowlist test + route 200 test enforce this).

4. **No product/design changes**
   - [ ] No redesign or product behavior change except fixes for real bugs.
   - [ ] LeaveReviewBlock: only addition is `data-testid="leave-review-block"` for E2E.

5. **Stability**
   - [ ] Route tests use mocks only; no live DB required.
   - [ ] E2E use route interception where possible to avoid flakiness; auth-dependent tests documented.
