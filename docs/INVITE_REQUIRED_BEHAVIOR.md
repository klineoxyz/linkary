# Invite-required behavior (apps/web)

This doc describes the **current** invite gate for the main Linkary app. Behavior is enforced in code and middleware; this document reflects that reality.

---

## Current behavior

- **First login requires invite redemption.** Every new user must enter a valid invite code before they can use the app. There is **no skip path**.
- **Access is blocked until invite is redeemed.** The API `/api/me/access` returns `allowed: true` only when:
  - The profile has `inviter_id` set (user has redeemed an invite), or
  - The user is the configured admin (by Twitter handle in profile or in auth metadata).
  Otherwise it returns `allowed: false`, `reason: 'invite_required'`.
- **Middleware enforces the invite gate for `/app` routes.** Signed-in users without a redeemed invite (no `inviter_id`) cannot access `/app/*` except `/app` itself; they are redirected to `/app` where the client shows the invite-required view or onboarding with the compulsory invite step.
- **Admin exception.** The configured admin Twitter handle (see `ADMIN_TWITTER_HANDLE` in middleware and `/api/me/access`) is always allowed without redeeming an invite.

---

## Where it’s implemented

| What | Where |
|------|--------|
| Access check | `apps/web/src/app/api/me/access/route.ts` — requires `inviter_id` or admin; no `LINKARY_INVITE_ONLY` branch. |
| Middleware gate | `apps/web/middleware.ts` — blocks `/app/*` for signed-in users without `inviter_id` (and not admin). |
| Onboarding invite step | `apps/web/src/figma/app/components/XFirstOnboarding.tsx` — invite step required when `accessAllowed !== true`; no Skip button in that case. |
| Standalone invite view | `apps/web/src/figma/app/components/InviteRequiredView.tsx` — shown when user has no access; must enter code to continue. |

---

## Summary

- First login: **invite code compulsory; no skipping.**
- Access: **allowed only after invite redemption (or admin).**
- Middleware: **enforces invite gate for /app routes.**
- Admin: **exception remains if configured.**
