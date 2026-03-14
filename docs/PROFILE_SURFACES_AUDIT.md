# Linkary — Audit of 3 Profile Surfaces

**Mission:** Audit current behavior, data, permissions, and intended purpose of the three profile pages without making broad changes.  
**Experts (audit perspective):** Senior product designer, senior frontend engineer, senior backend engineer, senior Supabase/Postgres engineer, QA/regression engineer.

---

## 1. Exact current behavior of each page

### 1.1 Logged-in profile page — `/app/profile`

| Aspect | Current behavior |
|--------|-------------------|
| **URL** | `https://linkary.xyz/app/profile` (path in app: `profile` with no subpath). |
| **Who sees it** | **Self only.** The page always shows the logged-in user’s own profile (`me`). There is no “view another user’s profile” mode on this route. |
| **Data source** | `me` from `getMyProfile(authUserId)` (full profile row); `/api/profile/me-stats` (ETHOS, XScore, reputation index, rep score, social power, reviews, completedGigsCount); `/api/public/profile?username={publicSlug}` (only `links` and `relations` are used for display). |
| **Tabs** | Overview (default), Public preview (iframe to `/{username}`), links to Insights and Analytics. |
| **Displayed** | Display name, handle, location, bio, role tags (professions), ETHOS, XScore, reputation index, rep score, social power, reviews, completed gigs, Ambassador Of, Partnerships (affiliate), Links (from public payload or demo fallback), Featured Work (case studies). When `isMyProfile`: Core profile card with toggles “Show location on public profile”, “Show pricing on public profile”, and **Pricing (USD)** (post/podcast price_usd, platforms, notes) + Save. |
| **Editable here** | Only the “Core profile” block: `public_location`, `public_pricing`, and `pricing` (post/podcast). Saved via `updateMyProfile(me.id, { public_location, public_pricing, pricing })`. |
| **Not editable here** | Display name, bio, avatar, links, skills, achievements, case studies, hero, etc. — those are edited in the advanced editor. |

**Important:** The in-app profile page does **not** distinguish “self” vs “other logged-in user”. It is **always self**. When a user clicks “View Public Profile” for someone else, the app does `router.push("/" + slug)`, so they navigate to `/{username}` (e.g. `/muazxinthi`) and see the **public profile page** (Next route `(public)/[username]`), not `/app/profile`.

---

### 1.2 Advanced profile edit page — `/app/profile/edit`

| Aspect | Current behavior |
|--------|-------------------|
| **URL** | `https://linkary.xyz/app/profile/edit`. Route name: `profileEdit`. (Implementation: navigating to profileEdit pushes `/app/profile` and the edit UI is shown in-app; no separate `/app/profile/edit` layout in the snippet checked.) |
| **Who sees it** | **Self only.** Owner edits their own profile. |
| **Data source** | Direct Supabase: `profiles`, `profile_socials`, `profile_media`, `profile_links`, `profile_skills`, `profile_achievements`, `profile_relations`, `case_studies`, gigs, `org_team_members`, `partner_programs`, etc. |
| **Sections** | Basics (display_name, bio, avatar, location, website, profile_type), Hero (image/video/title), Social links (X, Telegram, Discord, LinkedIn, Website, YouTube), Links (title, url, icon, **is_public** per link), Skills (name, level, **is_public** per skill), Achievements (title, description, proof_url, **is_public** per achievement), Case studies, Relations (with **is_public**), Gigs, Team (with **is_public** per member), Partner programs (affiliate/ambassador), Public layout (preset, order, hidden sections, featured IDs). |
| **Visibility controls** | Per-item **is_public** on: profile_links, profile_skills, profile_achievements, profile_relations, org_team_members. **No** controls here for: `public_location`, `public_pricing`, or `pricing` (those live on `/app/profile` in “Core profile”). |
| **Source of truth for public page** | Yes for: hero, socials, links (and their is_public), skills/achievements/relations/team (and their is_public), case studies, gigs, partner programs, public_layout. **No** for: location and pricing visibility and values — those are set on `/app/profile` only. |

---

### 1.3 Public profile page — `/{username}` (e.g. `https://linkary.xyz/muazxinthi`)

| Aspect | Current behavior |
|--------|-------------------|
| **URL** | `https://linkary.xyz/{username}`. Resolved by Next route `(public)/[username]/page.tsx`. Not under `/app`. |
| **Who sees it** | Anyone (anonymous or logged-in). When the viewer is the owner, `viewer_is_owner` can be set for owner-only CTAs. |
| **Data source** | **Slug branch:** `getPublicEntityByUsername` → `public_profile_view` (published only), then `buildPublicProfilePayloadFromEntity` (service Supabase). **Non-slug (e.g. wallet/UUID):** `resolvePublicEntity` then optionally `GET /api/public/profile?username=...`. Public payload built from: `public_profile_view`, `profile_socials`, `profile_links` (is_public), `profile_skills` (is_public), `profile_achievements` (is_public), `case_studies`, `reviews`, relations (is_public), team (is_public), etc. |
| **Visibility rules** | **Location:** only if `meta.public_location === true` (else location null in payload). **Pricing:** only if `meta.public_pricing === true` and at least one price set (else no pricing block). **Analytics (followers, xscore, ethos, etc.):** only if `analytics_visibility = 'public'` (view gates these columns). **Links/skills/achievements/relations/team:** only rows with `is_public = true`. |
| **Displayed** | Profile (display_name, username, bio, avatar, location when allowed, roles, is_verified, ethos_score, xscore, reputation_index, rep_score, profile_type, public_layout), hero, socials, links, case studies, reviews (when show_reviews), skills, achievements, team, relations, gigs, partner programs, pricing (when allowed), token/card, etc. |

**Logged-in “other user” view:** When a logged-in user clicks “View Public Profile” for another user, the app calls `router.push("/" + slug)`, so they are taken to the **public URL** and see the **same public profile page** as an anonymous visitor (with real data). There is no separate in-app “other user” profile view that shows different data. The only in-app view that shows “another” user by handle is `UserProfilePage` (route `userProfile`), which currently uses **mock/demo data** and is only relevant when the app is mounted at a path that resolves to `userProfile` (e.g. under a catch-all); in the current structure, navigating to `/{username}` loads the public page, not the app shell.

---

## 2. Field-by-field visibility matrix

| Field / data | Self (`/app/profile`) | Logged-in other (in-app) | Public (`/{username}`) | Editable in advanced edit (`/app/profile/edit`) |
|--------------|----------------------|---------------------------|------------------------|--------------------------------------------------|
| **display_name** | ✅ (me) | N/A (no real other view in-app) | ✅ (payload) | ✅ Basics |
| **bio** | ✅ | N/A | ✅ | ✅ Basics |
| **avatar_url** | ✅ | N/A | ✅ | ✅ Basics |
| **username** | ✅ (handle) | N/A | ✅ | Claimed via username flow |
| **twitter_username** | ✅ | N/A | ✅ (socials / handle) | ✅ Socials |
| **location** | ✅ | N/A | ✅ only if meta.public_location | ❌ (set on /app/profile Core) |
| **website** | ✅ | N/A | ✅ (socials/website) | ✅ Basics / Socials |
| **profile_type** | (from me) | N/A | ✅ | ✅ Basics |
| **hero (image/video/title)** | (via public preview iframe) | N/A | ✅ | ✅ Hero section |
| **Socials (X, Telegram, etc.)** | (via public payload relations/links) | N/A | ✅ | ✅ Social links section |
| **Links** | ✅ (public payload or demo) | N/A | ✅ is_public only | ✅ Links + is_public |
| **Skills** | (not on /app/profile) | N/A | ✅ is_public only | ✅ Skills + is_public |
| **Achievements** | (not on /app/profile) | N/A | ✅ is_public only | ✅ Achievements + is_public |
| **Case studies** | ✅ | N/A | ✅ | ✅ Case studies section |
| **Relations (ambassador/affiliate)** | ✅ (public payload) | N/A | ✅ is_public only | ✅ Relations + is_public |
| **Team** | (company) | N/A | ✅ is_public only | ✅ Team + is_public |
| **Gigs** | (not on /app/profile overview) | N/A | ✅ (open, public) | ✅ Gigs section |
| **Partner programs** | (not on /app/profile) | N/A | ✅ | ✅ Partner programs |
| **ETHOS / XScore / rep / reputation_index** | ✅ (me-stats + me) | N/A | ✅ if analytics_visibility=public | (computed / refreshed) |
| **Reviews** | ✅ | N/A | ✅ (show_reviews) | (received only) |
| **public_location** | ✅ (toggle) | N/A | Drives location visibility | ❌ (only on /app/profile) |
| **public_pricing** | ✅ (toggle) | N/A | Drives pricing block | ❌ (only on /app/profile) |
| **pricing (post/podcast USD)** | ✅ (form + save) | N/A | ✅ only if public_pricing | ❌ (only on /app/profile) |
| **public_layout (order/hidden)** | (via public preview) | N/A | ✅ | ✅ Public layout section |
| **email / contact_email** | (not shown on /app/profile) | N/A | In view/DTO as contact_email; shown in PublicOnePager (brochure view) when set (see §4) | (not edited in edit page) |

---

## 3. Files / routes / components / APIs

| Surface | Route / path | Main component(s) | Data / API |
|---------|----------------|-------------------|------------|
| **Logged-in profile** | `/app/profile` → route name `profile` | `ProfilePage` (in `App.tsx`) | `me` (getMyProfile), `/api/profile/me-stats`, `/api/public/profile?username=...` (links, relations) |
| **Advanced edit** | `/app/profile/edit` → route name `profileEdit` | `ProfileEditPage` (dynamic import) | Supabase: profiles, profile_socials, profile_media, profile_links, profile_skills, profile_achievements, profile_relations, case_studies, gigs, org_team_members, partner_programs |
| **Public profile** | `/{username}` | `(public)/[username]/page.tsx` → `PublicProfileContent` or `PublicOnePagerWrapper` | `getPublicEntityByUsername` → `public_profile_view`; `buildPublicProfilePayloadFromEntity`; or `GET /api/public/profile?username=...` |

**Key backend / DB:**

- **public_profile_view** (Supabase): `profiles` WHERE published AND username NOT NULL; exposes id, username, display_name, **email**, bio, avatar_url, website, twitter_username, location, published, profile_type, hero_*, analytics_visibility, **meta**, followers_total/avg_engagement_rate/xscore/ethos_score/rep_score (when analytics_visibility = 'public'), public_layout, created_at, updated_at.
- **buildPublicProfilePayload.ts**: Builds `PublicProfileApiPayload` from entity; gates location by `meta.public_location`, pricing by `meta.public_pricing` + meta.pricing.
- **publicProfileDTO.ts**: Maps entity to DTO; includes `contact_email` from `(p as { email }).email`.
- **Profile updates:** `updateMyProfile` in `lib/profiles.ts`; merges `public_location`, `public_pricing`, `pricing` into `profiles.meta`.

---

## 4. Mismatches / bugs / privacy leaks / missing public data

### 4.1 Privacy / visibility

| Issue | Severity | Detail |
|-------|----------|--------|
| **public_profile_view exposes `p.email`** | **High** | Migration `20260322000000_public_profile_view_meta.sql` adds `p.email` to the view. The DTO maps it to `contact_email` for “contact me” use. If `profiles.email` is the auth/login email, it is a **privacy leak**. If it is an optional “display contact” field, the view still exposes it to anon; confirm intent and whether it is ever shown on the public page. It is shown as contact_email in PublicOnePager (brochure view, ?view=brochure) when set. Confirm whether profiles.email is auth vs optional contact. |
| **Location and pricing visibility split** | Medium | “Show location on public profile” and “Show pricing on public profile” (and pricing values) are edited only on **/app/profile** (Core profile), not in the advanced edit page. So “what appears on the public page” is controlled from two places: `/app/profile` (location, pricing) and `/app/profile/edit` (everything else with is_public). This is inconsistent for “single source of truth” and discoverability. |
| **No “logged-in other-user” view in app** | Low | There is no in-app view that shows another user’s profile with “logged-in other” semantics (e.g. more than public but still no private fields). Today, “view other user” = navigate to public page. If the product wants “other logged-in users see general profile + analytics but not private pricing”, that view does not exist yet. |

### 4.2 Consistency / product logic

| Issue | Severity | Detail |
|-------|----------|--------|
| **Profile edit does not control location/pricing visibility** | Medium | Advanced edit is documented as “source of truth for what appears on the public page”, but `public_location`, `public_pricing`, and `pricing` are only editable on `/app/profile`. So the advanced edit is **not** the single control plane for all public visibility. |
| **UserProfilePage (route userProfile) uses mock data** | Medium | When the app resolves a path to `userProfile` (e.g. under a catch-all or future structure), `UserProfilePage` renders with `demoUserData` and only overlays the username. It does not fetch the real profile or the public payload. So any in-app “other user” profile view would show fake data unless this is replaced. |

### 4.3 Missing or unclear on public page

| Item | Note |
|------|------|
| **contact_email** | In DTO; not clearly in PublicProfileApiPayload type; confirm if/when it is rendered on the public page and whether it is optional “contact” vs auth email. |
| **Profile completeness / empty states** | Public page has empty states and CTAs (e.g. “Add hero”, “Add case study” for owner). No gap identified for core public identity. |

---

## 5. Founder-facing recommendation

### 5.1 What each page should be for

- **`/app/profile`**  
  - **Purpose:** Main profile page inside the app for the **logged-in user viewing their own** profile.  
  - **Should show:** Rich self-view: everything they need to manage and preview (including what is public), plus private/local-only fields (e.g. personal pricing) that are never shown to others.  
  - **Recommendation:** Keep as self-only dashboard. Optionally add a clear “Preview as others see” (e.g. iframe or link to public URL) and move **all** “show on public” toggles (including location and pricing) into one place — ideally the advanced edit, so one page controls public visibility.

- **`/app/profile/edit`**  
  - **Purpose:** Advanced edit = **source of truth for what appears on the public page**.  
  - **Should control:** Every field and visibility flag that affects the public page: basics, hero, socials, links (and is_public), skills/achievements/relations/team (and is_public), case studies, gigs, partner programs, **and** “show location on public”, “show pricing on public”, and pricing values.  
  - **Recommendation:** Move `public_location`, `public_pricing`, and `pricing` (post/podcast) from `/app/profile` into the advanced edit (e.g. “Public visibility” or “Basics” section) so one place controls all public visibility. Keep `/app/profile` as display + quick links to edit.

- **`/{username}` (public profile)**  
  - **Purpose:** Public identity page (Linktree/Link3 style): clean, strong, no private leaks.  
  - **Should show:** Only what the user has marked public (via edit page): profile basics (with location/pricing only when enabled), hero, socials, links (is_public), skills/achievements/relations/team (is_public), case studies, reviews (when show_reviews), gigs, partner programs, and proof/scores when analytics_visibility = public.  
  - **Recommendation:** Keep current gating (meta, is_public, analytics_visibility). Remove or strictly gate **email** in the view: if it is auth email, remove from view; if it is “contact email”, make it optional and only expose when the user explicitly sets it for the public page.

### 5.2 What should stay on `/app/profile`

- Self summary (name, handle, bio, location, scores, reviews, roles, ambassador/affiliate, links, case studies).  
- Quick actions: Advanced editor, Wallet, Public View, Generate Card, Share, Connect.  
- **Either:** keep location/pricing toggles here with a clear note “These control your public page” and a link to the advanced edit, **or** move them to the advanced edit and remove from here (recommended).

### 5.3 What should move to `/app/profile/edit`

- **public_location**, **public_pricing**, and **pricing** (post/podcast USD, platforms, notes).  
- So that “what is public” is controlled in one place: the advanced edit.

### 5.4 What must appear on the public page

- Already present and gated: display_name, username, bio, avatar, (optional) location, (optional) pricing, hero, socials, links (is_public), skills/achievements/relations/team (is_public), case studies, reviews (show_reviews), gigs, partner programs, layout, scores when analytics_visibility = public.  
- **Must not leak:** Auth email (if profiles.email = auth email, remove from view). Optional contact email only if product wants it and it is explicitly set for public.  
- No change to “what” sections exist; only ensure visibility is driven by one control plane (edit) and that email is safe.

---

## 6. Regression risk if we change this

| Change | Risk | Mitigation |
|--------|------|------------|
| Move location/pricing toggles from `/app/profile` to `/app/profile/edit` | Medium: users who only use “Core profile” may not find them. | Add “Public visibility” section in edit; keep a short note on `/app/profile`: “Control what’s public in Advanced editor → Public visibility”. |
| Remove or gate email from public_profile_view | Low: contact_email might be used somewhere. | Audit all reads of contact_email / email from view/DTO; if only for optional “contact” on public page, gate by a new flag (e.g. “show_contact_email”) or remove from view and add a separate contact_email column that is optional and clearly for display. |
| Introduce a real “logged-in other-user” view in app | Medium: new view must enforce “no private fields” and reuse public or a dedicated API. | Define a strict allowlist (e.g. same as public + maybe analytics summary); no pricing, no private meta; share logic with public payload where possible. |

---

## 7. Final summary

### Where we stand now

- **`/app/profile`:** Self-only; shows full self view + Core profile form (location/pricing visibility and values). Data from `me`, me-stats, and public payload (links, relations).  
- **`/app/profile/edit`:** Self-only; controls hero, socials, links/skills/achievements/relations/team (with is_public), case studies, gigs, partner programs, public layout. Does **not** control location or pricing visibility.  
- **`/{username}`:** Public page; data from `public_profile_view` + related tables; location and pricing gated by meta; analytics gated by analytics_visibility.  
- **Logged-in “other user”:** No dedicated in-app view; “View Public Profile” goes to the public URL. Any in-app `userProfile` view currently uses mock data.

### What is already correct

- Public page correctly gates location and pricing by `meta.public_location` and `meta.public_pricing`.  
- Public page only shows links/skills/achievements/relations/team with `is_public = true`.  
- Analytics (followers, xscore, ethos, etc.) are gated by `analytics_visibility` in the view.  
- Advanced edit is the source of truth for most public content (hero, socials, links, skills, achievements, relations, team, layout).  
- `/app/profile` is self-only and does not expose another user’s private data.

### What needs fixing next (no redesign)

1. **Email in public view:** Confirm whether `profiles.email` is auth or optional contact; if auth, remove from `public_profile_view`; if contact, keep optional and ensure it’s only shown when intended.  
2. **Single control plane for public visibility:** Move `public_location`, `public_pricing`, and `pricing` into the advanced edit so one page controls “what appears on the public page”.  
3. **UserProfilePage:** If the product ever shows “another user’s profile” inside the app, replace mock data with the real public payload (or a dedicated allowlisted API); do not show private or pricing data.

No broad refactor recommended; only the above fixes and clarity on email and control placement.
