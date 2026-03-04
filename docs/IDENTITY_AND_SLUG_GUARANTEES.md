# Identity and slug guarantees

**Critical rule:** The X user ID (`profiles.twitter_user_id` / `social_accounts.provider_user_id`) is the **single source of truth for user identity**. A profile may change its slug or X handle, but its X user ID must **never** change once linked. Two different X accounts must never resolve to the same profile.

## Property mutability

| Property | Can change |
|----------|------------|
| `profiles.twitter_user_id` | ❌ **NEVER** (immutable once set) |
| `profiles.twitter_username` | ✅ Yes |
| `profiles.username` (slug) | ✅ Yes |

## Enforcement

- **Database:** Trigger `trg_profiles_twitter_user_id_immutable` (migration `20260304100002_profiles_twitter_user_id_immutable.sql`) raises an exception if `profiles.twitter_user_id` is updated to a different value when it was already set.
- **Slug history:** Trigger `profile_slug_history_on_username_change` records only **real** slug changes (non-null, non-empty OLD and NEW, and different after normalization). It never inserts NULL/empty → slug. See `20260304100000_profile_slug_history_trigger_fix.sql`.
- **Diagnostics:** `docs/SLUG_HISTORY_DEBUG.sql` contains queries for profile identity, X linkage (`social_accounts`), slug ownership (`usernames`), and slug history. It also includes an invariant check: no profile should have more than one distinct `provider_user_id` per provider (e.g. `twitter`).

## social_accounts consistency

A profile must not have multiple different `provider_user_id` values for the same provider (`twitter`). Validation query in `docs/SLUG_HISTORY_DEBUG.sql` (section B) finds violations. Application code must not attach a second X account to a profile that already has a different `provider_user_id`.
