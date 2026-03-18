# Onboarding release gate (pre–real users)

Use this checklist before inviting real users. Pair with `docs/LAUNCH_PREBOARDING_HARDENING.md` (audit summary).

## Observability

| Item | Status |
|------|--------|
| Client: `[CLIENT_ERROR]` structured logs (`GlobalErrorCapture`) | Yes |
| Optional: assign `window.__linkary_reportError = (msg) => { … }` to forward to Sentry/log drain | Ops |
| Web Vitals: `WebVitalsReporter` + `window.__linkary_vitals` | Yes |
| API: production JSON line logs for `GET /api/social/insights` (`tag: api_social_insights`, `visibility`) | Yes |

## Route QA (manual)

- [ ] **Auth** — sign in / sign out / session refresh
- [ ] **Invite-required onboarding** — new user without invite blocked as designed
- [ ] **`/app/profile`** — own profile; me-stats loads once (shared SWR key with dashboard)
- [ ] **`/app/profile/edit`** — save profile, no console errors
- [ ] **`/[username]`** — public profile; viewing someone else’s insights = snapshot only (no top followers / graphs)
- [ ] **`/app/profile/insights`** — own = full insights with auth; other user = snapshot banner + score only
- [ ] **`/app/analytics`** — owner analytics; 429 on rebuild shows “Try again after …”
- [ ] **Cross-user analytics** (`/app/analytics/profile/:user`) — 403 ineligible; **429** shows reset copy (not generic error)
- [ ] **`/app/dashboard`** — readable text (semantic tokens); org list/search OK
- [ ] **CRM** — smoke: unchanged
- [ ] **Org sourcing** — smoke: unchanged
- [ ] **Creator org-invites inbox** — smoke: unchanged
- [ ] **Analytics refresh / init-status** — no live provider on passive load; rebuild rate limit UX OK

## Regression (do not break)

| Area | Check |
|------|--------|
| CRM | List/detail actions still work |
| Org sourcing | Pipeline tab loads |
| Creator org-invites inbox | Inbox list + actions |
| Invite-required onboarding | Gate still enforced |
| Analytics refresh/status | Stored-data only on load; rebuild queues |
| Active context | No change in this pass |

## Verdict template

- **Safe to start onboarding** — if all boxes checked and no P0 bugs open.
- **Not yet safe** — list exact blockers (e.g. RLS leak, 500 on auth, broken invite gate).

---

**Suggested verdict after this hardening pass:** Safe to start **limited** onboarding if CRM/sourcing/inbox smoke passes and auth/invite flows are verified. Defer full Sentry wiring until DSN is available; use `__linkary_reportError` hook in staging first.
