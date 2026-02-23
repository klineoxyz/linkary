# Public Profile Editing

This doc describes how the logged-in Profile editor controls the public 1-pager (linkary.xyz/{username}) and the partner program rules.

## Source of truth

- **Public 1-pager reads from:**  
  Profile/org base data from `public_profile_view` / `public_org_view` (backed by `profiles` / `orgs`). Social links from `profile_socials`. Header media from `profile_media` (profiles) or `org_media` (orgs). Partner programs from `partner_programs`. Case studies from `case_studies`. Reviews from `reviews`.
- **Profile editor writes to:**  
  Base fields via `profiles` (e.g. `updateMyProfile`). Social links and header media via `profile_socials` and `profile_media` (upserts). Partner programs via `/api/partners` (writes to `partner_programs`). Case studies via Supabase client (writes to `case_studies`).  
  These are the same sources the public DTO uses; edits reflect on the 1-pager once the owner refreshes or uses the owner preview.

## Field mapping (profile → public 1-pager)

| Editor section      | Source / table        | Public 1-pager display                          |
|---------------------|-----------------------|-------------------------------------------------|
| Display name         | `profiles.display_name` | Hero name                                      |
| Bio                  | `profiles.bio`        | Hero bio                                       |
| Location             | `profiles.location`   | Profile meta                                   |
| Website              | `profiles.website`    | Socials / link                                 |
| Social links         | `profile_socials`     | Social pills (X, LinkedIn, YouTube, etc.)      |
| Header media         | `profile_media`      | Hero media (image/video/placeholder)           |
| Publish toggle       | `profiles.published`  | Page visibility (404 if unpublished)           |
| Partner programs     | `partner_programs`   | “Partners & programs” (affiliates + ambassadors)|
| Case studies         | `case_studies`       | Case Studies block                             |
| Roles (professions)  | profile_professions  | (App-specific; not on public DTO)              |

- **Twitter handle** is **read-only** in the profile editor; it is synced from X only (no manual edit). Use “Sync handle” from Integrations to update.

## Publish gating

The public page is only visible when:

- `profiles.published === true`
- **and** avatar is present (`profiles.avatar_url` non-empty)
- **and** bio is non-empty
- **and** at least one link is present (website or any social URL in `profile_socials`)

If the user toggles Publish without meeting these, the editor shows a checklist and blocks publish.

## Partner programs (affiliates / ambassadors)

- Stored in **`partner_programs`** (polymorphic: `owner_type` = `profile` | `org`, `owner_id` = profile id or org id).
- **Program types:** `affiliate`, `ambassador`.
- **Public DTO:** Only published entities expose partner rows. The DTO returns two arrays, `affiliates[]` and `ambassadors[]`, with allowlist fields: `name`, `website_url`, `logo_url`, `description`, `since_date`, `is_featured` (no internal ids). Ordering: featured first, then `sort_order`, then `created_at`.
- **URLs:** All URL fields are sanitized on write (API and DTO mapping); only `http`/`https` are allowed.
- **Editor:** Profile edit page has a “Partner programs” section with tabs (Affiliates | Ambassadors), list (with Featured badge when `is_featured`), add/edit modal (including Featured toggle), delete, and reorder (Up/Down via `sort_order`).
- **APIs:** `GET/POST /api/partners`, `PATCH/DELETE /api/partners/[id]`. Bearer auth and ownership checks (profile: `owner_id === auth.uid()`; org: `is_org_admin(owner_id, auth.uid())`). Rate limits: GET 60/10min, write 30/10min per user.

## Case studies

- Stored in **`case_studies`** (polymorphic: `owner_type` + `owner_profile_id` / `owner_org_id`).
- **Public DTO:** Only published entities; allowlist: `id`, `title`, `description`, `proof_url`, `created_at`. `proof_url` is sanitized. No private ids are exposed; `case_studies.id` is public-safe and used only as a stable key (e.g. list keys, edit links).
- **Editor:** Profile edit page lists case studies and allows add (title, description, proof URL). Delete via Supabase client (RLS enforces ownership).

## Hero media

- **Source:** `profile_media.header_media_type`, `profile_media.header_media_url`.
- **Editor:** Type = NONE | IMAGE | VIDEO; URL input. On save, URL is sanitized; if invalid, `header_media_url` is set to `null` and `header_media_type` to `NONE`.
- **Public:** Rendered via `HeroMedia` (YouTube/Vimeo/direct video/image; X embed supported for video URLs).

## Public URL and copy

- Public URL: `linkary.xyz/{username}` (username from `profiles.username` or `profiles.twitter_username`, normalized).
- Editor shows Copy, Open, and note: “Public updates can take up to 1 minute to appear.” When the owner views their own public page while logged in, the page uses an owner-only endpoint (no cache) so changes appear immediately; a “Refresh now” button is shown for the owner to refetch the latest DTO.

## Security and constraints

- **RLS:** All partner_programs and profile/org tables enforce ownership; public read only when owner is published.
- **twitter_username:** Never writable from profile edit; sync from X only.
- **Public API:** Allowlist-only DTO; no private fields in response. The only id exposed is `case_studies.id`, which is public-safe and used as a stable key.
