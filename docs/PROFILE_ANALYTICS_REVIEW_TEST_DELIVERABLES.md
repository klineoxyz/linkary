# Profile Surfaces, Cross-User Analytics & Reviews — Test Deliverables

**Mission:** Add route-level and integration test coverage so current behavior is protected from regressions. No product behavior changes except testable extraction of helpers.

---

## 1. Exact tests added

| Test file | What it covers |
|-----------|----------------|
| `apps/web/src/lib/crossUserAnalyticsAllowlist.test.ts` | Cross-user analytics payload: allowed profile keys (username, display_name, avatar_url); allowed analytics keys; forbidden keys (email, location, pricing, user_id, id, etc.) never in response; `shapeCrossUserAnalyticsResponse` strips leaks; `isSafeProfileObject` / `isSafeAnalyticsObject` validators. |
| `apps/web/src/lib/profileRedirect.test.ts` | Profile redirect rule: `shouldRedirectProfileToAnalytics(viewUsername, publicSlug)` — no redirect when viewUsername or publicSlug empty, or when viewing self (same username); redirect when viewing other (different username); @ and case normalization. |
| `apps/web/src/lib/appRouting.test.ts` | Analytics profile path: `buildAnalyticsProfilePath(username)` builds `/app/analytics/profile/[username]`; `parseAnalyticsProfilePath(pathname)` parses back; roundtrip; no duplicate profile route (path is under analytics/profile). |
| `apps/web/src/lib/reviewsContract.test.ts` | Reviews API contract: can-review response must have `canReview` boolean; when true must have `dealId`+`dealType: "org"` or `revieweeProfileId`+`dealType: "gig"`; create body must have `verified_deal: true` and (`deal_id` or `reviewee_profile_id`); invalid payloads rejected by validators. |

**Run all:** `pnpm --filter web run test:profile-analytics`  
**Run individually:** `pnpm exec tsx apps/web/src/lib/<name>.test.ts`

---

## 2. Framework and files used

- **Framework:** No Jest/Vitest; same as existing tests (e.g. `entitlementDiscovery.test.ts`, `discoveryValidation.test.ts`): **tsx**-executed scripts with `assert(cond, msg)` and `console.log` on success.
- **Runner:** `pnpm exec tsx <path>` or `pnpm --filter web run test:profile-analytics`.
- **Files added:**
  - `apps/web/src/lib/crossUserAnalyticsAllowlist.ts` — Allowlist and `shapeCrossUserAnalyticsResponse` (used by GET /api/me/analytics/profile/[username]).
  - `apps/web/src/lib/crossUserAnalyticsAllowlist.test.ts`
  - `apps/web/src/lib/profileRedirect.ts` — `shouldRedirectProfileToAnalytics` (used by ProfilePage effect in App.tsx).
  - `apps/web/src/lib/profileRedirect.test.ts`
  - `apps/web/src/lib/appRouting.ts` — `buildAnalyticsProfilePath`, `parseAnalyticsProfilePath` (used by getPathForRoute and routeFromPathname in App.tsx).
  - `apps/web/src/lib/appRouting.test.ts`
  - `apps/web/src/lib/reviewsContract.test.ts` — Contract validators and assertions only (no API calls).
- **Files changed:**
  - `apps/web/src/app/api/me/analytics/profile/[username]/route.ts` — Uses `shapeCrossUserAnalyticsResponse` from allowlist.
  - `apps/web/src/figma/app/App.tsx` — Uses `shouldRedirectProfileToAnalytics`, `buildAnalyticsProfilePath`, `parseAnalyticsProfilePath`.
  - `apps/web/package.json` — Script `test:profile-analytics` added.

---

## 3. Coverage summary by surface

| Surface | Coverage |
|---------|----------|
| **/app/profile** | Redirect rule tested: `?username=other` (other ≠ me) → redirect to analytics viewer. Self-only and “no other-user mode” enforced by `shouldRedirectProfileToAnalytics`. |
| **/app/profile/edit** | Not directly tested (no route handler test); contract that edit is single control plane is documented. Review and visibility controls covered by review contract tests. |
| **/{username}** | Not directly tested; “remains public snapshot” is a product invariant; no duplicate profile route asserted in appRouting.test (path is /app/analytics/profile/*, not /{username}). |
| **/app/analytics/profile/[username]** | Payload allowlist tested (no email, location, pricing, auth ids); path build/parse tested; eligible/403/401/404/429/self-view are API behavior, not exercised by these unit tests. |
| **Cross-user analytics** | Allowlist guarantees no sensitive fields in response. API status codes (401, 403, 404, 429, 400 USE_OWN_ANALYTICS) are implemented in route; not hit by tsx unit tests without mocks. |
| **Analytics search navigation** | Path for analytics profile and roundtrip tested; Discover people → analytics viewer and View public profile → /{username} are implemented in App and use the tested helpers. |
| **Reviews** | can-review response shape and create body requirements (verified_deal, deal_id or reviewee_profile_id) enforced by contract tests. No open/fake path: validators require deal/reviewee when canReview true and verified_deal true. |

---

## 4. Bugs found and fixed

- **None.** No product bugs were found. Refactors were limited to extracting testable helpers (profileRedirect, appRouting, crossUserAnalyticsAllowlist) and wiring them into existing behavior so tests can protect that behavior.

---

## 5. Remaining untested areas

- **API route handlers with real auth/DB:** GET /api/me/analytics/profile/[username] and GET/POST review routes are not invoked with mocked Supabase or fetch in this pass. To add integration tests that hit 401/403/404/429/400, you’d need a test runner (e.g. Jest) with mocks or a local server.
- **E2E:** No Playwright/Cypress; no tests that click “Discover people” or “View public profile” in the browser.
- **/app/profile and /app/profile/edit:** No direct route or component tests; behavior is protected indirectly via redirect and routing tests.
- **LeaveReviewBlock UI:** “Review form only renders when canReview is true” is implemented in code; not asserted by these tests (would require component or E2E test).

---

## 6. Final regression checklist

- [ ] Run `pnpm --filter web run test:profile-analytics` — all four test files pass.
- [ ] **Profile:** /app/profile is self-only; `?username=other` (other ≠ me) redirects to analytics viewer (profileRedirect.test).
- [ ] **Edit:** /app/profile/edit remains single control plane for public visibility and pricing (documented; no code change).
- [ ] **Public profile:** /{username} remains public snapshot; no duplicate profile route (appRouting.test ensures path is under analytics/profile).
- [ ] **Cross-user analytics:** Payload only allowlisted fields; no email, location, pricing, auth ids (crossUserAnalyticsAllowlist.test).
- [ ] **Analytics search:** Discover people → /app/analytics/profile/[username]; View public profile → /{username} (appRouting + App wiring).
- [ ] **Reviews:** can-review shape and create body contract (verified_deal, deal_id or reviewee_profile_id) (reviewsContract.test).
- [ ] **Self-view:** API returns 400 USE_OWN_ANALYTICS (implemented in route; not covered by unit tests).
- [ ] **429:** Cross-user analytics API returns 429 with resetAt (implemented; not covered by unit tests).
