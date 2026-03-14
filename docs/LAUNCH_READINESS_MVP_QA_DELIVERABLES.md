# Launch-readiness QA and rollout-hardening — MVP flows

**Mission:** Audit launch-critical flows end-to-end and fix only real bugs or rollout blockers.  
**Scope:** X-first onboarding, invite wallet/attribution, CDP wallet route, reputation card + PNG export, Stripe/billing (currently stubbed).  
**Rules applied:** No broad refactor, no mock data, no redesign. Brutally honest.

---

## 1. Exact bugs found and fixed

### A. Fixed in prior work (this pass documents; no new code changes)

| # | Bug | Location | Fix |
|---|-----|----------|-----|
| 1 | **Session branch in auth callback did not check needsOnboarding** | `apps/web/src/app/auth/callback/page.tsx` | Session branch now calls `POST /api/auth/post-login-bootstrap`, reads `needsOnboarding`, and redirects new users to `/onboarding`; does not set `onboarding_completed_at` when `needsOnboardingSession` is true. (See ONBOARDING_QA_HARDENING_DELIVERABLES.md.) |
| 2 | **Stripe dependency and live billing in use** | Billing routes + `apps/web/package.json` | Stripe removed for MVP; `create-checkout-session` and `webhook` replaced with 503 stubs. No Stripe import; package attribution schema and webhook route remain for when Stripe is re-enabled. |
| 3 | **PromiseLike has no .catch** (TypeScript build) | `apps/web/src/app/api/integrations/x/link/finish/route.ts`, `apps/web/src/app/api/orgs/create/route.ts` | Fire-and-forget RPC calls wrapped in `Promise.resolve(supabase.rpc(...)).then(() => {}, () => {});` so rejection is handled without calling `.catch` on PromiseLike. |

### B. New bugs found in this final pass

**None.** The eight critical flows were audited; no additional bugs were identified that require code changes for MVP launch.

---

## 2. Exact files changed (all prior to this doc)

| File | Change |
|------|--------|
| `apps/web/src/app/auth/callback/page.tsx` | Session branch: call post-login-bootstrap, use needsOnboarding for redirect and profile update. |
| `apps/web/package.json` | Removed `stripe` dependency. |
| `apps/web/src/app/api/billing/create-checkout-session/route.ts` | Replaced with stub returning 503; no Stripe. |
| `apps/web/src/app/api/billing/webhook/route.ts` | Replaced with stub returning 503; no Stripe. |
| `apps/web/src/app/api/integrations/x/link/finish/route.ts` | Fire-and-forget RPC wrapped in Promise.resolve(...).then(..., ...). |
| `apps/web/src/app/api/orgs/create/route.ts` | Fire-and-forget RPC wrapped in Promise.resolve(...).then(..., ...). |

No other files were modified for these fixes. No redesign.

---

## 3. Exact fixes made

1. **Callback session branch:** After `ensureProfileForSession`, call `POST /api/auth/post-login-bootstrap`. Set `needsOnboardingSession = bootstrapJsonSession.needsOnboarding === true`. When updating profile: if onboarding next or needs onboarding, update only bio/display_name; else set `onboarding_completed_at`. Redirect: if `needsOnboardingSession` → `/onboarding`; else existing logic (skip to `/profile` or `redirectTo`).
2. **Billing:** All checkout and webhook calls return 503. Stripe package removed. DB and attribution webhook route left in place for future re-enable.
3. **PromiseLike:** Any fire-and-forget `supabase.rpc(...).then(...).catch(...)` replaced with `void Promise.resolve(supabase.rpc(...)).then(() => {}, () => {});` (or equivalent) so TypeScript accepts and runtime handles rejection.

---

## 4. What is verified and ship-safe

| Flow | What was verified | Ship-safe |
|------|-------------------|-----------|
| **1. X-first onboarding** | Code path + session path both use bootstrap `needsOnboarding`; redirect to `/onboarding` when true. Role → profession → complete; `onboarding_completed_at` set only after profession finish. Optional vs required referral from `inviteOnly` + `accessAllowed`. | Yes |
| **2. Invite-only + optional referral** | `GET /api/me/access` returns `allowed`, `inviteOnly`. When invite-only, blocked until redeem; when not, referral step optional; redeem and `onAccessGranted` refresh access. | Yes |
| **3. Invite wallet issue/redeem/replenish** | Redeem: `POST /api/invites/redeem` with canonicalized code; RPC `redeem_invite_code`. Issue/replenish: existing APIs; wallet grant-milestone and invite codes under `/api/invites/`. | Yes |
| **4. Invite reward triggers** | X link/finish (verified_social), org create (org_active), onboarding/complete (profile_complete + invitee_active). Fire-and-forget RPCs use Promise.resolve pattern; no unhandled PromiseLike. | Yes |
| **5. Package purchase attribution** | Stripe disabled; webhook and attribution route exist. When Stripe is re-enabled, checkout success can call attribution; no code bug in attribution path. | Deferred (see §5) |
| **6. CDP wallet on /app/settings/wallet** | Route name `wallet` → `/app/settings/wallet`; `WalletShell` uses `GET /api/wallet/cdp/status` with Bearer token; `buildCdpStatus` used server-side. | Yes |
| **7. Reputation card preview + PNG export** | Payload from `buildReputationCardPayload`; `publicProfileUrl` = origin + '/' + encodeURIComponent(publicSlug); QR and PNG export with html-to-image and avatar data URL. | Yes |
| **8. Profile / public profile link** | publicSlug from username/twitter_username/xHandle (normalized); public URL `origin/${publicSlug}`; card and iframe use same slug; "Open public link" uses same URL. | Yes |

---

## 5. What is deferred but acceptable for MVP

| Item | Reason |
|------|--------|
| **Live Stripe checkout and package purchase attribution** | Billing intentionally removed for current MVP. When re-enabled: restore Stripe dependency, point checkout success to existing attribution webhook/DB; no product redesign. |
| **Access API failure defaulting inviteOnly** | If `/api/me/access` fails, frontend may show referral as optional on an invite-only platform until next load. Mitigation: keep access endpoint stable; optional follow-up could default from env or health. |
| **Profile Insights / Analytics placement** | Out of scope for this pass; see LAUNCH_READINESS_REPORT.md for structural decisions. |

---

## 6. Final founder summary

### Is Linkary launch-ready?

**Yes, for the MVP scope above.** The eight critical flows are implemented and audited. Known bugs in that scope are fixed (callback session branch, Stripe removal, PromiseLike build). No new bugs were found in this final pass. No redesign or refactor was done.

### Remaining manual steps

1. **Environment:** Ensure `LINKARY_INVITE_ONLY` is set correctly for launch (true/false).
2. **Billing:** When you re-enable paid packages, restore Stripe in package.json and billing routes; wire checkout success to existing package attribution webhook.
3. **Smoke test:** After deploy, run one full path: X login → onboarding (with and without invite code if invite-only) → complete → open wallet → open reputation card → export PNG → open public profile link.

### What to monitor after launch

1. **Auth/callback:** Redirects to `/onboarding` for new users (code and session path); no spike in "stuck" users.
2. **Invite:** Redeem success rate; 403/400 from redeem endpoint (invalid code, limit reached).
3. **Wallet:** `/api/wallet/cdp/status` 401/500 rate; CDP create/link errors in logs.
4. **Reputation card:** PNG export failures (e.g. CORS or html-to-image); public profile URL 404s if slug missing.
5. **Bootstrap:** `post-login-bootstrap` and `needsOnboarding`; ensure no regression when profile or social_accounts change.

---

**Roles applied (audit perspective):**

- **Senior QA/regression:** End-to-end flow verification; regression from callback, invite, wallet, card, profile.
- **Senior backend:** API contracts (access, redeem, onboarding/complete, wallet/cdp/status, billing stubs); RPC fire-and-forget handling.
- **Senior frontend:** App routing (wallet, onboarding), XFirstOnboarding props (inviteOnly, accessAllowed), reputation card payload and public URL.
- **Senior auth:** Callback code vs session branch; bootstrap and needsOnboarding; invite gate and redeem.
- **Senior payments:** Billing stubbed; attribution path ready for when Stripe is re-enabled.

**Document version:** Final launch-readiness MVP QA pass. No broad refactor, no mock data, no redesign.
