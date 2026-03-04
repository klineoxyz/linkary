-- =============================================================================
-- Slug history lookup: confirm index is used (one-time check).
-- Replace <some_old_slug> with a real old_slug value that exists in the table.
-- =============================================================================
-- Expected: Index Scan using idx_profile_slug_history_old_slug_btree on profile_slug_history.
-- The app selects profile_id and orders by changed_at desc limit 1; this snippet uses
-- new_slug for a minimal check. Same index applies.

EXPLAIN (ANALYZE, BUFFERS)
SELECT new_slug
FROM public.profile_slug_history
WHERE old_slug = '<some_old_slug>'
LIMIT 1;

-- -----------------------------------------------------------------------------
-- List indexes on profile_slug_history (one-time check for redundancy).
-- After migration 20260304100005 only idx_profile_slug_history_old_slug_btree and
-- idx_profile_slug_history_profile_id should remain.
-- -----------------------------------------------------------------------------
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'profile_slug_history';
