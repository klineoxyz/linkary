# Root cause: "Some links can't be accessed anymore"

## What broke

After shipping slug safety + SEO (safeSlug, reservedPaths single source, canonical + redirects, profile_slug_history), **any URL whose path segment is in `RESERVED_PATHS` is no longer reachable as a profile or org**, even when that segment is **owned** by a profile (username) or org (slug).

## Why

1. **Reserved check runs before resolution**  
   In `(public)/[username]/page.tsx` we do:
   - `if (isReservedPath(segmentLower)) return <AppWithProviders />`  
   So we never try to resolve the segment as a profile or org. If a user has `profiles.username = 'auth'` or an org has `slug = 'showcase'`, visiting `/auth` or `/showcase` hits the reserved check first and shows the app shell instead of the profile/org.

2. **Newly reserved words**  
   We added to `reservedPaths.ts`: `auth`, `signup`, `favicon.ico`, `robots.txt`, `sitemap.xml`, and kept/added `connections`, `watchlist`, etc. Any of these that **do not** have a static route file (e.g. `app/auth/page.tsx`) are served by the dynamic `[username]` route. So `/auth` is handled by the slug page; we treated it as reserved and returned the app shell, breaking any profile or org that had claimed that slug.

3. **Org slugs never resolved in slug branch**  
   When `kind === "slug"` we only query **profiles** (username, twitter_username). We never query **orgs** by slug. So `/acme` for an org with slug `acme` would not find a profile, then we’d check slug_history, then show NotFoundClaimView. So org root URLs like `/orgslug` were broken (or had always been broken in this branch).

## Correct behavior

- **Reserved** should mean: “this path is for the app, not for a user/org” **only when no one owns that slug**.  
- If a profile has `username = 'auth'` or an org has `slug = 'showcase'`, then `/auth` or `/showcase` should show that profile/org, not the app shell.
- So: **resolve first (profile by username, profile by twitter, org by slug, then slug_history); only if nothing is found**, then if the segment is reserved show AppWithProviders (noindex), else NotFoundClaimView.

## Minimal fix

1. **Reserved after resolution**  
   Remove the early `if (isReservedPath(segmentLower)) return <AppWithProviders />`. After trying profile (username + twitter_username), then org (slug), then slug_history, if we still have no entity: then `if (isReservedPath(segmentLower)) return <AppWithProviders />`, else `return <NotFoundClaimView />`.

2. **Resolve orgs when no profile**  
   When `!minimalRow`, before slug_history, call `getPublicEntityByUsername(segmentLower, serviceSupabase)`. If it returns an entity (e.g. org), render it via the existing entity path (e.g. PublicOnePagerWrapper). Then try slug_history redirect. Then reserved vs claim.

3. **Same order in generateMetadata**  
   In metadata, don’t return “Linkary” + noindex for reserved until we’ve tried resolution. If resolution finds a profile/org, use that for title/canonical; only when nothing is found and segment is reserved return noindex.

4. **No redirect when nothing found**  
   Slug_history redirect and twitter_username alias redirect only run when we have a concrete profile (and for alias, when matchedBy === 'twitter_username'). No change needed there; just ensure we don’t redirect on “unknown” segments.

## What stays the same

- Reserved slug **protection at claim time** (safeSlug): we still never allow claiming a reserved slug as a **new** slug; we only allow **existing** owners to keep being reachable at that path.
- Canonical URL remains `https://linkary.xyz/<profiles.username>` (or org slug) when we show a profile/org.
- Alias redirect: when we **do** find a profile by twitter_username and segment !== profiles.username, we 308 (permanentRedirect) to profiles.username.
- Old slug redirect: when we find a row in profile_slug_history for the segment, we 308 (permanentRedirect) to current profiles.username.
- Reserved segments that are **unclaimed** still show AppWithProviders with noindex.

## Acceptance (after fix)

- `/dashboard`, `/xspaces`, `/analytics` still load (static routes).
- `/<profiles.username>` loads the public profile.
- `/<twitter_username>` (when different from username) 308s to `/<profiles.username>` (permanentRedirect).
- `/<old_slug>` in profile_slug_history 308s to `/<profiles.username>` (permanentRedirect).
- `/<org_slug>` loads the org (when we add org resolution).
- If a profile/org **owns** a segment that is in RESERVED_PATHS, that URL shows the profile/org (not app shell).
- Unknown slug (no profile, no org, no history) shows claim/404; if that slug is reserved, show app shell + noindex.

## Fix applied

1. **Reserved-after-resolution** in `(public)/[username]/page.tsx`: removed early `if (isReservedPath(segmentLower)) return <AppWithProviders />`. Reserved is only applied when no profile, org, or slug_history match.
2. **Org resolution** when no profile: when `!minimalRow`, we call `getPublicEntityByUsername(segmentLower, serviceSupabase)` and render org (or published profile) via `PublicOnePagerWrapper` before trying slug_history.
3. **generateMetadata**: resolution (getPublicEntityByUsername) runs first; noindex for reserved only when entity is null.
4. **Debug logs** (development + `?debug=1`): pathname, reserved, kind; resolver (profile / org_or_published_profile); redirect=slug_history or redirect=alias with from/to.

See **SLUG_ROUTING_TEST_CHECKLIST.md** for the test checklist to run before deploy.
