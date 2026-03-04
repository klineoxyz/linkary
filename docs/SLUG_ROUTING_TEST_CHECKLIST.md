# Slug routing & SEO — test checklist before deploy

Run these checks after any change to `(public)/[username]/page.tsx`, `reservedPaths.ts`, `middleware.ts`, or claim/slug logic.

## 1. Static app routes (no regression)

| URL | Expect |
|-----|--------|
| `/dashboard` | Loads dashboard page (no redirect loop) |
| `/xspaces` | Loads xspaces page |
| `/analytics` | Loads analytics page |
| `/calendar` | 308 redirect to `/xspaces` |

## 2. Profile by canonical slug

| URL | Expect |
|-----|--------|
| `/<profiles.username>` | Public profile page; canonical = `https://linkary.xyz/<profiles.username>` |

## 3. Alias redirect (twitter_username → username)

| URL | Expect |
|-----|--------|
| `/<profiles.twitter_username>` when ≠ username | **301** to `/<profiles.username>`; only when profile exists and twitter_username matches and username differs |

Do **not** redirect when profile not found or when segment already equals username.

## 4. Old slug redirect (profile_slug_history)

| Step | Action |
|------|--------|
| 4a | Pick one profile; change slug once (claim flow or RPC) |
| 4b | Confirm `profile_slug_history` has one row (old_slug, new_slug) |
| 4c | Visit `/<old_slug>` | **301** to `/<profiles.username>` |

## 5. Org root URL

| URL | Expect |
|-----|--------|
| `/<org.slug>` | Org one-pager loads (same namespace as profiles) |

## 6. Reserved segment behavior

| URL | Condition | Expect |
|-----|-----------|--------|
| `/<reserved>` | Reserved and **no** profile/org owns it | App shell (AppWithProviders); metadata noindex |
| `/<reserved>` | Reserved but **profile or org owns** it | Profile or org page (not app shell) |

Example: if a profile has `username = 'auth'`, then `/auth` must show that profile, not the app shell.

## 7. Unknown slug

| URL | Expect |
|-----|--------|
| `/<random>` | Claim/404 (NotFoundClaimView); no redirect loop |

## 8. SEO

| Check | Expect |
|-------|--------|
| Profile page canonical | Always `https://linkary.xyz/<profiles.username>` (or org slug for orgs) |
| Reserved app shell | `robots: noindex, nofollow` when segment is reserved and unclaimed |
| Redirects | 301/308 for alias and old-slug; no 302 for these |

## 9. Debug (optional)

With `?debug=1` in development, server logs should include:

- `[slug-page]` pathname, segmentLower, reserved, kind
- `resolver=profile` with matchedBy when profile found
- `resolver=org_or_published_profile` when entity from getPublicEntityByUsername
- `redirect=slug_history` or `redirect=alias` with from/to when redirect fires

## Final safety smoke tests (script)

Run: `BASE_URL=<url> [OLD_SLUG=... NEW_SLUG=...] [TWITTER_HANDLE=... EXPECT_REDIRECT_TO=...] pnpm run verify:slug-routing-live`

| Check | Env | Expect |
|-------|-----|--------|
| Slug history redirect | OLD_SLUG, NEW_SLUG | 308 from /old_slug to /new_slug |
| Reserved unowned noindex | (default: /auth) | 200 + robots noindex |
| No redirect loops | — | /dashboard, /auth, /nonexistent-slug-xyz each resolve in ≤5 hops, no loop |
| Alias redirect | TWITTER_HANDLE, EXPECT_REDIRECT_TO | /twitter_handle → 308 → /canonical |
| Canonical slug no redirect | (same) | /canonical returns 200 (alias only when segment ≠ canonical) |

Alias redirect must only happen when matchedBy=twitter_username and segment ≠ canonical username; the script verifies both /twitter_handle → 308 and /canonical → 200.

## Quick run (manual)

1. Open `/dashboard`, `/xspaces`, `/analytics` — all load.
2. Open `/<your_username>` — profile loads; canonical in `<link rel="canonical">` is correct.
3. If you have twitter_username ≠ username, open `/<twitter_username>` — 301 to `/<username>`.
4. Open `/<nonexistent>` — claim/404.
5. Open `/<reserved_word>` (e.g. `/auth`) with no owner — app shell; if a profile owns `auth`, `/auth` shows that profile.
