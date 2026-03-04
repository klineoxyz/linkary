-- Schema tidy: drop redundant expression index on profile_slug_history.
-- Apply ONLY after confirming:
--   - Routing uses .eq("old_slug", segmentNorm) (apps/web (public)/[username]/page.tsx).
--   - No other code queries profile_slug_history by LOWER(TRIM(old_slug)).
-- Lookup uses idx_profile_slug_history_old_slug_btree on (old_slug).

DROP INDEX IF EXISTS public.idx_profile_slug_history_old_slug;
