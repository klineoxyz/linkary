-- =============================================================================
-- CV upload: profile_documents table + profiles.cv_document_id
-- Storage bucket "profile-documents" must be created in Supabase Dashboard (private).
-- Path convention: profiles/{profile_id}/cv/{uuid}.pdf
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.profile_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  doc_type text NOT NULL CHECK (doc_type IN ('cv')),
  file_path text NOT NULL,
  file_name text,
  mime_type text DEFAULT 'application/pdf',
  size_bytes int,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_profile_documents_profile_id ON public.profile_documents (profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_documents_doc_type ON public.profile_documents (doc_type);

COMMENT ON TABLE public.profile_documents IS 'CV and other profile documents; file_path is storage path (e.g. profiles/{id}/cv/{uuid}.pdf)';

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS cv_document_id uuid REFERENCES public.profile_documents(id) ON DELETE SET NULL;

COMMENT ON COLUMN public.profiles.cv_document_id IS 'Current CV document when uploaded';

ALTER TABLE public.profile_documents ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profile_documents_select_own" ON public.profile_documents;
CREATE POLICY "profile_documents_select_own" ON public.profile_documents
  FOR SELECT USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_documents_insert_own" ON public.profile_documents;
CREATE POLICY "profile_documents_insert_own" ON public.profile_documents
  FOR INSERT WITH CHECK (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_documents_update_own" ON public.profile_documents;
CREATE POLICY "profile_documents_update_own" ON public.profile_documents
  FOR UPDATE USING (profile_id = auth.uid());

DROP POLICY IF EXISTS "profile_documents_delete_own" ON public.profile_documents;
CREATE POLICY "profile_documents_delete_own" ON public.profile_documents
  FOR DELETE USING (profile_id = auth.uid());
