# Beta launch checklist

Use this on launch day for invited beta. Complete in order.

## Pre-launch (before opening to beta users)

- [ ] **Migrations** — All required Supabase migrations applied (see `docs/INVITED_BETA_LAUNCH_PASS.md` § Migrations). Run `supabase db push` or apply listed migrations in order.
- [ ] **Web app env** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SITE_URL` (or `NEXT_PUBLIC_APP_URL` where used), `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` (production), `CRM_APP_URL`, `CRM_SYNC_SECRET` (for Linkary → CRM sync after accept).
- [ ] **CRM app env** — Same Supabase URL/anon key as web; `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz`; `CRM_SYNC_SECRET` (must match web); `NEXT_PUBLIC_APP_URL` (Linkary base URL for auth redirect); optionally `SUPABASE_SERVICE_ROLE_KEY` for sync API.
- [ ] **Supabase** — Auth redirect URLs include production Linkary URL and CRM URL (e.g. `https://linkary.xyz/auth/callback`, `https://crm.linkary.xyz/auth/callback`).
- [ ] **Smoke test** — Log in on Linkary; open profile, org page, create sprint with campaign fields; accept an application; confirm CRM tasks appear and campaign context is visible.

## Launch

- [ ] Deploy web app (linkary.xyz) and CRM app (crm.linkary.xyz) with env above.
- [ ] Verify login works on both domains (shared session if cookie domain is set).
- [ ] Run route smoke: `/{username}`, `/org/[slug]`, `/app/analytics/org/[slug]` redirect, `/app/profile`, `/app/analytics`, CRM `/tasks`, `/campaigns`.
- [ ] Send invite to first beta cohort with link to Linkary and CRM and short “start here” note.

## Post-launch (first 24–48h)

- [ ] Monitor for 404s or “Org not found” on known-good org slugs.
- [ ] Monitor for “Could not create your workspace” on CRM `/tasks`.
- [ ] Check CRM sync: accept one application and confirm task + campaign appear in CRM.
- [ ] Have `docs/BETA_SUPPORT_TROUBLESHOOTING.md` to hand for support.
