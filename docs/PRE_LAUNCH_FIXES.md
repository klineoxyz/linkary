# Pre-Launch Fix Pack (A–D)

Applied fixes from `PLATFORM_AUDIT_A_TO_Z.md` for controlled beta launch.

---

## A) Verified gigs in Linkary score (me-stats)

- **Done:** `GET /api/profile/me-stats` computes `verifiedGigsCount` (deals where `profile_id = user.id` and `status = 'completed'`) and passes it into `computeLinkaryPower`. Response includes `verifiedGigsCount`. In-code comment documents manual verification query and expected behavior (no double counting).
- **Optional:** `caseStudyDeltas` is left as TODO in me-stats (no schema for case_studies.metrics delta yet).
- **Acceptance:** Completing a deal increases Linkary Power in me-stats; no double counting; response includes `verifiedGigsCount`.

---

## B) Notify invitee on ambassador/affiliate invites

- **Done:**
  - **POST /api/orgs/[orgId]/ambassadors/invite** — body `{ profile_handle }` or `{ profile_id }`. Creates or re-opens invite; calls `createNotification(invitee, "ambassador_invite", { entity_type: "org", entity_id: orgId, payload: { org_id: orgId } })` only when a new invite row is created or status goes from removed → invited.
  - **POST /api/orgs/[orgId]/affiliates/invite** — same for affiliates with `"affiliate_invite"`.
  - De-duplication: if row already exists with status `invited`, returns `{ ok: true, alreadyInvited: true }` and does **not** create a notification.
  - Figma **OrgDetailPage** now uses these API routes instead of calling `inviteAmbassadorByHandle` / `inviteAffiliateByHandle` from the client (so notifications are sent from the server).
  - **Deep links:** In figma App.tsx, `ambassador_invite` and `affiliate_invite` notification types map to `/org/{orgId}?tab=ambassadors` and `/org/{orgId}?tab=affiliates` (using `payload.org_id` or `entity_id`).
- **Acceptance:** Invitee gets an in-app notification when invited; no duplicate notifications for re-invites; notification click opens the correct org tab.

---

## C) OAuth redirect safety

- **Done:**
  - **GET /api/auth/safe-redirect-url** — query params: `?next=/path` (post-login destination) or `?for=callback` (OAuth callback URL). Returns `{ redirectUrl }` with host taken from **AUTH_REDIRECT_ALLOWLIST** (comma-separated hostnames) or, if empty/invalid, from **NEXT_PUBLIC_SITE_URL** or fallback `https://www.linkary.xyz`. Never uses client-supplied host.
  - **Auth callback** (`/auth/callback`): Builds post-login redirect by calling the safe-redirect API with `next=...` and uses the returned `redirectUrl` for all redirects.
  - **OAuth initiation:** Production entry points (figma LoginPage, OnboardingPage, OrgDetailPage connect X, IntegrationsPage) fetch `/api/auth/safe-redirect-url?for=callback` and use the returned URL as `redirectTo`. Production app is `AppWithProviders` → LinkaryApp (figma), so these are the live paths.
- **Required env (document for deploy):**
  - **AUTH_REDIRECT_ALLOWLIST** — Comma-separated hostnames allowed for OAuth and post-login redirect. Example: `linkary.xyz,www.linkary.xyz,linkary.vercel.app`. If unset or host not in list, fallback is **NEXT_PUBLIC_SITE_URL** (if valid) or `https://www.linkary.xyz`.
  - **Local dev:** Add `localhost,localhost:3000` to the allowlist or set **NEXT_PUBLIC_SITE_URL** to `http://localhost:3000` and ensure that host is allowlisted.
- **Acceptance:** OAuth redirect only targets allowlisted hosts; misconfigured origin does not redirect users off-domain; login works in dev and prod when env is set.

---

## D) Remove silent analytics init failures

- **Done:**
  - **Auth callback:** Replaced `.catch(() => {})` on post-login-bootstrap and refresh-scores with `console.error(...)`. ensure-backfill failures log `[ANALYTICS_INIT_FAILED] ensure-backfill` with status and body. analytics_failed message includes API `reason`/`message`; **handleRetryAnalytics** shows error or RATE_LIMITED message.
  - **ensure-backfill route:** Server logs `[ensure-backfill]` with `profile_id` and reason when returning `no_service_key`, `profile_not_found`, `no_x_handle`, or `insert_failed`.
  - **Figma App.tsx:** ensure-social-x and ensure-backfill use `.catch((err) => console.error("[ANALYTICS_INIT_FAILED] ...", err))`.
  - **IntegrationsPage:** ensure-social-x fetch logs on catch.
  - **PublicOnePagerWrapper** (production public profile): ensure-backfill failure and catch now call `console.error("[ANALYTICS_INIT_FAILED] ensure-backfill (PublicOnePager)", ...)` so production profile view does not swallow errors.
- **Acceptance:** No swallowed analytics init errors; failures visible in console and in UI; RATE_LIMITED + resetAt behavior unchanged.

---

## Verification checklist

- [ ] **Build:** Run `pnpm run build` — must pass.
- [ ] **A – Score:** Complete one deal as creator → call `GET /api/profile/me-stats` → `verifiedGigsCount` and score reflect the completed deal.
- [ ] **B – Invite:** As org admin, invite a profile as ambassador/affiliate → invitee receives an in-app notification; click opens org tab; invite same profile again → no duplicate notification.
- [ ] **C – OAuth:** Sign in with X from login/onboarding → redirect goes to allowlisted host only; set a wrong host in allowlist and confirm redirect falls back to safe host.
- [ ] **D – Analytics:** Force analytics init failure (e.g. no X handle or rate limit) → user sees banner/message with reason; retry shows error; server and client logs show `[ANALYTICS_INIT_FAILED]` or `[ensure-backfill]`.
