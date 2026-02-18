# Migration 20260218 – Notes (Prompt 2 + Prompt 5)

## Files changed

| File | Change |
|------|--------|
| `supabase/migrations/20260218000000_mvp_orgs_reputation_marketplace.sql` | **New** – full migration (ALTER profiles, CREATE orgs, org_members, org_affiliations, org_ambassadors, org_metrics, case_studies, jobs, applications, conversations, messages, deals, reviews; RLS; indexes; triggers). |
| `supabase/migrations/20260218100000_recompute_org_metrics_function.sql` | **New** (Prompt 5) – function `recompute_org_metrics(p_org_id)`: for company type includes descendant orgs recursively; otherwise direct affiliates + ambassadors. |
| `docs/SUPABASE_SCHEMA_AUDIT_PROMPT1.md` | **New** – Prompt 1 audit (report only). |
| `docs/MIGRATION_20260218_NOTES.md` | **New** – this file. |

No existing application code files were changed for Prompt 2 (schema only).

---

## Triggers

### 1. `check_org_ambassadors_max_per_profile` (BEFORE INSERT)

- **Table:** `org_ambassadors`
- **Purpose:** Enforce max 10 ambassadors per profile (count where `status IN ('invited','active')`).
- **Action:** On INSERT, counts rows for `NEW.profile_id` with status invited/active; if count ≥ 10, raises exception.

### 2. `check_org_ambassadors_max_per_profile_on_update` (BEFORE UPDATE)

- **Table:** `org_ambassadors`
- **Purpose:** When a row is updated from non‑active to `invited`/`active`, re-check that the profile still has ≤ 10 active/invited ambassadors.
- **Action:** If `NEW.status IN ('invited','active')` and `OLD.status` was not, counts other rows for the same profile; if count ≥ 10, raises exception.

---

## Constraints

| Table | Constraint | Effect |
|-------|------------|--------|
| **org_affiliations** | `UNIQUE(profile_id)` | At most one org affiliation per profile. |
| **org_ambassadors** | `UNIQUE(org_id, profile_id)` | One ambassador row per org–profile pair. |
| **org_ambassadors** | Trigger (above) | Max 10 orgs per profile as ambassador. |
| **case_studies** | `case_studies_owner_check` | Exactly one of `owner_profile_id` or `owner_org_id` set, according to `owner_type`. |
| **applications** | `applications_applicant_check` | Exactly one of `applicant_profile_id` or `applicant_org_id` set, according to `applicant_type`. |
| **messages** | `messages_sender_check` | Exactly one of `sender_profile_id` or `sender_org_id` set, according to `sender_type`. |
| **reviews** | `reviews_reviewer_check` / `reviews_reviewee_check` | Reviewer and reviewee each have exactly one ID set by type. |

---

## Profiles SELECT policy change

- **Before:** `profiles_select_public` allowed `SELECT USING (true)` (everyone could read every profile).
- **After:** `profiles_select_public` allows `SELECT USING (published = true OR auth.uid() = id)` (public only if `published`, or own row).
- **Effect:** Unpublished profiles are hidden from anonymous and other users; owner can always see their own.

---

## Prerequisites

- Tables `public.profiles` and `public.wallets` must already exist (e.g. created in Dashboard or an earlier migration).
- PostgreSQL supports `ADD COLUMN IF NOT EXISTS` (9.6+) and `EXECUTE FUNCTION` for triggers (11+); Supabase is on a compatible version.

---

## Idempotency

- `CREATE TABLE IF NOT EXISTS` and `CREATE INDEX IF NOT EXISTS` are used where applicable.
- `DROP POLICY IF EXISTS` before each `CREATE POLICY`.
- `ADD COLUMN IF NOT EXISTS` used on `profiles`.
- Trigger functions use `CREATE OR REPLACE`; triggers use `DROP TRIGGER IF EXISTS` then `CREATE TRIGGER`.
- Running the migration more than once should be safe; the only possible failure is if `profiles` was altered manually and a column already exists without `IF NOT EXISTS` (we use `IF NOT EXISTS` for the new columns).

---

## Prompt 5: Company influence (recompute function)

- **Function:** `public.recompute_org_metrics(p_org_id uuid)`.
- **Behavior:** If the org’s `org_type` is `'company'`, aggregates metrics from that org and all descendant orgs (recursive via `parent_org_id`). Otherwise aggregates only that org’s active affiliates and ambassadors. Writes to `org_metrics` (upsert).
- **Client:** Recompute Influence button in `OrgDetailPage` calls `recomputeOrgMetricsRpc(org.id)` from `@/lib/orgs`, which uses `supabase.rpc('recompute_org_metrics', { p_org_id: orgId })`.
