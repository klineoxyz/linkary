# Supabase migrations

Project ref: **itelswsgmdnydylclgzw**

## Push migrations

1. **Link** (one time; requires Supabase login):
   ```bash
   npx supabase link --project-ref itelswsgmdnydylclgzw
   ```
   Use your database password when prompted (Dashboard → Settings → Database).

2. **Push**:
   ```bash
   pnpm db:push
   ```
   or:
   ```bash
   npx supabase db push
   ```

Migrations run in order: `20260217000000_rls_and_constraints.sql`, `20260218000000_mvp_orgs_reputation_marketplace.sql`, `20260218100000_recompute_org_metrics_function.sql`. Ensure **profiles** and **wallets** tables exist (create in Dashboard if needed).
