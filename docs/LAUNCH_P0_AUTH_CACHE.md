# Launch Readiness P0: Auth + ISR Caching Hardening

## Risk

Public profile pages (`/{username}`) use **ISR** (`revalidate = 300`). The HTML is cached and can be served to any visitor.

If we render **user-specific auth state** (e.g. “Post a gig” vs “Sign in to post a gig”) on the server using the **requesting user’s session**, that state can be **cached into the HTML**. The next visitor might receive HTML that was generated for a logged-in user and see authenticated CTAs even though they are not logged in (or the reverse: a logged-in user gets cached “Sign in” from a previous anonymous request). That is a **privacy/UX bug** and can confuse users.

## Goal

- **Public profile HTML is identical for all visitors** (except owner-only unpublished gating, which is already correct).
- **ActionBar** still shows the right CTAs:
  - **Initial render (cached HTML):** Always unauthenticated labels/links (“Sign in to contact”, “Sign in to post a gig”).
  - **After hydration:** Client-side session check; if the user is logged in, switch to authenticated CTAs (“Request collab”, “Post a gig”) without layout jump.

No change to publish gating, views, SEO, or public profile data. No new DB or public endpoints.

## Fix (summary)

1. **Stop using server session for ActionBar**  
   Do **not** call `getUser()` / `getSession()` on the server for the public profile page. Do **not** pass `isAuthenticated` from server into the cached HTML.

2. **Always emit unauth ActionBar from server**  
   The page always renders `PublicProfileContent` without passing auth (or with `isAuthenticated={false}`). So cached HTML always contains the unauthenticated CTA labels and links.

3. **Upgrade auth client-side only**  
   `ActionBar` is a client component. It:
   - Renders the same unauth CTAs on first paint (matches server HTML).
   - In `useEffect`, calls `supabase.auth.getSession()`.
   - Updates local state when a session exists and re-renders with authenticated labels/links.

So **auth state never affects the cached document**; it only changes after JavaScript runs in the browser.

## Files changed

| Path | Change |
|------|--------|
| `apps/web/src/app/(public)/[username]/page.tsx` | Removed server-side `createServerSupabase` + `getUser()` and removal of `isAuthenticated` from props passed to `PublicProfileContent`. Page no longer passes any auth to the cached tree. |
| `apps/web/src/app/(public)/[username]/ActionBar.tsx` | Added client-only auth: `useState(false)` + `useEffect` calling `supabase.auth.getSession()`, then `setAuthed(!!session)`. CTA labels/links use `authed` instead of server-passed `isAuthenticated`. Prop `isAuthenticated` kept for API compatibility but deprecated and not used (server must not send auth). |

`PublicProfileContent` still accepts optional `isAuthenticated` (default `false`). The slug page simply no longer passes it, so the default is used and the server-rendered HTML is always unauth.

## Verification

- **Caching:** Page has `export const revalidate = 300`. No cookies/session in the slug branch that would force dynamic rendering for the public payload.
- **Incognito:** Open a public profile → CTAs show “Sign in to …”.
- **Signed-in:** Open the same profile while logged in → After load, CTAs update to “Request collab” / “Post a gig” (no full layout jump).
- **Cache safety:** Cached HTML does not depend on who requested it; auth is only applied in the client after session check.
