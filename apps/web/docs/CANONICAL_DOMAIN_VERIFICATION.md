# Canonical domain verification

**Canonical host:** `linkary.xyz` (apex, no www). All traffic from `www.linkary.xyz` is redirected with **308** to the apex so auth session cookies work on a single host.

## Verification steps (PR / deploy)

1. **Log in on canonical domain**
   - Open `https://linkary.xyz` and sign in with X.
   - Confirm session is established (e.g. profile/settings visible).

2. **Owner sees unpublished/publish flow (not Claim)**
   - While logged in, open `https://linkary.xyz/muazxinthi` (or your username).
   - If your profile is unpublished: you must see the **unpublished / publish** flow (e.g. “Your profile isn’t public yet” or similar), **not** “Claim this username”.

3. **www redirects to apex and session is preserved**
   - Open `https://www.linkary.xyz/muazxinthi`.
   - Browser should **308 redirect** to `https://linkary.xyz/muazxinthi`.
   - After redirect, you must still be recognized as the owner (unpublished/publish flow, not Claim).

4. **Other users’ profiles and privacy**
   - Open `https://linkary.xyz/someotheruser` (or a non-existent slug).
   - You must see either the **public profile** (if it exists and is published) or **not found / claim** (no private data leaked).

## Config hygiene (production)

- **NEXT_PUBLIC_SITE_URL**: set to `https://linkary.xyz` (no trailing slash). Used for auth callback and redirects.
- **Supabase Dashboard → Auth → URL configuration**: Site URL = `https://linkary.xyz`; Redirect URLs include `https://linkary.xyz/auth/callback` and `https://linkary.xyz/**`.
- **AUTH_REDIRECT_ALLOWLIST** (optional): include `linkary.xyz` so safe-redirect-url allows the canonical host. If unset, fallback is `https://linkary.xyz`.

## Why apex (no www)

- Auth session cookies are scoped by host. `www.linkary.xyz` and `linkary.xyz` are different hosts, so a cookie set on one is not sent to the other.
- Redirecting www → apex (308) ensures all traffic and all cookies use one host, so `/username` consistently sees the session and shows owner flow when applicable.
