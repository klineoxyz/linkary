# Source of Truth: Social Links and Hero Media

Proven from repo migrations, entity builder, DTO, and UI only. No guessing.

## 1. Where columns and tables live

**Searched:** `header_media_type`, `header_media_url`, `website`, `linkedin_url`, `telegram_url`, `youtube_url`, `x_url`, `profile_socials`, `profile_media`.

**Migrations that created them:**
- `supabase/migrations/20260225000000_public_one_pager.sql`
  - Creates `profile_socials` (profile_id, x_url, linkedin_url, youtube_url, website_url, telegram_url).
  - Creates `profile_media` (profile_id, header_media_type, header_media_url).
  - Creates `org_media` (org_id, header_media_type, header_media_url).
- `profiles.website` exists on `profiles` (e.g. `20260225000000` public_profile_view selects `p.website`; `20260229000000` adds column if missing).

## 2. Source of truth

| Data | Source of truth | Notes |
|------|------------------|--------|
| Social links (X, LinkedIn, YouTube, Website, Telegram) | **`profile_socials`** table | One row per profile (profile_id PK). Editor and public entity read/write this table. |
| Main “website” on profile (single link) | **`profiles.website`** | Exposed on public_profile_view; DTO maps it as top-level `website`. Editor keeps it in sync with the same value as profile_socials.website_url via updateMyProfile. |
| Hero media (profile) | **`profile_media`** table | header_media_type, header_media_url. One row per profile. |
| Hero media (org) | **`org_media`** table | Same columns; one row per org. |

So: social pills (X, LinkedIn, etc.) and hero media are **tables** (`profile_socials`, `profile_media`, `org_media`). The main “website” field on the 1-pager is **`profiles.website`**; the editor also writes that same value to `profile_socials.website_url` for consistency.

## 3. Write path (UI + API)

**Profile editor (logged-in):**
- File: `apps/web/src/figma/app/components/ProfileEditPage.tsx`
- Reads: `profile_media` (header_media_type, header_media_url), `profile_socials` (x_url, linkedin_url, youtube_url, website_url, telegram_url), and `me.website` from profile.
- Writes:
  - `profile_media`: upsert with header_media_type, header_media_url (URL sanitized via sanitizeUrl; invalid → NONE + null).
  - `profile_socials`: upsert with x_url, linkedin_url, youtube_url, website_url, telegram_url.
  - `profiles`: updateMyProfile(me.id, { website: website.trim() || null, ... }) so the main website and socials stay aligned.

**Other UI that touches header media:**
- `apps/web/src/figma/app/App.tsx` reads `profile_media` for overview header media (same table, same columns).

**Partner program URLs:** Written via `POST/PATCH /api/partners`; both routes sanitize website_url and logo_url with `sanitizeUrl` before insert/update.

## 4. Read path (public API + DTO + components)

**Entity builder:**
- File: `apps/web/src/lib/publicData.ts`
- Profile: `profile_socials` select by profile_id; `profile_media` select header_media_type, header_media_url by profile_id. Used in buildPublicProfileEntity and buildPublicProfileEntityWithClient.
- Org: `org_media` select by org_id in buildPublicOrgEntity and buildPublicOrgEntityWithClient.

**DTO:**
- File: `apps/web/src/lib/publicProfileDTO.ts`
- Profile DTO: `website` from entity.profile.website (i.e. profiles.website via public_profile_view); `socials` from entity.socials (profile_socials), all URL fields passed through sanitizeUrl.
- Header media: entity.headerMedia → DTO headerMedia (header_media_type, header_media_url); header_media_url sanitized.

**Public 1-pager component:**
- File: `apps/web/src/components/public/PublicOnePager.tsx`
- Social pills: entity.socials.x_url, linkedin_url, youtube_url, website_url, telegram_url.
- Hero: `entity.headerMedia?.header_media_type`, `entity.headerMedia?.header_media_url` passed to `<HeroMedia />` (`components/public/HeroMedia.tsx`).

## 5. Mismatches and legacy

- **No mismatch:** Editor, entity builder, and DTO all use `profile_socials` and `profile_media` for social links and hero media. No duplicate columns for those on `profiles`.
- **Dual website:** `profiles.website` (main website on 1-pager) and `profile_socials.website_url` (same value in socials). Editor writes both; public 1-pager uses profile.website for the main website and socials for the pills. This is intentional single value, two stores for different display roles; no migration needed if both are kept in sync (as they are today).

## 6. Recommendation

- **Keep current source of truth:** `profile_socials` for social links, `profile_media` for profile hero media, `org_media` for org hero media, `profiles.website` for the main website field.
- **No change** required for “single source of truth”; only ensure any future editor or API that sets website also updates `profiles.website` and (if desired) `profile_socials.website_url` together.
