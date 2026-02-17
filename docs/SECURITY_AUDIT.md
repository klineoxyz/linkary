# Linkary Security Audit Report

**Stack:** Next.js (Vercel) + Supabase + Railway  
**Date:** 2026-02  
**Scope:** Secrets, Auth, Supabase RLS, API routes, Background jobs, Cost/Abuse

---

## 0) Repo Map & Security-Critical Code

```
Linkary/
├── apps/
│   ├── web/                    # Next.js (Vercel)
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx              # Entry / (LinkaryApp)
│   │   │   │   ├── app/page.tsx           # Redirect to /
│   │   │   │   ├── test-supabase/page.tsx # Dev-only test
│   │   │   │   └── [username]/page.tsx    # Public profile (server)
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts            # Client Supabase (anon key)
│   │   │   │   ├── db.ts                  # Server: getProfileByUsername, getWalletsByUserId
│   │   │   │   └── wallets.ts             # Client + server: getWalletsByUserId, upsertWallet
│   │   │   └── figma/                     # UI (client components using supabase auth)
│   │   └── .env.example                   # Client env template only
│   │
│   └── api/                    # Fastify (Railway)
│       ├── src/
│       │   ├── index.ts
│       │   ├── lib/supabase.ts            # Service role (server-only)
│       │   └── routes/
│       │       ├── health.ts              # GET /health
│       │       └── wallet.ts              # POST /wallet/nonce, /wallet/verify (501)
│       └── .env.example                   # SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
│
├── supabase/
│   └── migrations/                        # RLS + indexes (added in this audit)
│
├── .gitignore                             # .env*, apps/api/.env
└── docs/SECURITY_AUDIT.md                 # This file
```

**Security-critical locations:**

| Area | Path | Notes |
|------|------|--------|
| Supabase client (anon) | `apps/web/src/lib/supabase.ts` | Used by client; RLS must enforce all write/read rules |
| Supabase client (service) | `apps/api/src/lib/supabase.ts` | Server-only; never expose to client |
| DB access (server) | `apps/web/src/lib/db.ts` | Used only by `[username]/page.tsx` (server component) |
| Wallet writes (client) | `apps/web/src/lib/wallets.ts` | Client calls upsertWallet; RLS must restrict to auth.uid() = user_id |
| Auth usage (client) | `WalletsSection.tsx`, `PublicProfilePage.tsx`, `test-supabase/page.tsx` | `supabase.auth.getSession()` for owner check |
| Public profile | `apps/web/src/app/[username]/page.tsx` | Server-rendered; no auth; validate username |
| Railway API | `apps/api/src/routes/*` | No auth/validation yet on wallet routes |

**Not present in repo:** Next.js `/api` routes, Supabase migration files (until added), any cron/worker code.

---

## 1) Executive Summary

1. **Secrets:** Anon key is correctly `NEXT_PUBLIC_*` (client); service role is server-only in `apps/api`. No `.env` committed; `.gitignore` covers env files.
2. **No Next.js API routes** exist under `apps/web/src/app`—no server-side API auth or rate limiting to audit; all data access is via Supabase from server components or client with RLS.
3. **Supabase RLS** is assumed on `profiles` and `wallets` (per prior context); **no migration files exist in repo**—schema and RLS are not version-controlled.
4. **Public profile route** `/[username]` is server-rendered and reads from Supabase (profiles + wallets); no auth required by design; no rate limiting or caching.
5. **Railway API** (`apps/api`) exposes `/health`, `POST /wallet/nonce`, `POST /wallet/verify` (501 stubs); no auth, no input validation, no rate limiting yet.
6. **Client-side wallet writes** go through `lib/wallets.ts` using anon client; security depends entirely on Supabase RLS (`auth.uid() = user_id` for writes).
7. **No background workers or cron** in the repo; no analytics ingestion, dedup, or retry logic to audit.
8. **Test route** `/test-supabase` is dev-only (404 in prod); reserved in `[username]` so it cannot be claimed as a username.
9. **Risk:** If RLS is misconfigured or missing on any table, data could be exposed or overwritten; schema/RLS must be documented and applied via migrations.
10. **Recommendation:** Add Supabase migrations to repo, enforce RLS on all tables, add server-side validation and rate limiting when implementing wallet verify and any future API routes.

---

## 2) Risk Register

| Severity | Finding | Impact | Evidence | Fix | Effort |
|----------|---------|--------|----------|-----|--------|
| **Critical** | No Supabase migrations in repo; RLS/schema not version-controlled | Schema drift, RLS gaps, no audit trail | No files under `supabase/migrations/` or similar | Add migrations for `profiles`, `wallets`, `wallet_link_nonces` with RLS and constraints | M |
| **High** | RLS policies not verified in repo | Unauthorized read/write if policies missing or wrong | N/A – policies only in Supabase dashboard | Document and add RLS policies in migrations; verify in checklist below | M |
| **High** | Railway wallet endpoints have no auth or validation | When implemented, could accept arbitrary input or be abused | `apps/api/src/routes/wallet.ts` (501 stubs) | Add auth (e.g. Supabase JWT), Zod validation, rate limiting before implementing | M |
| **Med** | Public profile `/[username]` has no rate limiting or caching | DoS or cost from repeated profile fetches | `apps/web/src/app/[username]/page.tsx` calls `getProfileByUsername`, `getWalletsByUserId` | Add caching (e.g. `unstable_cache` or CDN) and optional rate limit | S |
| **Med** | Client wallet upsert relies only on RLS; no server-side re-check | If RLS misconfigured, any user could write to any user_id | `apps/web/src/lib/wallets.ts` – `upsertWallet` uses anon client | Keep RLS; when adding API, optionally proxy wallet writes via API with auth | L |
| **Med** | No input validation on `[username]` beyond reserved list | Very long or malicious username could hit DB | `apps/web/src/app/[username]/page.tsx` – `username` from params | Validate length and pattern (e.g. alphanumeric + underscore, max 64) before query | S |
| **Low** | `NEXT_PUBLIC_SUPABASE_*` in client bundle | Anon key is public by design; acceptable if RLS is correct | `apps/web/src/lib/supabase.ts` L3–4 | No change; ensure RLS is strict. Do not add service role to client | - |
| **Low** | Railway API has no CORS or auth on /health | /health is public by design; acceptable for liveness | `apps/api/src/routes/health.ts` | Optional: restrict /health to internal only in production | S |
| **Low** | No `.env.example` for Next.js app | Developers might commit secrets or misconfigure | Only `apps/api/.env.example` exists | Add `apps/web/.env.example` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` only | S |

---

## 3) Quick Wins (Today)

- Add **`apps/web/.env.example`** with only `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (no secrets).
- Add **username validation** in `[username]/page.tsx`: reject if length > 64 or invalid pattern before calling `getProfileByUsername`.
- Create **`supabase/migrations/`** and add initial migration that enables RLS on `profiles`, `wallets`, `wallet_link_nonces` and defines policies (see Patch Set).

---

## 4) Fix Plan (7 Days)

| Day | Task |
|-----|------|
| 1 | Quick wins: .env.example, username validation, migrations folder + first RLS migration |
| 2 | Run migration on Supabase; verify RLS with tests or manual checks; document in RLS checklist |
| 3 | Add indexes (see Patch Set) for `profiles(username)`, `wallets(user_id)`, and any high-read paths |
| 4 | Add caching for `/[username]` (e.g. `unstable_cache` 60s) and optional rate limit (e.g. Vercel or middleware) |
| 5 | Railway: add Zod schemas and auth middleware for `/wallet/nonce` and `/wallet/verify` when implementing |
| 6 | Add request logging and error handling to Railway routes (no stack traces in responses) |
| 7 | Re-audit: confirm RLS checklist, no secrets in client, and abuse surface reduced |

---

## 5) Patch Set

### 5.1 SQL migrations (Supabase)

Create `supabase/migrations/20260217000000_rls_and_constraints.sql` (run in Supabase SQL editor or via CLI if configured):

```sql
-- =============================================================================
-- RLS for public.profiles
-- =============================================================================
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "profiles_select_public" ON public.profiles;
CREATE POLICY "profiles_select_public" ON public.profiles
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "profiles_insert_own" ON public.profiles;
CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

-- =============================================================================
-- RLS for public.wallets
-- =============================================================================
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "wallets_select_public" ON public.wallets;
CREATE POLICY "wallets_select_public" ON public.wallets
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "wallets_insert_own" ON public.wallets;
CREATE POLICY "wallets_insert_own" ON public.wallets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_update_own" ON public.wallets;
CREATE POLICY "wallets_update_own" ON public.wallets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "wallets_delete_own" ON public.wallets;
CREATE POLICY "wallets_delete_own" ON public.wallets
  FOR DELETE USING (auth.uid() = user_id);

-- =============================================================================
-- RLS for public.wallet_link_nonces (if table exists)
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'wallet_link_nonces') THEN
    EXECUTE 'ALTER TABLE public.wallet_link_nonces ENABLE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_link_nonces_select_own" ON public.wallet_link_nonces';
    EXECUTE 'CREATE POLICY "wallet_link_nonces_select_own" ON public.wallet_link_nonces FOR SELECT USING (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_link_nonces_insert_own" ON public.wallet_link_nonces';
    EXECUTE 'CREATE POLICY "wallet_link_nonces_insert_own" ON public.wallet_link_nonces FOR INSERT WITH CHECK (auth.uid() = user_id)';
    EXECUTE 'DROP POLICY IF EXISTS "wallet_link_nonces_update_own" ON public.wallet_link_nonces';
    EXECUTE 'CREATE POLICY "wallet_link_nonces_update_own" ON public.wallet_link_nonces FOR UPDATE USING (auth.uid() = user_id)';
  END IF;
END $$;

-- =============================================================================
-- Indexes for high-read paths
-- =============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_username_lower ON public.profiles (LOWER(username));
CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON public.wallets (user_id);

-- =============================================================================
-- Optional: tighten constraints (adjust if schema differs)
-- =============================================================================
-- ALTER TABLE public.profiles ADD CONSTRAINT profiles_username_length CHECK (char_length(username) <= 64);
-- ALTER TABLE public.wallets ADD CONSTRAINT wallets_chain_check CHECK (chain IN ('evm', 'solana'));
```

### 5.2 Next.js: username validation

In `apps/web/src/app/[username]/page.tsx`, after resolving params:

```ts
// After: const { username } = await params;
// Add:
const USERNAME_MAX_LEN = 64;
const USERNAME_REGEX = /^[a-zA-Z0-9_-]+$/;
if (
  typeof username !== "string" ||
  username.length > USERNAME_MAX_LEN ||
  !USERNAME_REGEX.test(username)
) {
  notFound();
}
```

### 5.3 Next.js: caching for profile page (optional)

In `apps/web/src/app/[username]/page.tsx`, wrap the data fetch:

```ts
import { unstable_cache } from "next/cache";

// Then replace direct getProfileByUsername/getWalletsByUserId with cached versions, e.g.:
const getCachedProfile = (username: string) =>
  unstable_cache(
    () => getProfileByUsername(username),
    ["profile", username],
    { revalidate: 60 }
  )();
```

(Apply similarly for wallets after you have profile.id, with a cache key including the user id.)

### 5.4 Railway: auth and validation placeholder (when implementing)

Before implementing `/wallet/nonce` and `/wallet/verify`, add:

- **Auth:** Verify `Authorization: Bearer <supabase_jwt>` and decode JWT (e.g. with `supabase.auth.getUser(accessToken)` or verify with JWT library using anon key’s JWT secret).
- **Validation:** Use Zod to validate body (e.g. `address`, `chain`, `signature`).
- **Rate limiting:** Per-IP and per-user limits (e.g. Upstash Redis or in-memory fallback with a simple `Map` and cleanup).

Example middleware pattern (Fastify):

```ts
// apps/api/src/lib/auth.ts (new file when needed)
import { supabaseAdmin } from "./supabase.js";

export async function requireAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7) : null;
  if (!token) return reply.code(401).send({ error: "Missing token" });
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return reply.code(401).send({ error: "Invalid token" });
  (request as any).user = user;
}
```

### 5.5 Railway: retry and idempotency (when adding workers)

When you add background jobs:

- **Retry:** Exponential backoff (e.g. 1s, 2s, 4s) with max 3–5 attempts.
- **Idempotency:** Use a unique key (e.g. `user_id + platform + snapshot_date`) and skip or upsert instead of blind insert.
- **Guardrails:** Do not overwrite `twitter_username` or `profile_image_url` if they are already set (unless explicitly intended).

---

## 6) RLS Coverage Checklist

| Table | RLS enabled | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|--------------|--------|--------|--------|--------|-------|
| **public.profiles** | ✅ (via migration above) | Public | Own row only (`auth.uid() = id`) | Own row only | N/A (no policy = deny) | Ensure no DELETE policy unless required |
| **public.wallets** | ✅ (via migration above) | Public | Own row only (`auth.uid() = user_id`) | Own row only | Own row only | |
| **public.wallet_link_nonces** | ✅ (via migration above) | Own row only | Own row only | Own row only | N/A | If table exists |

**How to verify:** In Supabase Dashboard → Authentication → Policies, confirm the policies match. Run `SELECT * FROM pg_policies WHERE schemaname = 'public';` in SQL editor to list all.

---

## RLS Coverage Checklist

| Table | RLS enabled | SELECT | INSERT | UPDATE | DELETE | Notes |
|-------|-------------|--------|--------|--------|--------|-------|
| **public.profiles** | ✅ | Public | Own row only (`auth.uid() = id`) | Own row only | (no policy = deny) | Migration adds policies above |
| **public.wallets** | ✅ | Public | Own row only (`auth.uid() = user_id`) | Own row only | Own row only | Migration adds policies above |
| **public.wallet_link_nonces** | ✅ (if exists) | Own row only | Own row only | Own row only | (no policy = deny) | Migration runs in DO block |

**After applying migration:** In Supabase SQL Editor run:

```sql
SELECT tablename, policyname, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

to confirm all policies exist as intended.

---

*End of audit report.*
