# Canonical domain verification

**Canonical host:** `linkary.xyz` (apex, no www). Auth and redirect URLs use this host so session cookies work on a single host.

**Middleware** redirects `www.linkary.xyz` → `linkary.xyz` (308) so the session cookie (set on apex) is sent and `/username` shows the owner flow instead of "Claim". **If you see ERR_TOO_MANY_REDIRECTS:** In Vercel Domains, set **linkary.xyz** as primary and do **not** redirect apex to www; add **www.linkary.xyz** with "Redirect to linkary.xyz".

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
- **Vercel Domains** (to avoid redirect loops): Set **linkary.xyz** as the primary domain (no redirect). Add **www.linkary.xyz** and set it to **Redirect to linkary.xyz**. Do not set "Redirect linkary.xyz to www" or you will get ERR_TOO_MANY_REDIRECTS when middleware was also redirecting www → apex.

## Why apex (no www)

- Auth session cookies are scoped by host. `www.linkary.xyz` and `linkary.xyz` are different hosts, so a cookie set on one is not sent to the other.
- Redirecting www → apex (308) ensures all traffic and all cookies use one host, so `/username` consistently sees the session and shows owner flow when applicable.
