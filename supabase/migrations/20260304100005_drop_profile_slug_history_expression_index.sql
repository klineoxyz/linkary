-- Schema tidy: drop redundant expression index on profile_slug_history.
-- Lookup uses .eq("old_slug", segmentNorm) and hits idx_profile_slug_history_old_slug_btree.
-- idx_profile_slug_history_old_slug was on LOWER(TRIM(old_slug)) and is no longer used.

DROP INDEX IF EXISTS public.idx_profile_slug_history_old_slug;
