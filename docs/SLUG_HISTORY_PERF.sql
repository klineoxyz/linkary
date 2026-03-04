-- =============================================================================
-- Slug history lookup: confirm index is used (one-time perf proof).
-- Replace <real_old_slug> with an actual old_slug value that exists in the table.
-- Run in production/staging; expect: Index Scan using idx_profile_slug_history_old_slug_btree.
-- =============================================================================

EXPLAIN (ANALYZE, BUFFERS)
SELECT new_slug
FROM public.profile_slug_history
WHERE old_slug = '<real_old_slug>'
LIMIT 1;

-- -----------------------------------------------------------------------------
-- List indexes on profile_slug_history (one-time check for redundancy).
-- After migration 20260304100005 only idx_profile_slug_history_old_slug_btree and
-- idx_profile_slug_history_profile_id should remain.
-- -----------------------------------------------------------------------------
-- SELECT indexname, indexdef
-- FROM pg_indexes
-- WHERE tablename = 'profile_slug_history';
