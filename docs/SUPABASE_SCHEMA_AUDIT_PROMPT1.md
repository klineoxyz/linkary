# Prompt 1: Supabase schema audit (report only)

**Date:** 2026-02-18

---

## 1) Repo migrations

| Migration file | Creates tables? | Content |
|----------------|-----------------|---------|
| `supabase/migrations/20260217000000_rls_and_constraints.sql` | **No** | RLS policies + indexes only. Assumes `public.profiles` and `public.wallets` already exist. Optional RLS for `wallet_link_nonces` if that table exists. |

**Conclusion:** No migration in the repo creates tables. Table definitions were likely created in Supabase Dashboard or elsewhere.

---

## 2) SQL table definitions in repo

- **CREATE TABLE:** Searched all `*.sql` in repo — **no CREATE TABLE** found.
- **orgs, jobs, applications, conversations, messages, deals, reviews, org_members, org_affiliations, org_ambassadors, org_metrics, case_studies:** None of these appear in any SQL or table-reference in the repo.

---

## 3) Tables referenced in code

| Table | Where referenced |
|-------|-------------------|
| **profiles** | `apps/web/src/lib/db.ts` — constant `PROFILES`, `getProfileByUsername()` |
| **wallets** | `apps/web/src/lib/db.ts` — constant `WALLETS`, `getWalletsByUserId()`; `apps/web/src/lib/wallets.ts` — get, update, insert |

**Server routes:** `apps/web/src/app/[username]/page.tsx` uses `getProfileByUsername` and `getWalletsByUserId` (no direct `.from()`). No other server routes reference Supabase tables in this codebase.

**Conditional in migration only:** `wallet_link_nonces` — RLS applied only if the table exists; not referenced in app code.

---

## 4) MVP required tables — checklist

| Table | Exists in repo migrations | Referenced in code | Likely in Supabase Dashboard | Missing entirely |
|------|---------------------------|--------------------|------------------------------|------------------|
| **profiles** | No (no CREATE) | Yes | Unknown (RLS assumes it exists) | — |
| **wallets** | No (no CREATE) | Yes | Unknown (RLS assumes it exists) | — |
| **wallet_link_nonces** | No | No | Unknown | Optional |
| **orgs** | No | No | No | **Yes** |
| **org_members** | No | No | No | **Yes** |
| **org_affiliations** | No | No | No | **Yes** |
| **org_ambassadors** | No | No | No | **Yes** |
| **org_metrics** | No | No | No | **Yes** |
| **case_studies** | No | No | No | **Yes** |
| **jobs** | No | No | No | **Yes** |
| **applications** | No | No | No | **Yes** |
| **conversations** | No | No | No | **Yes** |
| **messages** | No | No | No | **Yes** |
| **deals** | No | No | No | **Yes** |
| **reviews** | No | No | No | **Yes** |

---

## Summary

- **In repo:** One migration file; it only adds RLS and indexes for `profiles` and `wallets`. No table-creation SQL.
- **In code:** Only `profiles` and `wallets` are used (`db.ts`, `wallets.ts`, and indirectly via `[username]` page).
- **Missing for MVP:** All new tables (orgs, org_members, org_affiliations, org_ambassadors, org_metrics, case_studies, jobs, applications, conversations, messages, deals, reviews) are missing from the repo and must be added via a new migration (and may or may not exist in the remote project; assume missing).
