# Media URL inputs audit (Prompt F)

## Checklist of locations that accepted image/media URLs (before replacement)

| Location | What it controls | Replacement |
|----------|------------------|-------------|
| `ProfileEditPage.tsx` | Header media (IMAGE) – input type="url" placeholder "https://… image URL" | MediaUploadField (profile_header) |
| `ProfileEditPage.tsx` | Header media (VIDEO) – input type="url" placeholder "https://… video URL" | Left as URL for external embed (YouTube/Vimeo) or future video upload |
| `ProfileEditPage.tsx` | Partner program logo – input type="url" placeholder "Logo URL" in PartnerProgramsEditor | MediaUploadField (partner_logo) |
| `ProfileEditPage.tsx` | Case study proof – input type="url" placeholder "Proof URL" in CaseStudiesEditor | MediaUploadField (case_study_proof) |
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
- **case_studies**: add `proof_file_path` (text); keep `proof_url` for backward compat.
- **Storage bucket**: `media` (private), paths: `profile/{id}/header/{uuid}.ext`, `org/{id}/logo/{uuid}.ext`, `partner/{id}/logo/{uuid}.ext`, `case_study/{id}/proof/{uuid}.ext`.

## Access control

- Public profile/org pages: serve media via signed URL or public URL from our domain only; no direct storage URLs in client for private bucket.

## Storage bucket setup

After running the migration `20260257000000_media_file_paths.sql`, create the storage bucket in Supabase:

1. Open **Supabase Dashboard** → **Storage**.
2. **New bucket**: name `media`, set to **Private**.
3. Path convention: `profile/{profile_id}/header/{uuid}.ext`, `org/{org_id}/logo/{uuid}.ext`, `partner/{partner_program_id}/logo/{uuid}.ext`, `case_study/{case_study_id}/proof/{uuid}.ext`.

APIs: `POST /api/media/upload-url`, `POST /api/media/commit`, `GET /api/media/signed-url?path=...`, `POST /api/media/remove`.
