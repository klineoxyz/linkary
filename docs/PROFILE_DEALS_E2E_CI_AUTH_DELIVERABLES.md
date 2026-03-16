# Profile Deals E2E — CI Auth Setup Deliverables

**Mission:** Make the `/profile/deals` Playwright tests fully reliable in CI with deterministic authenticated test setup, without changing product behavior.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| `apps/web/e2e/global-setup.ts` | **New.** Loads `.env.local`; when `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` are set, signs in with Supabase, builds storageState JSON (Supabase auth key in localStorage), writes `.playwright/profile-deals-auth.json`. When credentials missing or sign-in fails, writes empty storageState (or in CI throws). No browser; runs before web server. |
| `apps/web/playwright.config.ts` | Added `globalSetup: require.resolve("./e2e/global-setup.ts")`. Split projects: **chromium** (all tests except profile-deals), **profile-deals** (only `**/profile-deals-trust-loop.spec.ts`, `storageState: ".playwright/profile-deals-auth.json"`). |
| `apps/web/e2e/profile-deals-trust-loop.spec.ts` | Updated comment. In `gotoDealsAndExpectList`: when redirected to `/login` or list not visible, **CI** → throw with clear message; **local** → `test.skip`. Added test **"auth sanity: authenticated session lands on /profile/deals and not /login"** (fails in CI if auth broken, skips locally if no creds). |
| `apps/web/.gitignore` | Added `.playwright` so auth state is not committed. |

---

## 2. Auth approach used

- **Global setup** (runs once before any worker): Node script only; no browser, no dev server.
- **Supabase email/password:** `signInWithPassword(E2E_TEST_USER_EMAIL, E2E_TEST_USER_PASSWORD)` to get a session (access_token, refresh_token, user, etc.).
- **storageState:** Built by hand in global setup. Supabase client stores session in `localStorage` under `sb-<project-ref>-auth-token`. We write Playwright’s storageState JSON with that origin and a single localStorage entry `{ name: storageKey, value: JSON.stringify(session) }` so the app’s `getSession()` sees the session.
- **Project split:** Only the **profile-deals** project uses this storageState and runs `profile-deals-trust-loop.spec.ts`. The default **chromium** project ignores that spec so it doesn’t run without auth.
- **Mocks unchanged:** `/api/deals/mine`, `/api/reviews/mine`, and `/api/case-studies` remain mocked in the spec for deterministic UI regression; no real backend required for these tests.

---

## 3. How to run locally

**With auth (recommended for profile-deals):**

1. In Supabase (or your app), create a test user with **email + password** (Auth → Users, or sign up and note credentials).
2. In `apps/web/.env.local` (or env) set:
   - `E2E_TEST_USER_EMAIL=...`
   - `E2E_TEST_USER_PASSWORD=...`
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (likely already set).
3. From `apps/web`:
   ```bash
   pnpm run test:e2e -- e2e/profile-deals-trust-loop.spec.ts
   ```
   Or start the app first and skip web server:
   ```bash
   PLAYWRIGHT_NO_WEB_SERVER=1 pnpm run test:e2e -- e2e/profile-deals-trust-loop.spec.ts
   ```

**Without auth:**  
Do not set the two E2E_* vars. Global setup writes an empty storageState. The profile-deals tests will **skip** (redirect to login or no list), which is acceptable for a quick local run.

---

## 4. How CI should run it

1. **Secrets:** In your CI (e.g. GitHub Actions, Railway), set:
   - `E2E_TEST_USER_EMAIL` (secret)
   - `E2E_TEST_USER_PASSWORD` (secret)
   - `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (often already set for the app).

2. **Run:** From repo root or `apps/web`:
   ```bash
   cd apps/web && pnpm run test:e2e
   ```
   Or only profile-deals:
   ```bash
   cd apps/web && pnpm run test:e2e -- e2e/profile-deals-trust-loop.spec.ts
   ```

3. **Behavior:** Global setup runs first (no server). If credentials are set, it obtains a Supabase session and writes `.playwright/profile-deals-auth.json`. The **profile-deals** project runs the spec with that storageState. If auth fails or is missing in CI, global setup or the **auth sanity** test fails with a clear message.

4. **Web server:** Playwright config does **not** start a web server when `CI` is set. So CI must start the app (e.g. `pnpm dev` or `pnpm start` after build) and set `PLAYWRIGHT_BASE_URL` to that URL, or configure a service that serves the app on the expected base URL.

---

## 5. Env / setup requirements

| Variable | Required for profile-deals E2E | Notes |
|----------|--------------------------------|--------|
| `E2E_TEST_USER_EMAIL` | Yes (for authenticated run) | Supabase user with email/password |
| `E2E_TEST_USER_PASSWORD` | Yes (for authenticated run) | |
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Same as app |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Same as app |
| `PLAYWRIGHT_BASE_URL` | Optional | Default `http://localhost:3000`; set in CI if app runs elsewhere |
| `CI` | Set by CI | When set, auth failure in setup or sanity test fails the run (no skip) |

**Test user:** Must exist in Supabase Auth and support **email/password** sign-in (not only OAuth). Create in Supabase Dashboard → Authentication → Users, or via your app’s sign-up.

---

## 6. Remaining gaps

- **CI web server:** Config has `webServer: undefined` when `CI` is true. CI must start the app (or use an already-running URL) and point `PLAYWRIGHT_BASE_URL` at it; no automatic start in this repo.
- **Session expiry:** Stored session expires (e.g. 1 hour). Long CI runs might need a fresh session; currently global setup runs once per run.
- **Other E2E with auth:** Only profile-deals uses this storageState. Other specs that need auth would need the same or a shared auth project.
- **OAuth-only users:** If the app only supports OAuth (no email/password), this flow cannot be used unless a test user with email/password is created in Supabase for E2E.

---

## 7. Regression checklist

- [ ] With `E2E_TEST_USER_EMAIL` and `E2E_TEST_USER_PASSWORD` set, global setup writes a non-empty storageState and profile-deals tests run without skip.
- [ ] Auth sanity test fails in CI when credentials are wrong or missing (redirect to /login).
- [ ] Without credentials, profile-deals tests skip locally (no hard failure).
- [ ] Mocks for `/api/deals/mine`, `/api/reviews/mine`, and `/api/case-studies` remain in the spec; behavior is unchanged.
- [ ] `.playwright/` is gitignored; no auth state committed.
