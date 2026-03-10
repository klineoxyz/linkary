# Linkary: Public Resolver Usernames Migration (Phase 3)

**Purpose:** Switch the public root resolver to the usernames-based single-source-of-truth model so `/:segment` is deterministic and collision-free.  
**Scope:** Resolution logic and public page only. No `/app/...` move, no link migration, no redirects.  
**Reference:** `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` Phase 3; Phase 2 write enforcement done per `LINKARY_NAMESPACE_WRITE_ENFORCEMENT.md`.

---

## 1. Exact Files Changed

| File | Change |
|------|--------|
| `apps/web/src/lib/publicData.ts` | **getUsernameOwner(segment, client?):** New. Returns `{ owner_type, owner_id } \| null` from `usernames` for a normalized segment. **getPublicEntityByUsername:** Replaced "profile first, then org" logic with usernames-based resolution: lookup segment in `usernames` → read `owner_type` + `owner_id` → load from `public_profile_view` or `public_org_view` by id. Returns null if segment not in usernames or entity not in public view (e.g. unpublished). |
| `apps/web/src/app/(public)/[username]/page.tsx` | **Slug branch:** Removed direct profile-by-username/twitter and "profile first then getPublicEntityByUsername" path. Now: (1) `getPublicEntityByUsername(segmentLower, serviceSupabase)` (usernames-based). (2) If entity → resolve media, dto, render `PublicOnePagerWrapper`. (3) If null → `getUsernameOwner`; if owner_type=profile and owner_id=currentUser and profile unpublished → `OwnerUnpublishedProfile`. (4) Slug history redirect. (5) Reserved path → `AppWithProviders`. (6) Else `NotFoundClaimView`. Removed unused imports: `getPublicDTOByUsername`, `computeReputationIndex`, `PublicProfileContent`, `PublicProfileApiPayload`. All root public profiles and orgs now render via `PublicOnePagerWrapper` (unified one-pager). |

**Not changed:** `entityResolver.ts` (still calls `getPublicEntityByUsername`, which is now usernames-based). `/u/:username`, `/org/:slug` routes unchanged. `getPublicEntityForOwner` unchanged (used for owner preview flows).

---

## 2. How Root Resolution Works Now

1. **Segment type:** `getIdentifierKind(segment)` → `uuid` | `wallet` | `slug`. Only `slug` uses the new usernames-based path on the public page.
2. **For `kind === "slug"`:**
   - **Lookup:** `getPublicEntityByUsername(segmentLower, serviceSupabase)`:
     - Query `usernames` where `username` (normalized) equals segment (case-insensitive).
     - If no row → return null.
     - If row: `owner_type` + `owner_id`. If `owner_type === "profile"` → load from `public_profile_view` by `owner_id`; if `owner_type === "org"` → load from `public_org_view` by `owner_id`. Public views return only published entities; if no row (e.g. unpublished) → return null.
   - **Render:** If entity returned → resolve media, build DTO, render `PublicOnePagerWrapper` (profile or org).
   - **Owner-unpublished:** If null, `getUsernameOwner(segmentLower, serviceSupabase)`. If owner_type=profile and owner_id equals current user id, load profile from `profiles` by id; if profile exists and not published → render `OwnerUnpublishedProfile`.
   - **Slug history:** If still no render, query `profile_slug_history` for segment; if found, redirect 301 to `/:currentUsername`.
   - **Reserved:** If `isReservedPath(segmentLower)` → render `AppWithProviders`.
   - **Else:** `NotFoundClaimView`.
3. **For uuid/wallet:** Unchanged: `resolvePublicEntity(segment, …)` → `getPublicEntityById` or `getPublicEntityByWallet`; slug branch uses `getPublicEntityByUsername`, which is now usernames-based when called from `resolvePublicEntity` for slugs.

Determinism: one segment maps to at most one row in `usernames` → at most one owner (profile or org). No "profile first, then org" ordering; the table is the single source of truth.

---

## 3. How Reserved Paths Still Behave

- **When:** After usernames lookup and (if applicable) owner-unpublished check and slug-history redirect. If segment is not in usernames (or entity not in public view) and not owner-unpublished and no slug-history match, the page checks `isReservedPath(segmentLower)`.
- **Action:** If true → render `AppWithProviders` (SPA shell). Reserved segments are not looked up in `usernames` for resolution; they are treated as app routes.
- **Source:** `RESERVED_PATHS` in `apps/web/src/lib/reservedPaths.ts` (e.g. `app`, `api`, `u`, `org`, `dashboard`, …). No change to the list or to `isReservedPath`.

---

## 4. How Profile Slug History Behaves

- **When:** Only when `getPublicEntityByUsername` returns null and the owner-unpublished check does not apply (or profile is published).
- **Query:** `profile_slug_history` where `old_slug` = normalized segment, order by `changed_at` desc, limit 1. If a row exists, load `profiles.username` for that `profile_id`.
- **Action:** If current username is non-empty → `permanentRedirect(\`/\${currentUsername}\`)` (301 to canonical profile URL).
- **Preserved:** Same table, same index (`idx_profile_slug_history_old_slug_btree`), same redirect semantics. Only the order of checks changed (usernames and owner-unpublished before slug history).

---

## 5. How Public Org vs Public Profile Loading Works

- **Single path:** Both profiles and orgs are resolved from `usernames` only.
- **Profile:** Row in `usernames` with `owner_type = 'profile'`, `owner_id` = profile id. Load from `public_profile_view` by id (published only). Build entity with `buildPublicProfileEntity`; render via `PublicOnePagerWrapper`.
- **Org:** Row in `usernames` with `owner_type = 'org'`, `owner_id` = org id. Load from `public_org_view` by id (published only). Build entity with `buildPublicOrgEntity`; render via `PublicOnePagerWrapper`.
- **Unpublished profile:** Not in `public_profile_view`, so `getPublicEntityByUsername` returns null. If `getUsernameOwner` shows owner_type=profile and owner_id=current user, page loads profile from `profiles` and, if not published, renders `OwnerUnpublishedProfile`.
- **Unpublished org:** No special owner view; org not in `public_org_view` → null → slug history / reserved / not found.

---

## 6. Canonical / Metadata Logic

- **generateMetadata** for `kind === "slug"` already uses `getPublicEntityByUsername(segmentLower, serviceSupabase)`. With usernames-based resolution, metadata is aligned: entity comes from usernames → public view; `canonicalSlug` is profile username or org slug; title/description/robots follow entity type and published state.
- **Reserved:** If segment is reserved and no entity (or no serviceSupabase), metadata returns title "Linkary" and `robots: { index: false, follow: false }` where applicable.
- **Canonical URL:** `alternates.canonical` = `canonicalBaseUrl() / canonicalSlug`; canonicalSlug is from the resolved entity (profile or org) or segmentLower when no entity.

---

## 7. What Remains Before `/app/...` and `/org/:slug` Route Work

- **Resolver / public page:** Done for Phase 3. Root `/:segment` is usernames-based and deterministic.
- **Not in this phase:** Moving product routes under `/app/...`, migrating internal links, adding redirects. In-app `/u/:username` and `/org/:slug` routes and their behavior (e.g. wrong-type redirect to `/:segment`) are unchanged except that they rely on the same `getPublicEntityByUsername` when resolving by slug (e.g. metadata or shared helpers). No route migration was performed.

---

*End of document.*
