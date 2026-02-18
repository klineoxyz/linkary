# Supabase Setup Audit (Prompt 1)

**Date:** 2026-02-18  
**Purpose:** Confirm where Supabase is used, what schema is referenced in code, and how it aligns with the figma demo.

---

## 1) Summary of current Supabase integration

- **Client:** One browser client in `apps/web/src/lib/supabase.ts`, created with `createClient(supabaseUrl, supabaseAnonKey)`. Env: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (required at runtime).
- **Auth:** Supabase Auth is used only in a few places: `test-supabase` page (`getSession()`), `WalletsSection.tsx` (session for wallet UI). No login/signup UI in the figma app; no session bootstrap in App.tsx.
- **Tables in use:** `profiles`, `wallets`. Optional: `wallet_link_nonces` (referenced in RLS migration only).
- **Access pattern:** Server-side: `[username]` page uses `getProfileByUsername` and `getWalletsByUserId` from `@/lib/db.ts`. Client-side: `WalletsSection` uses `supabase.auth.getSession()` and likely table access for wallets. No other figma app routes hit Supabase yet.
- **Schema in repo:** There is **no** `CREATE TABLE` migration in the repo. `supabase/migrations/20260217000000_rls_and_constraints.sql` only adds RLS and indexes; it assumes `public.profiles` and `public.wallets` already exist. Table definitions were likely created in Supabase Dashboard or another migration not in this repo.

---

## 2) Exact schema fields referenced in code

### Profiles

Defined in **`apps/web/src/lib/db.ts`** and used in **`apps/web/src/app/[username]/page.tsx`**:

| Field (code)              | Type (in ts)   | Used in UI / API |
|--------------------------|----------------|-------------------|
| `id`                     | string         | Yes (profile id, auth.uid()) |
| `username`               | string \| null | Yes (handle-like; shown as @username, lookup by LOWER(username)) |
| `display_name`           | string \| null | Yes |
| `bio`                    | string \| null | Yes |
| `avatar_url`             | string \| null | Yes |
| `website`                | string \| null | Yes |
| `twitter_username`       | string \| null | Yes (in type; not rendered on [username] page) |
| `onboarding_completed_at`| string \| null | In type only; not read in app yet |
| `created_at`             | string         | In type only |
| `updated_at`             | string         | In type only |

Index in migration: `idx_profiles_username_lower ON public.profiles (LOWER(username))`.

**Not in code:** `published`, `location`, `intents` (or any JSON for Creator/Brand/Both). These are MVP additions.

### Wallets

From **`apps/web/src/lib/db.ts`** and **`[username]/page.tsx`**:

| Field       | Type (in ts)   | Used in UI / API |
|------------|----------------|-------------------|
| `id`       | string         | Yes |
| `user_id`  | string         | Yes (filter by user) |
| `chain`    | string         | Yes |
| `address`  | string         | Yes |
| `is_primary` | boolean      | Yes |
| `verified_at` | string \| null | In type only |
| `created_at` | string       | In type only |

Index: `idx_wallets_user_id ON public.wallets (user_id)`.

---

## 3) RLS policies (from migration)

### Profiles

- **SELECT:** `USING (true)` — public read.
- **INSERT:** `WITH CHECK (auth.uid() = id)` — only insert your own row (id = user id).
- **UPDATE:** `USING (auth.uid() = id)` — only update your own row.

No DELETE policy (so no row-level delete for profiles from client).

### Wallets

- **SELECT:** `USING (true)` — public read.
- **INSERT:** `WITH CHECK (auth.uid() = user_id)`.
- **UPDATE:** `USING (auth.uid() = user_id)`.
- **DELETE:** `USING (auth.uid() = user_id)`.

### wallet_link_nonces (optional)

If the table exists: SELECT/INSERT/UPDATE restricted to `auth.uid() = user_id`.

---

## 4) Mismatch: figma demo vs DB fields

| Figma / demo field | DB / code field    | Notes |
|--------------------|--------------------|--------|
| `handle`           | `username`         | Same meaning. Map `handle` → `username` when saving; show `username` as handle in UI. |
| `name`             | `display_name`     | Same. Use `display_name` in API/DB. |
| `location`         | —                  | Not in Profile type or [username] page. Add column if MVP needs it. |
| `ethos`, `xscore`, `reviews`, `roleTags`, `verified` | — | Not in profiles table. Demo-only or future tables (e.g. reputation, reviews). |
| `published`        | —                  | Not in code. Add to profiles for “show public page” toggle. |
| `intents` (Creator/Brand/Both) | —        | Not in code. Add column (e.g. `intents jsonb` or `text[]`) for onboarding. |
| Org/brand fields (slug, name, tagline, …) | — | No `orgs` table in repo yet. Required for Prompt 5. |

---

## 5) Environment variables

- `NEXT_PUBLIC_SUPABASE_URL` — required.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — required.

No service role key is referenced in the web app (only anon client).

---

## 6) Suggested schema additions for MVP (for mega prompt)

- **profiles:** Add `published boolean DEFAULT false`, `location text`, `intents jsonb` (or array) if you store Creator/Brand/Both. Keep `username` as the handle.
- **New tables:** orgs, org_members, jobs, applications, conversations, messages, deals, reviews (and optionally verification_claims, analytics_events) per MVP_FRONTEND_AUDIT.md.
- **Public page:** When `published` is added, in `[username]` page: if `profile.published === false`, return 404 or a “not published” view.

Use this doc plus `docs/MVP_FRONTEND_AUDIT.md` as the baseline for the Cursor mega prompt (SQL schema, RLS, helpers, route wiring).
