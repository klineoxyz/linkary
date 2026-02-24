# CV Upload Setup

After running the migration `20260252000000_profile_documents_cv.sql`, create the storage bucket in Supabase:

1. Open **Supabase Dashboard** → **Storage**.
2. **New bucket**: name `profile-documents`, set to **Private**.
3. Path convention: files are stored at `profiles/{profile_id}/cv/{uuid}.pdf`.

APIs used:
- `POST /api/profile/cv/upload-url` – get signed upload URL
- `POST /api/profile/cv/commit` – save document row and set `profiles.cv_document_id`
- `POST /api/profile/cv/delete` – remove CV and clear reference
- `GET /api/applications/[id]/cv-download` – org admin signed download URL when `shared_cv=true`
