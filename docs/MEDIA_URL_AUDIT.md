# Media URL inputs audit (Prompt F)

## Checklist of locations that accepted image/media URLs (before replacement)

| Location | What it controls | Replacement |
|----------|------------------|-------------|
| `ProfileEditPage.tsx` | Header media (IMAGE) – input type="url" placeholder "https://… image URL" | MediaUploadField (profile_header) |
| `ProfileEditPage.tsx` | Header media (VIDEO) – embed URL only | **Embed video URL (YouTube/Vimeo)** – embed link only, not an uploaded file. |
| `ProfileEditPage.tsx` | Partner program logo – input type="url" placeholder "Logo URL" in PartnerProgramsEditor | MediaUploadField (partner_logo) |
| `ProfileEditPage.tsx` | Case study proof – link to evidence (article, tweet, etc.) | **Remains URL** (proof_url). Not image upload. |
| `CreateOrgModal.tsx` | Org logo – input type="url" placeholder "https://...", state `logo_url` | MediaUploadField (org_logo) after org create |
| `apps/web/src/app/api/orgs/create/route.ts` | Body `logo_url` string | Accept `logo_file_path` from client after upload, or omit and set via media commit |
| `apps/web/src/app/api/partners/route.ts` | Body `logoUrl` / `logo_url` | Accept `logo_file_path` from media commit |
| `apps/web/src/app/api/partners/[id]/route.ts` | PATCH body `logoUrl` | Accept `logo_file_path` |

## Non–image URL inputs (unchanged)

- Website, X/LinkedIn/YouTube links: remain URL inputs (not image upload).
- DexScreener link (OrgDetailPage): chart URL, not image; leave as URL.
- Placeholder "https://..." for website in OnboardingPage: website URL, not media; leave as URL.

## DB and storage

- **profile_media**: add `header_media_file_path` (text); keep `header_media_url` for backward compat / derived URL.
- **orgs**: add `logo_file_path` (text); keep `logo_url` for backward compat / derived URL.
- **partner_programs**: add `logo_file_path` (text); keep `logo_url` for backward compat.
- **case_studies**: `proof_url` only (URL input for links). Case study proof is URL-only; no storage path or upload. Upload/commit/remove APIs may still accept type `case_study_proof` for **future optional attachment** only; no path convention in use.
- **Storage bucket**: `media` (private). Path conventions (only these three): **profile header image** `profile/{profile_id}/header/{uuid}.ext`, **org logo** `org/{org_id}/logo/{uuid}.ext`, **partner logo** `partner/{partner_program_id}/logo/{uuid}.ext`.

## Access control and rendering

- Any media stored as `file_path` must be rendered via `GET /api/media/signed-url?path=...`; no client should reference Supabase storage private URLs directly.
- Fallback: when `file_path` is missing and legacy `*_url` exists, use it only if it is our domain or explicitly allowed (e.g. YouTube/Vimeo embed URLs for header video).
- Public profile/org pages: serve media via signed URL or public URL from our domain only; no direct storage URLs in client for private bucket.

## Storage bucket setup

After running the migration `20260257000000_media_file_paths.sql`, create the storage bucket in Supabase:

1. Open **Supabase Dashboard** → **Storage**.
2. **New bucket**: name `media`, set to **Private**.
3. Path conventions (only these three): `profile/{profile_id}/header/{uuid}.ext`, `org/{org_id}/logo/{uuid}.ext`, `partner/{partner_program_id}/logo/{uuid}.ext`. Case study proof is URL-only; `case_study_proof` in upload/commit/remove APIs is reserved for future optional attachment.

APIs: `POST /api/media/upload-url`, `POST /api/media/commit`, `GET /api/media/signed-url?path=...`, `POST /api/media/remove`.
