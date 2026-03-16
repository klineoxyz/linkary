# Final launch gate and checklist

Single source of truth for staging verification and production release: deployment gate, smoke tests, env, migrations, and go/no-go.

---

## 1. Release gate — commands that must pass before deploy

Run from **`apps/web`**. All must succeed for a **go** to production.

| Step | Command | Purpose |
|------|---------|---------|
| 1 | `pnpm run build` | Next.js production build. |
| 2 | `pnpm test:route` | Vitest: route + payload tests (public profile, deals, work, reviews, case-studies, collab convert, me/analytics/profile, buildPublicProfilePayload). |
| 3 | `pnpm run test:profile-analytics` | Script-style lib tests: crossUserAnalyticsAllowlist, profileRedirect, appRouting, reviewsContract. |

**Single gate command (all three in sequence):**

```bash
cd apps/web
pnpm run release:gate
```

**Optional (staging / CI):**

| Step | Command | Purpose |
|------|---------|---------|
| 4 (optional) | `pnpm run test:e2e` | Full Playwright suite. For authenticated specs set `E2E_TEST_USER_EMAIL`, `E2E_TEST_USER_PASSWORD`, `NEXT_PUBLIC_SUPABASE_*`. See E2E_CI_AND_LOCAL.md. |
| 4b (optional) | `pnpm run test:e2e -- --project=authenticated` | Authenticated Playwright only (profile/deals, work, collab, public profile proof). |

**Go:** Proceed to deploy only if `release:gate` (and optionally E2E) passes.  
**No-go:** Fix failures before deploying.

---

## 2. Staging smoke-test checklist

Use this on **staging** after deploy (or before production). Check each item manually or via E2E where applicable.

### 2.1 Public and landing

- [ ] **Landing** — Open `/` → landing page loads; no 500.
- [ ] **Public profile** — Open `/{published_username}` → profile loads; no `deal_id`/`gig_deal_id` in DOM or in `GET /api/public/profile?username=...` response; proof signals (Verified, From verified work, From completed work) when data exists.
- [ ] **robots.txt** — `GET /robots.txt` → disallow includes `/app`, `/profile`, `/analytics`, `/deal`, `/settings`, `/api`, `/auth`, `/login`, `/dashboard`, `/u`; allow `/`; sitemap and host present.
- [ ] **sitemap.xml** — `GET /sitemap.xml` → includes homepage and published profiles/orgs (or minimal list if DB empty).
- [ ] **noindex on internal pages** — Open `/app/profile`, `/analytics`, `/profile/deals`, `/login` → view source or inspect response; `<meta name="robots" content="noindex,...">` (or equivalent) present.

### 2.2 Auth and profile

- [ ] **Sign in** — Sign in (email/password or configured provider) → redirect to app or intended destination; session persists.
- [ ] **/app/profile** — Authenticated → open `/app/profile` → profile snapshot loads (no duplicate deep analytics).
- [ ] **/app/profile/edit save** — Edit display name or bio → Save → change persists; no 4xx/5xx.

### 2.3 Analytics

- [ ] **/analytics** — Authenticated → open `/analytics` → page loads (X analytics or “Connect X” message); no 500.
- [ ] **/app/analytics/profile/[username]** — As eligible user, open `/app/analytics/profile/{other_username}` → allowlisted analytics only; 403 or redirect when not eligible.

### 2.4 Discovery and work surfaces

- [ ] **/explore** — Open `/explore` → discovery/explore loads; noindex.
- [ ] **/profile/deals** — Authenticated → open `/profile/deals` → deals list; CTAs (Complete, Leave review, Create case study) match deal status.
- [ ] **/profile/work** — Authenticated → open `/profile/work` → completed work list; review/case study actions correct.

### 2.5 Trust loop

- [ ] **Collab convert** — As target, accept collab → Convert to verified work → deal appears on `/profile/deals`; complete deal → appears on `/profile/work`; review and case study CTAs unlock.
- [ ] **Review flow** — After completing a gig deal, Leave review → submit → review appears; no review before completion.
- [ ] **Case study creation** — From completed work, Create case study → save → case study links to deal/gig_deal; no private IDs on public profile.

### 2.6 State to preserve (no regression)

- [ ] **Analytics ownership** — Only `/analytics` shows deep analytics; Profile shows snapshot + “See full analytics” link.
- [ ] **Public profile canonical** — Public profile remains `/{username}`; no redirect to a different URL for published profiles.
- [ ] **Privacy** — No `deal_id`, `gig_deal_id`, `collab_request_id`, `converted_gig_deal_id` in public API or DOM.
- [ ] **No fake proof** — Reviews only after completed verified work; case studies only from completed deal/gig_deal when caller is party.

---

## 3. Required env vars and secrets

### 3.1 App runtime (required for launch)

| Var | Description |
|-----|-------------|
| `NEXT_PUBLIC_APP_URL` | Canonical app URL (e.g. `https://linkary.xyz`). Sitemap, robots, canonicals. |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon key. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side Supabase (public profile, sitemap, analytics, work/deals APIs). |

### 3.2 Supabase

- Same as above: project URL, anon key, service role key. Ensure RLS and migrations are applied for the project.

### 3.3 Optional — authenticated Playwright (staging/CI)

| Var | Description |
|-----|-------------|
| `E2E_TEST_USER_EMAIL` | Test user email (email/password). |
| `E2E_TEST_USER_PASSWORD` | Test user password. |
| `NEXT_PUBLIC_SUPABASE_URL` | Same as app. |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same as app. |

See **E2E_CI_AND_LOCAL.md** for full E2E setup.

### 3.4 Optional — features (required only if used at launch)

| Var | Purpose |
|-----|---------|
| `X_CLIENT_ID`, `X_OAUTH_COOKIE_SECRET` | X (Twitter) OAuth connect. |
| `CRON_SECRET` | Cron routes (e.g. xspaces-stats, sync-x-profiles-daily). |
| Billing / Stripe | If billing is enabled at launch. |
| `E2E_FIXTURE_USERNAME` | E2E public profile proof fixture (e.g. `e2e-proof-fixture`). |

---

## 4. Migration and deploy order

### 4.1 Migrations

- Apply **Supabase migrations in timestamp order** (ascending by filename under `supabase/migrations/`).
- Trust-loop and public profile depend on: `reviews` (verified_deal, gig_deal), `case_studies` (owner_type, deal_id, gig_deal_id), `collab_requests` (converted_gig_deal_id), `profiles` (published, username), `orgs` (slug, published), and related RLS/views.
- Command (from repo root): `pnpm -w run db:push` or your Supabase CLI workflow; ensure no migrations are skipped.

### 4.2 Deploy order

1. **Staging**
   - Apply migrations to staging DB (if separate).
   - Set staging env vars (same as §3.1; use staging Supabase if separate).
   - Run `release:gate` on the branch you deploy.
   - Deploy app to staging.
   - Run staging smoke-test checklist (§2).
2. **Production**
   - Apply migrations to production DB (if not already).
   - Set production env vars and secrets.
   - Run `release:gate` on the release commit.
   - Deploy app to production.
   - Run post-deploy smoke tests (§5.3).

---

## 5. Pre-deploy, deploy, post-deploy, rollback

### 5.1 Pre-deploy

- [ ] Migrations applied (staging then production, or production only if same DB).
- [ ] Env vars and secrets set for target (see §3).
- [ ] From `apps/web`: `pnpm run release:gate` passes.
- [ ] (Optional) Playwright authenticated on staging: `pnpm run test:e2e -- --project=authenticated` with auth env set.

### 5.2 Deploy steps

- [ ] Deploy Next.js app (e.g. Vercel `vercel --prod`, or your pipeline).
- [ ] Confirm deployment URL and health (e.g. `GET /api/health` or `/`).

### 5.3 Post-deploy smoke tests

- [ ] Landing: `/` loads.
- [ ] Public profile: `/{known_username}` loads; no private IDs in API/DOM.
- [ ] Sign in works.
- [ ] `/app/profile` and `/app/profile/edit` load and save.
- [ ] `/analytics` loads.
- [ ] `/profile/deals` and `/profile/work` load when authenticated.
- [ ] `GET /robots.txt` and `GET /sitemap.xml` return expected content.
- [ ] Internal routes (e.g. `/app/profile`, `/analytics`, `/login`) are noindex.

### 5.4 Rollback notes

- **App:** Revert to previous deployment (e.g. Vercel rollback, or redeploy previous commit). No DB rollback needed for app-only revert.
- **DB:** If a migration was applied and must be reverted, use Supabase migration rollback or restore from backup; document in runbook.
- **Env:** If a bad env var was set, fix in platform and redeploy or restart.

---

## 6. Remaining non-blocking follow-ups

- Run full Playwright suite in CI with auth secrets; fix flakiness if any.
- Add discoveryValidation and entitlementDiscovery to `test:profile-analytics` if desired (currently only 4 scripts run there).
- Optional: cron jobs (e.g. sync-x-profiles-daily) and billing wiring if not already in use.

---

## 7. Go / no-go summary

| Criterion | Status |
|-----------|--------|
| **Release gate** | `pnpm run release:gate` (build + test:route + test:profile-analytics) must pass. |
| **Staging smoke** | Complete §2 checklist on staging before production. |
| **Env and migrations** | Required env (§3.1) set; migrations applied in order (§4). |
| **Post-deploy** | Run §5.3 smoke tests after production deploy. |
| **Rollback** | Procedure in §5.4; no redesign or new surfaces. |

**Go:** Gate passed, staging smoke passed, env and migrations correct, post-deploy smoke passed.  
**No-go:** Any of the above failed or incomplete; fix before production deploy.

---

## 8. Pre-staging verification (release manager sign-off)

**Verified:** Package.json `release:gate` runs `build` → `test:route` → `test:profile-analytics` in that order. No duplication: Vitest excludes the 4 script-style lib tests; they run only via `test:profile-analytics`. `test:profile-analytics` runs exactly those 4 (crossUserAnalyticsAllowlist, profileRedirect, appRouting, reviewsContract); discoveryValidation and entitlementDiscovery remain optional follow-ups. Robots/noindex: `robots.ts` disallows `/app`, `/profile`, `/dashboard`, `/analytics`, `/deal`, `/u`, `/api`, `/auth`, `/login`, `/settings`; layout noindex applied on `/app`, `/analytics`, `/profile`, `/profile/deals` (via profile layout), `/profile/insights`, `/profile/inbox`, `/profile/requests`, `/deal`, `/settings`, `/login`, `/explore`, `/app/analytics/profile/[username]`, `/u/[username]`. Doc §2 robots.txt checklist updated to include `/dashboard` and `/u`. Routes and smoke checklist match current app structure.

**Go for staging:** Proceed with staging deploy when release gate passes and env/migrations are set. No launch blocker identified.
