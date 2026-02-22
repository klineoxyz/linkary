# Smoke testing

Minimal regression harness for critical paths. Use in CI or locally against a deployed environment.

## How to run

### Public checks only (no auth)

```bash
BASE_URL=https://your-deployed-url.com node apps/web/scripts/smoke-check.js
```

- **GET /api/health** — must return `{ ok: true, status: "ok" }`.
- **GET /** — must return 200 (or 304).

Exit code: 0 if all pass, 1 if any fail.

### With admin smoke (internal diagnostics)

Requires a Bearer token for a **superadmin** user (email in `superadmin_emails` or `SUPERADMIN_EMAILS`).

```bash
BASE_URL=https://your-deployed-url.com ADMIN_SMOKE_TOKEN=<paste-superadmin-bearer-token> node apps/web/scripts/smoke-check.js
```

- Runs the same public checks.
- **GET /api/admin/smoke** — superadmin-only; validates:
  - `analytics_jobs` table accessible
  - `x_window_aggregates` query works
  - Rate limit RPC works
  - Optional: `TEST_PROFILE_ID` / `TEST_ORG_ID` env vars to check that test entities exist

Do **not** commit real tokens. In CI, use a secret (e.g. `ADMIN_SMOKE_TOKEN`) that holds a long-lived superadmin session or create a short-lived token in a prior step.

## Required env vars

| Variable | Required | Description |
|----------|----------|-------------|
| `BASE_URL` | Yes | Base URL of the deployed app (no trailing slash). Default: `http://localhost:3000` |
| `ADMIN_SMOKE_TOKEN` | No | Bearer token for a superadmin user to run `/api/admin/smoke` |
| `TEST_PROFILE_ID` | No | Set on server for admin smoke; checks that this profile exists |
| `TEST_ORG_ID` | No | Set on server for admin smoke; checks that this org exists |

## Interpreting failures

- **GET /api/health fails** — App or DB down; check deployment and `SUPABASE_SERVICE_ROLE_KEY` / DB connectivity.
- **GET / fails** — App not serving; check build and start command.
- **GET /api/admin/smoke fails** — Unauthorized/Forbidden: token missing or not superadmin. Service/DB: check `diagnostics` in response for which check failed (`analytics_jobs`, `x_window_aggregates`, `rate_limit_rpc`).

## CI example

```yaml
- name: Smoke check
  env:
    BASE_URL: ${{ steps.deploy.outputs.url }}
    ADMIN_SMOKE_TOKEN: ${{ secrets.ADMIN_SMOKE_TOKEN }}
  run: node apps/web/scripts/smoke-check.js
```
