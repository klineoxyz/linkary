# Linkary: Phase 6 – Remaining Links & Redirect Readiness

**Purpose:** Complete remaining internal link cleanup, document UUID-only cases, and produce a founder-facing readiness report for the redirect phase (Phase 7). No redirects are enabled in this pass.  
**Reference:** `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` Phases 6–7; Phase 5 link migration and org slug route are done.

---

## 1. What Was Migrated in Phase 6 (This Pass)

| Location | Change |
|----------|--------|
| **WatchlistPage** | Org row click: `setRoute({ name: "orgDetail", data: { orgId: o.entity_id, slug: o.slug ?? undefined } })`. Watchlist API already returns `slug` for orgs; links now prefer `/org/:slug`. |
| **OrgDetailPage** | “Copy org link”: URL changed from `${origin}/org/${org.id}` to `${origin}/org/${encodeURIComponent(org.slug ?? org.id)}` so copied links are canonical `/org/:slug` when slug exists. |
| **App.tsx** | `href="/work/requests"` → `/app/work/requests`; `href="/profile/insights"` → `/app/profile/insights`; `router.replace(…"/work/requests")` → `/app/work/requests` for login next. |
| **apps/web/src/app/debug/x-tweets/page.tsx** | `href="/analytics"` → `/app/analytics`. |
| **apps/web/src/app/profile/applications/page.tsx** | `href="/profile"` → `/app/profile`. |
| **apps/web/src/app/profile/deals/page.tsx** | `href="/profile"` → `/app/profile`. |

---

## 2. Remaining Places Still Using Old Root App Routes or `/org/:uuid`

### 2.1 Root app paths (no `/app/` prefix)

These **href** or **router** targets still point at root; they are on **public or shared** surfaces. Redirects in Phase 7 will send these to `/app/...` so behavior stays correct.

| File | Current target | Context |
|------|----------------|---------|
| **OwnerUnpublishedProfile.tsx** | `href="/profile/edit"`, `href="/profile"`, `href="/settings"` | Shown to profile owner on public `/:username` when unpublished. |
| **UnpublishedView.tsx** | `href="/dashboard"` | Public/unpublished context. |
| **PublicHeader.tsx** | `href="/dashboard"` | Public header CTA (e.g. “Dashboard”). |
| **ApplyToGigButton.tsx** | `href="/profile/applications"` | Public gig page CTA. |
| **PublicProfileContent.tsx** | `href="/profile/edit#header-media"`, `#case-studies`, `#links` | Logged-in owner on public profile; edit links. |

**Why left for Phase 7:** These are public or mixed pages. Internal app navigation already uses `/app/...` (pathFromRoute + migrated hrefs). Keeping these as root is intentional so that (a) old bookmarks and external links still hit valid routes until redirects exist, and (b) Phase 7 can add a single set of 301s from root → `/app/...` without touching these files.

### 2.2 `/org/:uuid` only (no slug available at link time)

| Location | Reason UUID remains |
|----------|---------------------|
| **Notification links (App.tsx notifLink)** | Payload has `org_id` (UUID) only. No `org_slug` in notification records. Resolving UUID→slug per notification would require an extra fetch or storing slug when creating notifications. **Decision:** Keep `/org/${n.payload.org_id}`; route still works (OrgDetailPage resolves by UUID). |
| **API routes** | All `/api/orgs/[orgId]/...` use UUID by design (auth and RLS are keyed by org id). No change. |
| **OAuth / connect-x-callback** | Uses `orgId` in body/session; backend looks up org by id. No URL exposed to user here. |
| **Deal/application flows** | Some `org_id` references in payloads; links already use `/org/:id` where slug is not in payload. |

**Temporary:** Notification (and any future) payloads could be extended to include `org_slug` when the notification is created, so future links can use `/org/:slug`. Until then, UUID links are valid and resolve correctly.

---

## 3. Search / Link Behavior Consistency

| Intent | User/profile | Org | Notes |
|--------|--------------|-----|--------|
| **Public discovery / share** | `/:username` (canonical) | `/:slug` (canonical) | Sitemap, OG, copy link. Unchanged. |
| **In-app people** | `/u/:username` | — | Search API person result `url: /u/:username`. Unchanged. |
| **In-app org** | — | `/org/:slug` | Search API org result `url: /org/:slug`. Phase 5. |
| **App pages** | — | — | Nav and pathFromRoute use `/app/dashboard`, `/app/profile`, etc. Phase 5 + Phase 6. |
| **Org in-app links** | — | `/org/:slug` when slug known; `/org/:uuid` when only id (notifications, etc.) | Both resolve; slug preferred for new links. |

**Conclusion:** Public vs in-app and app vs old root are consistent: public stays at root; in-app app pages use `/app/...`; in-app org uses `/org/:slug` where we have slug, and `/org/:uuid` still works where we don’t.

---

## 4. Is It Safe to Enable Redirects Next?

**Yes, with the recommended list below.**

- **Internal navigation** already targets `/app/...` and `/org/:slug` where slug exists.
- **Root app routes** (`/dashboard`, `/profile`, etc.) still exist and work; adding 301 to `/app/...` will send old links and bookmarks to the correct pages.
- **Public routes** (`/:username`, `/:slug`) are unchanged; no redirects from them.
- **Org route** accepts both UUID and slug; no need to redirect `/org/:uuid` → `/org/:slug` unless we want to canonicalize (optional, can be Phase 7 or later).

**Risks to manage in Phase 7:**

- **Auth redirect URLs:** Ensure `next` and safe-redirect allowlist include `/app/...` (and already do if they allow path-based next).
- **External links / emails:** Any hardcoded root app URLs (e.g. in emails) will 301 to `/app/...`; no broken links.
- **Crawlers:** 301 is the right signal; sitemap will list only public routes.

---

## 5. Exact Redirect List Recommended for Phase 7

Use **301 (Moved Permanently)**. Implement in Next.js `redirect()` in middleware or in `next.config.js` redirects (or equivalent).

| From (old root app path) | To (canonical) |
|--------------------------|----------------|
| `/dashboard` | `/app/dashboard` |
| `/overview` | `/app/overview` |
| `/analytics` | `/app/analytics` |
| `/profile` | `/app/profile` |
| `/profile/edit` | `/app/profile/edit` |
| `/profile/deals` | `/app/profile/deals` |
| `/profile/applications` | `/app/profile/applications` |
| `/profile/insights` | `/app/profile/insights` |
| `/profile/inbox` | `/app/profile/inbox` |
| `/profile/requests` | `/app/profile/requests` |
| `/profile/dashboard` | `/app/analytics` (or `/app/profile/dashboard` if that route exists; current routeFromPathname maps profile/dashboard → analytics) |
| `/settings` | `/app/settings` (or `/app/settings/integrations` if /app/settings maps to integrations) |
| `/settings/integrations` | `/app/settings/integrations` |
| `/settings/roles-skills` | `/app/settings/roles-skills` |
| `/settings/wallet` | `/app/settings/wallet` |
| `/work/requests` | `/app/work/requests` |
| `/explore` | `/app/explore` |
| `/market` | `/app/market` |
| `/messages` | `/app/messages` |
| `/circles` | `/app/circles` |
| `/plans` | `/app/plans` |
| `/pricing` | `/app/pricing` |
| `/billing` | `/app/billing` |
| `/leaderboards` | `/app/leaderboards` |
| `/creator` | `/app/creator` |
| `/brand` | `/app/brand` |
| `/agency` | `/app/agency` |
| `/calendar` | `/app/calendar` |
| `/xspaces` | `/app/xspaces` |
| `/host` | `/app/host` |
| `/availability` | `/app/availability` |
| `/monetization` | `/app/monetization` |
| `/monetization-flow` | `/app/monetization-flow` |
| `/kol-lists` | `/app/kol-lists` |
| `/capital-partners` | `/app/capital-partners` |
| `/connections` | `/app/connections` |
| `/preferences` | `/app/preferences` |
| `/support` | `/app/support` |
| `/notifications` | `/app/notifications` |
| `/showcase` | `/app/showcase` |
| `/watchlist` | `/app/watchlist` |

**Query and hash:** Preserve `?tab=...`, `?username=...`, and `#...` when redirecting (e.g. `/profile?tab=foo` → `/app/profile?tab=foo`).

**Do not redirect:**

- `/` (landing)
- `/:username` or `/:slug` (public profiles/orgs)
- `/u/:username`
- `/org/:id` or `/org/:slug`
- `/deal/:id`
- `/login`, `/auth/callback`, `/onboarding`
- `/terms`, `/privacy`, `/privacy-policy`
- `/api/*`, `/_next/*`, static assets

**Optional (Phase 7 or later):** 301 `/org/:uuid` → `/org/:slug` for known orgs (look up slug by id server-side and redirect). Not required for correctness; improves canonicalization and bookmark quality.

---

## 6. Summary for Founder

- **Phase 6 done:** Watchlist and org copy link use slug; remaining in-app root hrefs in App.tsx and profile/debug pages now point to `/app/...`. No redirects turned on.
- **Still on root or UUID:** Public CTAs (OwnerUnpublishedProfile, PublicHeader, ApplyToGigButton, PublicProfileContent, UnpublishedView) still use root app paths by design; notifications and any link built only with `org_id` use `/org/:uuid`. Both are valid and will keep working.
- **Redirect readiness:** Internal navigation and new links already use `/app/...` and `/org/:slug`. Adding the 301 list above in Phase 7 is safe and completes the URL model. Optional: add `org_slug` to notification payloads later so notification links can use `/org/:slug`; and optional 301 from `/org/:uuid` to `/org/:slug` for canonicalization.

---

*End of document.*
