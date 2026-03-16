# Authenticated E2E Extension — Deliverables

**Mission:** Extend the shared authenticated Playwright setup to other protected Linkary flows (cross-user analytics, discovery/explore, review submit, Discover people journey) so critical logged-in user journeys are covered end-to-end and CI-safe.

See also: [Profile Deals E2E CI Auth Deliverables](./PROFILE_DEALS_E2E_CI_AUTH_DELIVERABLES.md) for the base auth setup.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| `apps/web/playwright.config.ts` | **Projects:** Renamed **profile-deals** → **authenticated**; same `storageState: ".playwright/profile-deals-auth.json"`. **authenticated** runs: `profile-deals-trust-loop.spec.ts`, `cross-user-analytics.spec.ts`, `discovery-explore.spec.ts`, `discover-people.spec.ts`. **chromium** project now testIgnores all four of these specs (no auth). |
| `apps/web/e2e/cross-user-analytics.spec.ts` | **New.** Authenticated E2E for `/app/analytics/profile/[username]`: mocks `GET /api/me/analytics/profile/[username]`; tests eligible user can open page, "View public profile" → `/{username}`, no sensitive fields in viewer. |
| `apps/web/e2e/discovery-explore.spec.ts` | **New.** Authenticated E2E for `/explore`: mocks `GET /api/me/discovery/profiles`; tests open explore, search with mock, click profile result → public `/{username}`, no sensitive data in cards; separate describe for locked state (403 DISCOVERY_NOT_ELIGIBLE). |
| `apps/web/e2e/discover-people.spec.ts` | **New.** In-app "Discover people" journey: goto `/app/profile`, mock `GET /api/search?q=...&filter=people`, type in "Search by name or handle...", click result → URL `/app/analytics/profile/[username]`. |
| `apps/web/e2e/profile-deals-trust-loop.spec.ts` | **Added** test "review submit happy path": open Leave review modal on completed deal, fill rating/title/body, mock `POST /api/reviews` 200, submit; assert POST payload, toast "Review submitted!", modal closes, row shows "Review submitted" and no second "Leave review". |

**Unchanged (preserved):**

- `apps/web/e2e/global-setup.ts` — same; writes `.playwright/profile-deals-auth.json` when `E2E_TEST_USER_EMAIL` / `E2E_TEST_USER_PASSWORD` set.
- `apps/web/e2e/profile-analytics-review.spec.ts` — unauthenticated tests for 401/403/404 and public profile / LeaveReviewBlock (still run in **chromium** only).

---

## 2. Protected flows now covered

| Flow | Spec | What’s covered |
|------|------|----------------|
| **Profile deals** | `profile-deals-trust-loop.spec.ts` | Auth sanity, completed/active/cancelled CTAs, case study modal + POST payload, **review submit happy path** (modal → submit → success → row shows "Review submitted", no second CTA). |
| **Cross-user analytics** | `cross-user-analytics.spec.ts` | Eligible user opens `/app/analytics/profile/[username]`, "View public profile" → `/{username}`, no sensitive fields in UI. (Unauthorized/locked/not-found remain in `profile-analytics-review.spec.ts` without auth.) |
| **Discovery / explore** | `discovery-explore.spec.ts` | Auth user opens `/explore`, search with mocked API, click profile → public `/{username}`; locked state (403); no sensitive data in discovery cards. |
| **Discover people (in-app)** | `discover-people.spec.ts` | Real journey: `/app/profile` → "Discover people" search → click result → `/app/analytics/profile/[username]`. |
| **Review submit** | `profile-deals-trust-loop.spec.ts` | Full browser flow: completed work → Leave review → fill form → POST /api/reviews → success toast + reviewed state. |

---

## 3. How auth setup was reused

- **Single storageState:** All authenticated specs use the same `.playwright/profile-deals-auth.json` produced by `global-setup.ts` (Supabase email/password; no browser in setup).
- **One authenticated project:** Playwright project **authenticated** runs all four spec files above with `storageState: ".playwright/profile-deals-auth.json"`. No per-spec or one-off auth logic.
- **Deterministic CI:** Same env vars (`E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, Supabase env) drive global setup; in CI, missing/invalid auth fails the run (existing profile-deals auth sanity behavior).
- **Local behavior:** Without credentials, global setup can write empty storageState; authenticated specs may redirect to login and skip (same pattern as profile-deals).

---

## 4. What is mocked vs real

| Area | Mocked | Real |
|------|--------|------|
| **Cross-user analytics** | `GET /api/me/analytics/profile/[username]` (200 + safe payload) | Supabase session (from storageState), app routing and UI. |
| **Discovery / explore** | `GET /api/me/discovery/profiles` (200 with safe profile list; 403 for locked test) | Session, explore page, search input, navigation to `/{username}`. |
| **Discover people** | `GET /api/search?q=...&filter=people` (200 with small results array) | Session, profile page, Discover people input, click → `/app/analytics/profile/[username]`. |
| **Profile deals** | `GET /api/deals/mine`, `GET /api/reviews/mine`, `POST/GET /api/case-studies` (unchanged); **review submit:** `POST /api/reviews` → 200 | Session, deals list, review modal, toast, local state update after submit. |

No real backend required for these E2E runs; mocks keep tests stable and CI-safe.

---

## 5. Bugs found and fixed

- **None.** Implementation only adds specs and reuses existing auth; no product or auth-boundary changes. Any failures observed were due to environment (e.g. no dev server when running with `PLAYWRIGHT_NO_WEB_SERVER=1` and no server on base URL).

---

## 6. Remaining gaps

- **Unauthorized/redirect for explore:** Discovery "unauthorized" and redirect-to-sign-in are covered by the existing Discovery page behavior; no separate unauthenticated explore spec was added (chromium project does not run discovery-explore; add one in profile-analytics-review or a separate spec if you want explicit no-auth explore tests).
- **CI web server:** As in base deliverables, CI must start the app and set `PLAYWRIGHT_BASE_URL` if needed; config does not start a server when `CI` is set.
- **Session expiry:** Long runs still use one session from global setup; no refresh in this extension.

---

## 7. Final regression checklist

- [ ] **Config:** `pnpm exec playwright test --list --project=authenticated` lists only the four specs above; chromium does not run them.
- [ ] **Auth reuse:** With `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` set, all authenticated specs use the same storageState (no new auth files or one-off login).
- [ ] **Profile deals:** Existing profile-deals tests still pass; review submit test passes (modal → submit → success → "Review submitted", no second "Leave review").
- [ ] **Cross-user analytics:** Open `/app/analytics/profile/[username]` shows cross-user-analytics page; "View public profile" goes to `/{username}`; no email/sensitive data in viewer.
- [ ] **Discovery:** Open `/explore` → search → click profile → `/{username}`; locked state (403) shows "Discovery is not available"; no sensitive data in cards.
- [ ] **Discover people:** From `/app/profile`, search in "Discover people" → click result → URL is `/app/analytics/profile/[username]`.
- [ ] **Privacy:** No tests assert or expose email, exact location, pricing, auth ids, or private metadata in analytics or discovery UI.
- [ ] **No regression:** `/profile/deals` Playwright auth setup and existing profile-deals behavior unchanged; no redesign or weakening of auth boundaries.
