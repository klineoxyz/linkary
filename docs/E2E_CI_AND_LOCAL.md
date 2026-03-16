# Playwright E2E — CI and local run guide

How to run Linkary’s Playwright suite locally and in CI, including the authenticated flows.

---

## Required secrets (CI)

Configure these in your CI (e.g. GitHub Actions → Settings → Secrets and variables → Actions):

| Secret | Description |
|--------|-------------|
| `E2E_TEST_USER_EMAIL` | Supabase test user email (email/password sign-in). |
| `E2E_TEST_USER_PASSWORD` | Supabase test user password. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL (same as app). |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key (same as app). |

If any of these are missing in CI, **global setup fails** with a clear error listing the missing vars. The test user must exist in Supabase Auth and support **email/password** sign-in (create in Dashboard → Authentication → Users if needed).

---

## Required env vars (local)

For **authenticated** E2E locally, set (e.g. in `apps/web/.env.local` or your shell):

- `E2E_TEST_USER_EMAIL`
- `E2E_TEST_USER_PASSWORD`
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional:

- `PLAYWRIGHT_BASE_URL` — default `http://localhost:3000`. Set if the app runs elsewhere.
- `PLAYWRIGHT_NO_WEB_SERVER=1` — do not start the dev server; use when the app is already running.

Without auth vars, global setup writes an **empty** storage state; authenticated specs may redirect to login and **skip** (no hard failure locally).

---

## How auth storageState is created

1. **Global setup** runs once before any test (no browser, no dev server required for this step).
2. It loads `.env.local` from `apps/web` or repo root if present.
3. If `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, and both Supabase vars are set:
   - It calls Supabase `signInWithPassword()` to get a session.
   - It builds Playwright **storageState** JSON: one origin (from `PLAYWRIGHT_BASE_URL` or default) and a single `localStorage` entry with the Supabase auth key (`sb-<project-ref>-auth-token`) and session payload.
   - It writes `.playwright/e2e-auth-state.json` under `apps/web` (cwd when running from `apps/web`).
4. **In CI:** If any of the four vars are missing or sign-in fails, global setup **throws** with a clear message. No empty state is used in CI for auth specs.
5. The **authenticated** Playwright project uses this file as `storageState`; all auth-required specs share it.

---

## Local run instructions

All commands below are from **`apps/web`** unless noted.

**Full suite (chromium + authenticated, with dev server started by Playwright):**

```bash
cd apps/web
pnpm run test:e2e
```

**Full suite with app already running (e.g. `pnpm dev` in another terminal):**

```bash
cd apps/web
PLAYWRIGHT_NO_WEB_SERVER=1 pnpm run test:e2e
```

**Only authenticated specs** (requires auth env vars; otherwise tests may skip):

```bash
cd apps/web
pnpm run test:e2e -- --project=authenticated
```

**Only chromium (unauthenticated) specs** (no auth needed):

```bash
cd apps/web
pnpm run test:e2e -- --project=chromium
```

**Single spec file:**

```bash
cd apps/web
pnpm run test:e2e -- e2e/profile-deals-trust-loop.spec.ts
pnpm run test:e2e -- --project=chromium e2e/profile-analytics-review.spec.ts
```

**List what would run (no execution):**

```bash
cd apps/web
pnpm exec playwright test --list
pnpm exec playwright test --list --project=authenticated
pnpm exec playwright test --list --project=chromium
```

---

## CI run instructions

The workflow **`.github/workflows/playwright.yml`**:

1. Checkout, setup Node 20, enable pnpm, `pnpm install --frozen-lockfile`.
2. Install Playwright browsers (chromium only): `cd apps/web && pnpm exec playwright install --with-deps chromium`.
3. Start the Next.js dev server in the background and wait for `http://localhost:3000` (via `wait-on`).
4. Run Playwright from `apps/web` with:
   - `PLAYWRIGHT_BASE_URL=http://localhost:3000`
   - `CI=true`
   - The four secrets passed as env vars.

**Trigger:** On push and pull_request to `main` / `master`.

**Required:** All four secrets must be set. If they are missing, the run fails in **global setup** with an error like:

`E2E auth setup failed in CI: missing required env (secrets) — E2E_TEST_USER_EMAIL, ...`

If credentials are wrong (e.g. user doesn’t exist or no email/password), global setup fails with:

`E2E auth setup failed in CI: <Supabase error>. Ensure E2E_TEST_USER_EMAIL and E2E_TEST_USER_PASSWORD are valid ...`

---

## Common failure reasons

| Symptom | Likely cause | What to do |
|--------|----------------|------------|
| **CI: “missing required env (secrets)”** | One or more of the four secrets not set in the workflow. | Add `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` as repo/organization secrets. |
| **CI: “E2E auth setup failed in CI: … no session” / invalid login** | Wrong credentials or test user not set up for email/password. | Create/use a Supabase user with email+password; ensure secrets match. |
| **Local: authenticated tests skip or redirect to /login** | Auth env vars not set or not loaded. | Set the four vars in `apps/web/.env.local` (or export in shell) and re-run. |
| **“net::ERR_CONNECTION_REFUSED” or “ERR_CONNECTION_RESET”** | App not running at base URL. | Start the app (`pnpm dev` from `apps/web`) or run without `PLAYWRIGHT_NO_WEB_SERVER` so Playwright starts it. If using a different URL, set `PLAYWRIGHT_BASE_URL`. |
| **Timeout waiting for server** | Dev server slow to start or port in use. | Increase timeout in workflow or locally; ensure port 3000 is free. |
| **Chromium not found** | Browsers not installed. | Run once: `cd apps/web && pnpm exec playwright install --with-deps chromium`. |

---

## Naming and config summary

- **Auth state file:** `.playwright/e2e-auth-state.json` (under `apps/web` when running from there). Gitignored via `.playwright/`.
- **Projects:** **chromium** = unauthenticated specs; **authenticated** = auth specs using the shared storageState.
- No product logic or auth boundaries are changed by this setup; tests are deterministic and use mocks where documented.
