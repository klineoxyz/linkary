# Supabase migrations

All backend SQL is applied via migrations in this folder. Apply them **in filename order** so dependencies (tables, views, RLS) are created in the right sequence.

## Order (oldest → newest)

| # | Migration | Purpose |
|---|-----------|---------|
| 1 | `20260217000000_rls_and_constraints.sql` | RLS policies and base constraints |
| 2 | `20260218000000_mvp_orgs_reputation_marketplace.sql` | Orgs, reputation, marketplace tables |
| 3 | `20260218100000_recompute_org_metrics_function.sql` | Function to recompute org metrics |
| 4 | `20260218200000_wallet_identities.sql` | Wallet identities (wallet → profile resolution) |
| 5 | `20260219000000_profiles_twitter_connect.sql` | Twitter/X fields on profiles |
| 6 | `20260220000000_x_analytics_ingestion.sql` | X analytics tables and ingestion |
| 7 | `20260221000000_usernames_claim.sql` | Usernames table and claim flow |
| 8 | `20260222000000_claim_username_handle_profiles_unique.sql` | Uniqueness for usernames/handles |
| 9 | `20260223000000_professions.sql` | Professions / profile metadata |
| 10 | `20260224000000_profile_analytics_baseline.sql` | Profile analytics baseline |
| 11 | `20260225000000_public_one_pager.sql` | Public one-pager (xscore on profiles/orgs, views) |
| 12 | `20260226000000_public_org_view_xscore.sql` | Add xscore to public_org_view |
| 13 | `20260227000000_public_layout.sql` | public_layout + view updates |
| 14 | `20260228000000_social_accounts_and_analytics_backfill.sql` | social_accounts, x_daily_snapshots, x_window_aggregates, backfill job |
| 15 | `20260229000000_ensure_supabase_schema.sql` | Idempotent: missing columns, ethos_scores, grants |
| 16 | `20260230000000_superadmin_and_profile_email.sql` | superadmin_emails table (mmxinthi@gmail.com), profiles.email |
| … | *(migrations 31–37 in folder)* | orgs, wallet CDP, analytics, profiles x_connected, etc. |
| 17 | `20260238000000_social_accounts_get_my_social_x.sql` | RPC `get_my_social_x()` (SECURITY DEFINER) so Integrations can read own X connection reliably |
| 18 | `20260239000000_applications_rls_and_job_admin.sql` | applications RLS private (applicant + job org admin only); `is_job_org_admin()`; duplicate-application unique indexes |
| 19 | `20260240000000_social_accounts_grants_and_rpc.sql` | GRANT on social_accounts for authenticated/anon; ensure get_my_social_x() for Integrations |
| 20 | `20260241000000_social_accounts_x_connect_forever.sql` | One active X per user; one X account per Linkary user (partial unique indexes); RLS verification |
| 21 | `20260242000000_social_accounts_rls_explicit.sql` | RLS policies explicit (SELECT/INSERT/UPDATE by user_id = auth.uid()); fixes row visible in DB but not to user |
| 22 | `20260243000000_profiles_one_cdp_wallet_per_address.sql` | Unique index on profiles(cdp_wallet_address) so one wallet cannot link to two profiles; run after resolving duplicates |

## How to apply

### Option A: Supabase CLI (recommended)

From the repo root:

```bash
supabase link   # if not already linked to your project
supabase db push
```

This applies any migrations that haven’t been applied yet.

**If you see `Found local migration files to be inserted before the last migration on remote database`:**  
Run with `--include-all` so older-timestamped local migrations are still applied:  
`pnpm db:push:all` (or `npx supabase db push --include-all`).

**If you see `duplicate key value violates unique constraint "schema_migrations_pkey"`:**  
Mark the migration reverted, then push again:  
`npx supabase migration repair 20260401000000 --status reverted` then `pnpm db:push`. The migration SQL is idempotent.

### Option B: Supabase Dashboard (SQL Editor)

1. Open your project → **SQL Editor**.
2. Run each migration file **in the order above**, one at a time (copy/paste or upload).
3. Run `20260229000000_ensure_supabase_schema.sql` and then `20260230000000_superadmin_and_profile_email.sql` so superadmin list and profile email are in place.

### Prerequisites

- **profiles** and **wallets** (or equivalent auth-backed tables) must exist. They are often created by Supabase Auth triggers or an initial project setup; if your project doesn’t have them, add a migration or seed that creates them before running the list above.
- Use **service role** for worker and server-only access (e.g. `wallet_identities`, analytics jobs, x-sync backfill).

After all migrations are applied, the backend (web app + worker) expects the full schema including `public_profile_view`, `public_org_view`, `x_daily_snapshots`, `x_window_aggregates`, `social_accounts`, and `ethos_scores` to be present and up to date.

| … | `20260426120000_plan_key_ops_members_audit_log.sql` | `subscriptions.plan_key`, backfill from `tier`; `internal_ops_members`; `platform_audit_log` (service-role only) |
| … | `20260427120000_batch2_usage_x_cache_follow_fields.sql` | `plan_usage_counters`; `external_x_profile_cache`; CRM `follow_rules` + participant follow JSON; audit `target_id` comment |
| … | `20260428120000_platform_ops_entitlements.sql` | `platform_ops_entitlements` (comp / discount metadata / plan override; service-role only) |
| … | `20260429120000_ops_writes_atomic_rpc.sql` | Atomic `ops_atomic_*` RPCs (entitlement writes + audit; usage reset + audit); `EXECUTE` for `service_role` only |
