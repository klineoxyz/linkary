# Profile Surface Fixes — Deliverables

**Mission:** Implement profile-surface fixes safely, without redesign, and make the system future-safe for a paid Linkary discovery/search layer that must NOT expose sensitive information.

**Product rule (locked):** Paid Linkary discovery/search can reveal only an explicit allowlisted discovery dataset, never owner-private or sensitive profile fields. Public profile visibility and paid discovery visibility are not the same thing.

---

## 1. Exact files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260401000000_public_views_remove_email.sql` | **New.** Recreates `public_profile_view` and `public_profile_preview_view` **without** `p.email`. Comments state `profiles.email` is auth/user email and must not be exposed; future public contact = separate column. |
| `apps/web/src/lib/publicProfileDTO.ts` | In `entityToPublicDTO`, `contact_email` set to `null`; comment that auth email must never be exposed; public contact must be separate allowlisted field if added. Top-of-file comment: payload separation (owner vs public vs discovery). |
| `apps/web/src/lib/publicData.ts` | `PublicProfile` type comment: email is owner/account email and must not be exposed in public or discovery payloads. |
| `apps/web/src/figma/app/components/ProfileEditPage.tsx` | New state and UI: `publicLocation`, `publicPricing`, `pricingValues` (post/podcast: price_usd, platforms, notes). Sections: **Public visibility** (Show location / Show pricing), **Monetization / Pricing**. `handleSave` sends `public_location`, `public_pricing`, `pricing` via `updateMyProfile`. Email field label: "Not shown on public profile. For account and internal use only." |
| `apps/web/src/figma/app/App.tsx` | **Profile page:** Removed editable Core profile card (checkboxes + pricing form + Save). Replaced with read-only "Public visibility & pricing" summary card (Location/Pricing Shown/Hidden from `me.meta`) and "Edit in Advanced editor" link to `/app/profile/edit`. **userProfile route:** Effect that redirects `userProfile` to `/{handle}` so `UserProfilePage` never renders; render branch for `userProfile` now returns `null`. "View Public Profile" / "View" replaced with direct `<a href={/{username}}>` or `window.location.href` to canonical public URL. Removed unused state/effects: `coreDisplayName`, `coreBio`, `coreLocation`, `coreWebsite`, `corePublicLocation`, `corePublicPricing`, `corePricing`, `coreSaving`. Dashboard "User" card: `userProfile` → `explore` + TODO. |
| `apps/web/src/figma/app/components/DashboardPage.tsx` | When user has no `user.url`, navigate to `/${username}` via `window.location.href` instead of `setRoute({ name: "userProfile", data: user })`. "User" card: `setRoute({ name: "userProfile" })` → `setRoute({ name: "explore" })` with TODO. |
| `apps/web/src/figma/app/components/ConnectionsPage.tsx` | "View profile" buttons replaced with `<a href={/{other_username}}>` for accepted and pending connections. |
| `apps/web/src/lib/discoveryAllowlist.ts` | **New.** Future paid discovery allowlist: types `DiscoveryProfileResult`, `DiscoveryOrgResult`, `DiscoverySearchResult`; helpers `publicProfileToDiscoveryResult`, `publicOrgToDiscoveryResult`; file-level comment on visibility model and forbidden fields. |
| `apps/web/src/figma/app/components/UserProfilePage.tsx` | TODO comment: route hard-disabled; redirect in App; do not use for real user journeys or mock data. |

---

## 2. Exact behavior changed

- **Public email:** No `profiles.email` in `public_profile_view` or `public_profile_preview_view`. Public DTO `contact_email` is always `null`. No auth email on public page, brochure, or any public API.
- **Single control plane:** `public_location`, `public_pricing`, and pricing values (post/podcast, platforms, notes) are edited **only** in `/app/profile/edit` (Advanced edit), under "Public visibility" and "Monetization / Pricing". `/app/profile` shows a read-only summary and "Edit in Advanced editor" link.
- **userProfile route:** Any navigation that would show `UserProfilePage` (in-app other-user view with mock data) now either (1) redirects to `/{username}` (canonical public profile) via effect + direct links, or (2) goes to explore. `UserProfilePage` is never rendered; route renders `null` while redirect runs.
- **Discovery groundwork:** Clear DTO separation (owner vs public vs discovery) documented; discovery allowlist types and helpers added so future paid discovery can use an explicit, non-sensitive contract.

---

## 3. Migration added

- **`20260401000000_public_views_remove_email.sql`**
  - Drops and recreates `public_profile_view` and `public_profile_preview_view` **without** selecting `p.email`.
  - Comments: `profiles.email` is auth/user email; must not be exposed; future public contact = separate column.
  - No other columns added/removed besides email.

---

## 4. Privacy-risk summary

- **Before:** `profiles.email` was present in public views and could be mapped to public DTOs; risk of auth email exposure to anonymous users, logged-in non-owners, or future discovery consumers.
- **After:** Auth email is not in any public view or public DTO. Public payload and brochure do not expose email. Discovery allowlist and types explicitly exclude email and other sensitive fields.
- **Residual:** None intended. If a public contact email is required later, it must be a separate optional column and explicitly allowlisted, not the auth email.

---

## 5. Proposed future discovery/search allowlist

**Allowed in discovery payload (explicit allowlist):**

- `display_name`, `username`, `avatar_url`, `bio`, `profile_type` / roles  
- Selected public socials/links (only if already public on profile)  
- `twitter_username` (handle)  
- High-level credibility metrics only when permitted (e.g. `xscore`; aggregated analytics snapshot only if approved for discovery)  
- Non-sensitive tags, categories, ecosystem labels, skills, public achievements  

**Never in discovery:**

- Email (auth or any contact)  
- Exact location  
- Pricing / pricing notes  
- Auth/account identifiers (user_id, internal ids)  
- Private metadata  
- Unpublished/private relations  
- Private review data  
- Raw private metadata  
- Anything not explicitly allowlisted  

Implementation: `apps/web/src/lib/discoveryAllowlist.ts` defines `DiscoveryProfileResult`, `DiscoveryOrgResult`, `DiscoverySearchResult` and `publicProfileToDiscoveryResult` / `publicOrgToDiscoveryResult` to build discovery-safe payloads from public DTOs only. Future discovery APIs must use these (or server equivalents) and must never pass owner/private payloads or raw DB rows.

---

## 6. Regression checklist

Use this for manual QA and regression; add automated tests where applicable.

- [ ] **Owner self view** — `/app/profile` shows own data; read-only visibility/pricing summary; "Edit in Advanced editor" goes to `/app/profile/edit`.
- [ ] **Logged-in other user** — Clicking "View Public Profile" or "View profile" opens `/{username}` (canonical public page); no in-app other-user profile with different data.
- [ ] **Anonymous public view** — `/{username}` shows public profile; location/pricing/analytics only when allowed.
- [ ] **public_location off** — Location not shown on `/{username}`; no location in public payload.
- [ ] **public_location on** — Location shown on `/{username}`.
- [ ] **public_pricing off** — No pricing block on `/{username}`; no pricing in public payload.
- [ ] **public_pricing on** — Pricing block visible when at least one price set.
- [ ] **analytics_visibility public/private** — Public page shows/hides analytics (followers, xscore, etc.) accordingly.
- [ ] **No public email leak** — Public profile page, brochure, and public API responses have no email field or contact_email populated from auth.
- [ ] **No pricing leak to non-owners** — Logged-in non-owner and anonymous see pricing only when `public_pricing` is true.
- [ ] **No exact location leak to non-owners** — Same for location vs `public_location`.
- [ ] **No mock data route reachable** — No user journey lands on `UserProfilePage`; all "View profile" / "View Public Profile" go to `/{username}` or explore.
- [ ] **Discovery DTO/API** — Any future discovery/search endpoint or type does not expose email, exact location, pricing, auth ids, or private metadata; uses allowlist types only.
- [ ] **Profile edit saves** — Saving in Advanced edit updates `public_location`, `public_pricing`, `pricing`; public page reflects changes after refresh.

---

## 7. Intentionally not changed

- **No new in-app "other user" profile page** — Other users are viewed only on `/{username}`.
- **No change to public gating rules** — `/{username}` still gates location, pricing, analytics, and list items by `public_location`, `public_pricing`, `analytics_visibility`, and per-item `is_public`.
- **No broad schema rewrite** — Only view definitions (removal of email) and existing `meta`/pricing usage.
- **No second parallel public-profile assembler** — Reused existing public payload and DTO; discovery is a separate, explicit contract.
- **No full paid discovery product** — Only minimal, safe groundwork (types, helpers, comments).
- **Canonical route** — `/{username}` remains the single canonical public profile path; no duplicate indexable profile routes.
- **Analytics ownership** — `/analytics` remains the deep analytics owner; profile pages remain snapshot-oriented.
