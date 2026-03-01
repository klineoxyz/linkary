-- Add optional link from partner_programs to a profile (e.g. project found by X handle).
-- Enables Phase 1: search by name/X handle and store linked profile; later claim + accept.

BEGIN;

ALTER TABLE public.partner_programs
  ADD COLUMN IF NOT EXISTS target_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_partner_programs_target_profile_id
  ON public.partner_programs (target_profile_id)
  WHERE target_profile_id IS NOT NULL;

COMMENT ON COLUMN public.partner_programs.target_profile_id IS 'Optional: profile (e.g. project) this partner program is linked to; set when added via search by name/X handle.';

COMMIT;
