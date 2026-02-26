# Public slug resolve – verification

## How session reading works

- **Resolve API** (`GET /api/public/resolve?slug=...`) uses `createServerSupabase()` from `@/lib/supabase/server`, which builds a Supabase client with `cookies()` from `next/headers`. In a Route Handler, that is the **incoming request’s** cookies.
- The **slug page** (server component) calls the resolve API with the **current request’s** cookies: `Cookie: cookieStore.getAll().map(...).join("; ")`. So the same cookies the browser sent for `/{slug}` are sent to `/api/public/resolve`.
- Session is stored in cookies after login via `POST /api/auth/set-session` (called from the auth callback with `access_token` and `refresh_token`). So once the user has logged in at least once after that flow exists, the resolve API sees the session and can return `owner_unpublished` when the slug matches the owner’s `username` or `twitter_username`.

## Verification steps

1. **Logged out: `/muazxinthi` → claim**  
   Do not send cookies (incognito or logged out). Expect “This link isn’t set up yet” / “Claim this username”.

2. **Logged in as owner: `/muazxinthi` → owner_unpublished**  
   Log in with X so that `profile.twitter_username` (or `profile.username`) is `muazxinthi` and profile is not published. Visit `/muazxinthi`. Expect “This is your Linkary page” / “Not published yet” with Edit profile, Go to dashboard, Publish.

3. **Published profile: `/muazxinthi` → public profile**  
   Publish the profile (e.g. set `published = true`). Visit `/muazxinthi`. Expect full public profile (PublicProfileContent).

4. **Other logged-in user: `/muazxinthi` → claim (unless published)**  
   Log in as a different user. Visit `/muazxinthi`. Expect claim screen (not owner_unpublished).

## Dev-only debug

In development, the resolve response may include `debug: { hasSession: boolean, matched: "username" | "twitter_username" | null }` to confirm session and which handle matched. No PII.
