# Full Platform Hardening Sweep — Summary

This document summarizes the changes from the single “FULL PLATFORM HARDENING SWEEP” pass: stubs/mocks removed, RLS added, search and verification decisions, and nav cleanup.

---

## 1. Routes removed or hidden

| Route / Nav item | Action |
|------------------|--------|
| **Creator Demo** | Removed from sidebar (was `creatorProfile`) |
| **Project Demo** | Removed from sidebar (was `brandProfile`) |
| **Verification Center** | Removed from nav; route `verification` redirects to Overview |
| **Verification Inbox** | Removed from nav; route `verificationInbox` redirects to Overview |
| **Preferences** | Removed from nav and StubPage route |
| **Support** | Removed from nav and StubPage route |
| **Notifications** | Removed from nav and StubPage route |
| **Sign out (stub)** | Removed StubPage for `signOut`; Log out still uses `handleSignOut` (real `supabase.auth.signOut()` + redirect) |
| **Monetization: Flow Showcase** | Removed from nav |
| **Monetization: Monetization Hub** | Removed from nav |
| **Plans & Billing** | Removed from nav and sidebar “Upgrade to Pro” CTA |
| **X Spaces Hub** | Removed from nav |
| **Availability** | Removed from nav |

**Replaced with:**  
- No replacement for removed items. Verification and stub routes either redirect to Overview or no longer appear in the UI.  
- Sign out: already working via sidebar “Log out” → `handleSignOut()` (Supabase sign out + redirect to login).

---

## 2. RLS policies added

**Migration:** `supabase/migrations/20260233000000_rls_org_relationships_ecosystem_subscriptions.sql`

### org_relationships

- **RLS:** Enabled.
- **SELECT:** `true` (public read).
- **INSERT:** Allowed only if the current user is owner or admin of `parent_org_id` (via `org_members`).
- **UPDATE:** Same as INSERT (owner/admin of parent org).
- **DELETE:** Same as INSERT (owner/admin of parent org).

### org_ecosystem_categories

- **RLS:** Enabled.
- **SELECT:** `true` (public read).
- **INSERT:** Allowed only if the current user is owner or admin of `org_id` (via `org_members`).
- **UPDATE:** Same (owner/admin of org).
- **DELETE:** Same (owner/admin of org).

### subscriptions

- **RLS:** Enabled.
- **SELECT:** Allowed only for the “owner”:
  - `owner_type = 'profile'` and `owner_id = auth.uid()`, or  
  - `owner_type = 'org'` and the user is owner/admin of that org (via `org_members`).
- **INSERT / UPDATE / DELETE:** Same as SELECT (only the owning profile or org owner/admin).

---

## 3. Search: real implementation (not removed)

- **Decision:** Real search implemented; search UI kept.
- **Implementation:**
  - **API:** `GET /api/search?q=...&filter=all|people|projects|agencies`
  - Queries `public_profile_view` (username, display_name, twitter_username) and `public_org_view` (name, slug, twitter_username) with `ilike` and `or()`.
  - Returns combined results with type `person` | `project` | `agency`, ranked (starts-with preferred over contains).
  - Limit 20 results; no auth required (public views only).
  - **Client:** `GlobalSearch.tsx` calls `/api/search` with existing debounce (400 ms); mock results and tier gating removed. Search is available to all users.

---

## 4. Verification: removed from nav and routes

- **Decision:** Verification Center / Inbox are not fully implemented (mock data and TODOs). They were removed from the product surface for launch.
- **Implementation:**
  - Nav links to “Verification Center” and any verification inbox removed.
  - When route is `verification` or `verificationInbox`, a `useEffect` redirects to `overview`.
  - `VerificationCenterPage` and `VerificationInboxPage` are no longer rendered; components remain in codebase but are unreachable from nav/redirects.

---

## 5. Auth: sign out

- **Status:** Sign out was already correct.
- Sidebar “Log out” calls `onSignOut` → `handleSignOut()` which:
  - Calls `supabase.auth.signOut()`
  - Clears local state (`setAuthUserId(null)`, `setMe(null)`)
  - Sets route to `login`
- The old StubPage for `signOut` was removed; no route name `signOut` is used in the flow.

---

## 6. Production routes that remain (checklist)

These are the main in-app routes still reachable and intended to be functional:

- **Home / Landing** (`landing`) — Landing page; hero uses real featured profiles/orgs from `/api/landing/featured`.
- **Overview** (`overview`)
- **My Dashboard** (`dashboard`)
- **My Profile** (`profile`)
- **Profile Builder** (`profileEdit`)
- **Explore** (`explore`)
- **Leaderboards** (`leaderboards`)
- **Jobs & Sprints** (`market`)
- **Messages** (`messages`)
- **Circles** (`circles`), **KOL Lists** (`kolLists`), **Capital Partners** (`capitalPartners`)
- **Analytics** (`analytics`)
- **Privacy & Data** (`privacy`)
- **Integrations** (`integrations`) — X connect, etc.
- **Roles & Skills** (`rolesSkills`)
- **Wallet** (`wallet`) — if linked from somewhere
- **Login** (`login`), **Onboarding** (`onboarding`)
- **Public profile/project/company** (`publicCreator`, `publicProject`, `publicCompany`) — public one-pagers
- **Deal detail** — Next.js route `/deal/[id]` (deal page + review form)

---

## 7. Launch UX pass (empty + error states)

- **Search:** Empty state: “No results found for …” + “Try different keywords”. Loading: spinner + “Searching…”.
- **Landing hero:** If no featured profiles/orgs, show “Join the network” / “Get your verifiable reputation score” (no mock avatars).
- **Deal/reviews:** Rely on existing deal detail and review form; ensure empty “no reviews yet” and error on submit are clear.
- **Analytics:** Keep existing empty/loading states for X analytics.
- **Integrations:** Keep conflict banner and disconnect flow; ensure errors on connect are visible.
- **Auth:** Login/onboarding error states and redirects already in place; sign out leaves user on login.

---

## 8. Files touched (PR-level)

- **New:**  
  - `supabase/migrations/20260233000000_rls_org_relationships_ecosystem_subscriptions.sql`  
  - `apps/web/src/app/api/search/route.ts`  
  - `apps/web/src/app/api/landing/featured/route.ts`  
  - `docs/PLATFORM_HARDENING_SWEEP.md`
- **Modified:**  
  - `apps/web/src/figma/app/App.tsx` — nav cleanup, stub/verification routes removed, redirect for verification, StubPage/ComingSoon copy, unused imports  
  - `apps/web/src/figma/app/components/GlobalSearch.tsx` — real search API, mock/tier removed  
  - `apps/web/src/figma/app/components/LandingPage.tsx` — featured from API, no mock profiles  
  - `apps/web/src/figma/app/components/RolesSkillsPage.tsx` — “coming soon” copy  
  - `apps/web/src/figma/app/components/unified-profile/WalletsSection.tsx` — “coming soon” copy  
  - `apps/web/src/figma/app/components/AnalyticsPage.tsx` — comment only (no user-facing “coming soon”)

---

## Paste-back (as requested)

1. **Routes removed/hidden:**  
   Creator Demo, Project Demo, Verification Center, Verification Inbox, Preferences, Support, Notifications, Monetization Flow Showcase, Monetization Hub, Plans & Billing, X Spaces Hub, Availability. Sign out stub route removed; real sign out unchanged.

2. **RLS policies added:**  
   See **Section 2** above (and migration file `20260233000000_rls_org_relationships_ecosystem_subscriptions.sql`) for exact policies on `org_relationships`, `org_ecosystem_categories`, and `subscriptions`.

3. **Search:**  
   **Real search implemented** (Supabase-backed `/api/search`, GlobalSearch wired with debounce; mock and tier gate removed). Search was not removed.

---

## Appendix: SQL view definitions (for privacy & ordering check)

Current view definitions (from `supabase/migrations/20260227000000_public_layout.sql`) so you can verify privacy and `updated_at` ordering.

### public_profile_view

```sql
DROP VIEW IF EXISTS public.public_profile_view;
CREATE VIEW public.public_profile_view AS
SELECT
  p.id,
  p.username,
  p.display_name,
  p.bio,
  p.avatar_url,
  p.website,
  p.twitter_username,
  p.location,
  p.published,
  p.followers_total,
  p.avg_engagement_rate,
  p.xscore,
  p.public_layout,
  p.created_at,
  p.updated_at
FROM public.profiles p
WHERE p.published = true AND p.username IS NOT NULL AND p.username <> '';
```

- **Privacy:** Only rows with `published = true` and non-empty `username`. No private/unpublished profiles.
- **Ordering:** `updated_at` is selected; `.order("updated_at", { ascending: false })` works.

### public_org_view

```sql
DROP VIEW IF EXISTS public.public_org_view;
CREATE VIEW public.public_org_view AS
SELECT
  o.id,
  o.slug,
  o.name,
  o.tagline,
  o.website,
  o.twitter_username,
  o.logo_url,
  o.org_type,
  o.parent_org_id,
  o.is_crypto_project,
  o.has_token,
  o.token_symbol,
  o.dexscreener_url,
  o.xscore,
  o.public_layout,
  o.created_at,
  o.updated_at
FROM public.orgs o;
```

- **Privacy:** No `WHERE`; every org row is visible. If you need “public only” orgs, add a filter (e.g. a `published` or `listed` column on `orgs`).
- **Ordering:** `updated_at` is selected; ordering by `updated_at` works.
