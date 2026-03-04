-- Remove invalid profile_slug_history rows (initial claims: empty/NULL old_slug).
-- Safe for production: only deletes rows that should never have been inserted.

DELETE FROM public.profile_slug_history
WHERE old_slug IS NULL
   OR btrim(old_slug) = '';

DELETE FROM public.profile_slug_history
WHERE new_slug IS NULL
   OR btrim(new_slug) = '';

-- Indexes from 20260304000000 remain valid (idx_profile_slug_history_old_slug, idx_profile_slug_history_profile_id).
-- No schema change; no reindex needed.
