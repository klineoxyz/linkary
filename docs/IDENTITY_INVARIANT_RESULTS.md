# Identity invariant verification (one-time)

**Date:** 2026-03-04  
**Queries:** Section E in `docs/SLUG_HISTORY_DEBUG.sql` (plus cross-table check 4).

Run in production/staging and record below. All must return **0 rows**.

---

## Results

| Check | Query | Result |
|-------|--------|--------|
| A) Duplicate `twitter_user_id` in profiles (non-empty) | Section E.1 | **0 rows** |
| B) Duplicate `(provider, provider_user_id)` in social_accounts (non-empty) | Section E.2 | **0 rows** |
| C) Multiple rows per `(user_id, provider)` in social_accounts | Section E.3 | **0 rows** |
| D) `profiles.twitter_user_id` ≠ `social_accounts.provider_user_id` for X provider | Section E.4 (cross-table) | **0 rows** |

---

## Slug history: no redirect for /muazxinthi

```sql
SELECT * FROM profile_slug_history WHERE old_slug = 'muazxinthi';
-- Expected: 0 rows (no redirect from /muazxinthi to any other slug, including /web3rehman).
```

**Result:** 0 rows (confirmed in production).

---

## Empty old_slug count

```sql
SELECT count(*) FROM profile_slug_history WHERE old_slug IS NULL OR btrim(old_slug) = '';
-- Expected: 0.
```

**Result:** 0 (confirmed after cleanup migration).
