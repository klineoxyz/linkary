# Linkary Launch Readiness Audit

**Stack:** Next.js (apps/web), Supabase (DB/Auth/Storage), Railway (apps/api)  
**Goal:** Ship a stable v1 launch  
**Date:** 2026-02-17

---

## A) Launch Readiness Score

| Category | Score | Notes |
|----------|-------|-------|
| **Security & Permissions** | 62/100 | RLS in migration; wallets policy mismatch; no `get_public_wallets`; anon-only in web ✓ |
| **Data Integrity & Migrations** | 65/100 | Migration exists; drift vs “wallets private”; no `get_public_wallets`; case-insensitive index present |
| **Reliability & Error Handling** | 55/100 | No Sentry; Railway logger only; wallet verify 501; no retry/idempotency |
| **Performance & Cost Control** | 50/100 | No profile caching; no rate limits; wallet API stubbed |
| **UX/Polish & Observability** | 45/100 | No Sentry; no structured logging; health check exists |

**Overall: 55/100** — Not launch-ready without critical-path fixes.

---

## B) Critical Path (Must Fix Before Launch)

| # | Item | Location | Why |
|---|------|----------|-----|
| 1 | **Public profile must use safe wallet exposure** | `apps/web/src/app/[username]/page.tsx`, `lib/db.ts` | Page uses `getWalletsByUserId` → direct `wallets` query. If wallets RLS is owner-only, anon cannot read another user’s wallets → page shows no wallets. Need `get_public_wallets(user_id)` (masked) or aligned RLS. |
| 2 | **Resolve wallets RLS mismatch** | `supabase/migrations/20260217000000_rls_and_constraints.sql` | Migration has `wallets_select_public` (SELECT USING true). If prod is owner-only, migration and prod diverge. Either: (a) keep public and use masked function, or (b) switch to owner-only and add `get_public_wallets()`. |
| 3 | **Add `get_public_wallets` function** | New migration | Function (SECURITY DEFINER) that returns masked addresses (e.g. `0x1234...5678`) for a profile. Public profile must call this instead of `SELECT * FROM wallets`. |
| 4 | **Remove or lock `test-supabase` route in prod** | `apps/web/src/app/test-supabase/page.tsx` | Client-side `notFound()` when NODE_ENV !== development; route still exists in build. Prefer `export const dynamic = 'error'` or route segment that 404s in prod. |
| 5 | **Add error tracking (Sentry)** | apps/web, apps/api | No Sentry. Launch needs error capture for web + API. |
| 6 | **Ensure no service role key in web** | apps/web | Verified: only anon key in web. ✓ (no change needed, confirm in deploy) |
| 7 | **Verify profiles/wallets RLS in prod** | Supabase Dashboard | Run `SELECT tablename, policyname, cmd FROM pg_policies WHERE schemaname = 'public';` and confirm policies match intended design. |
| 8 | **Baseline migration committed** | `supabase/migrations/` | Migration exists but may not match prod. Ensure one migration reflects current prod schema + RLS for reproducibility. |
| 9 | **Username validation on public profile** | `[username]/page.tsx` | Already done: length ≤64, pattern `^[a-zA-Z0-9_-]+$`, reserved list. ✓ |
| 10 | **Case-insensitive username uniqueness** | Migration | Index `idx_profiles_username_lower` exists. Add unique constraint on `LOWER(username)` if not already present. |

---

## C) High Priority (Fix Soon)

| # | Item | Location |
|---|------|----------|
| 1 | Add caching for public profile page | `[username]/page.tsx` — wrap `getProfileByUsername` and wallet fetch in `unstable_cache` (e.g. 60s) |
| 2 | Add env validation (e.g. Zod) | apps/web, apps/api — validate required env at startup |
| 3 | Railway: auth middleware for wallet routes | `apps/api/src/routes/wallet.ts` — require Supabase JWT before implementing nonce/verify |
| 4 | Railway: Zod validation for wallet body | wallet routes — validate address, chain, signature |
| 5 | Railway: rate limiting | API — per-IP and per-user limits for wallet and any costly endpoints |
| 6 | Wallet verify: implement or hide | If not in scope, hide wallet linking UI behind “Coming soon” |
| 7 | Structured logging in Railway | Add request IDs, user ids, and structured JSON logging |
| 8 | DB backup note | Add to docs: backup/restore procedure |
| 9 | Health check depth | Optional: add DB ping to `/health` |
| 10 | No repeated profile fetches | `[username]/page.tsx` — single server component; consider batching profile + wallets |
| 11 | Reserved usernames | Already in `[username]/page.tsx` ✓ — expand list if needed |
| 12 | CORS on Railway API | Confirm CORS configured for web origin |
| 13 | `.env.example` for both apps | Both exist ✓ |
| 14 | Supabase anon key usage | Only anon in web ✓ |
| 15 | Profile page server component | Already server-rendered ✓ |

---

## D) Nice-to-Have

| # | Item |
|---|------|
| 1 | Status page or simple health checks dashboard |
| 2 | Admin “support tools” (e.g. lookup user by username) |
| 3 | DB monitoring queries saved (e.g. `supabase/db-monitoring.sql`) |
| 4 | Request ID propagation (web → API) |
| 5 | Retry + idempotency for future background jobs |
| 6 | CDN cache headers for public profile |
| 7 | Wallet nonce/signature flow fully implemented |
| 8 | A/B test or feature flags for launch |
| 9 | Performance budgets (Lighthouse) |
| 10 | API versioning (e.g. `/v1/wallet/...`) |
| 11 | OpenAPI/Swagger for API |
| 12 | Staging env parity check |
| 13 | E2E tests for auth + profile flows |
| 14 | Structured logging → log aggregation (e.g. Datadog, Logtail) |
| 15 | Alerts on error rate / latency |

---

## E) Repo Map of Security-Critical Files

```
Linkary/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   │   ├── page.tsx                 # Entry
│   │   │   │   ├── app/page.tsx             # Redirect
│   │   │   │   ├── test-supabase/page.tsx   # Dev test — lock in prod
│   │   │   │   └── [username]/page.tsx      # Public profile — wallet + profile
│   │   │   ├── lib/
│   │   │   │   ├── supabase.ts              # Anon client
│   │   │   │   ├── db.ts                    # getProfileByUsername, getWalletsByUserId
│   │   │   │   └── wallets.ts               # upsertWallet, getWalletsByUserId
│   │   │   └── figma/                       # UI (supabase auth)
│   │   └── .env.example
│   │
│   └── api/
│       ├── src/
│       │   ├── index.ts
│       │   ├── lib/supabase.ts              # Service role (server-only)
│       │   └── routes/
│       │       ├── health.ts                # GET /health
│       │       └── wallet.ts                # POST /wallet/nonce, /verify (501)
│       └── .env.example
│
├── supabase/
│   └── migrations/
│       └── 20260217000000_rls_and_constraints.sql  # RLS + indexes; no get_public_wallets
│
├── docs/
│   ├── SECURITY_AUDIT.md
│   └── LAUNCH_READINESS_AUDIT.md
└── .gitignore
```

---

## F) Patches (Copy/Paste-Ready)

### F.1 Migration: Add `get_public_wallets` and optional owner-only wallets

Create `supabase/migrations/20260217100000_get_public_wallets.sql`:

```sql
-- =============================================================================
-- get_public_wallets(profile_id) — returns MASKED addresses for public profile
-- SECURITY DEFINER so anon can call it
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_public_wallets(p_profile_id uuid)
RETURNS TABLE (
  id uuid,
  chain text,
  address_masked text,
  is_primary boolean
) LANGUAGE sql SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    w.id,
    w.chain,
    CASE
      WHEN w.chain = 'evm' AND length(w.address) >= 10
        THEN left(w.address, 6) || '...' || right(w.address, 4)
      WHEN w.chain = 'solana' AND length(w.address) >= 10
        THEN left(w.address, 4) || '...' || right(w.address, 4)
      ELSE '••••••••'
    END AS address_masked,
    w.is_primary
  FROM public.wallets w
  WHERE w.user_id = p_profile_id
  ORDER BY w.is_primary DESC, w.created_at ASC;
$$;

GRANT EXECUTE ON FUNCTION public.get_public_wallets(uuid) TO anon;
GRANT EXECUTE ON FUNCTION public.get_public_wallets(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_public_wallets(uuid) IS
  'Returns masked wallet addresses for public profile. Use instead of direct SELECT on wallets.';
```

### F.2 Optional: Switch wallets SELECT to owner-only (if you want private wallets)

Only run if you intend wallets to be owner-only. This replaces `wallets_select_public`:

```sql
DROP POLICY IF EXISTS "wallets_select_public" ON public.wallets;
CREATE POLICY "wallets_select_own" ON public.wallets
  FOR SELECT USING (auth.uid() = user_id);
```

If you do this, the public profile page MUST use `get_public_wallets` (below), not `getWalletsByUserId`.

### F.3 `lib/db.ts` — Add `getPublicWallets` and optional switch

Add to `apps/web/src/lib/db.ts`:

```ts
export type PublicWallet = {
  id: string;
  chain: string;
  address_masked: string;
  is_primary: boolean;
};

export async function getPublicWallets(profileId: string): Promise<PublicWallet[]> {
  const { data, error } = await supabase.rpc("get_public_wallets", {
    p_profile_id: profileId,
  });
  if (error) throw error;
  return (data ?? []) as PublicWallet[];
}
```

### F.4 `[username]/page.tsx` — Use `getPublicWallets` for wallets

Replace:

```ts
import { getProfileByUsername, getWalletsByUserId } from "@/lib/db";
// ...
const wallets = await getWalletsByUserId(profile.id);
```

with:

```ts
import { getProfileByUsername, getPublicWallets } from "@/lib/db";
// ...
const wallets = await getPublicWallets(profile.id);
```

Then update the render to use `address_masked` instead of `address`:

```tsx
<span className="text-zinc-300 truncate">{w.address_masked}</span>
```

### F.5 `[username]/page.tsx` — Add caching

At top of file:

```ts
import { unstable_cache } from "next/cache";
```

Wrap data fetches:

```ts
const profile = await unstable_cache(
  () => getProfileByUsername(username),
  ["profile", username],
  { revalidate: 60 }
)();

if (!profile) notFound();

const wallets = await unstable_cache(
  () => getPublicWallets(profile.id),
  ["public-wallets", profile.id],
  { revalidate: 60 }
)();
```

### F.6 `test-supabase` — Hard 404 in production

Add to `apps/web/src/app/test-supabase/page.tsx` (or create `layout.tsx`):

Option A — layout that 404s in prod:

Create `apps/web/src/app/test-supabase/layout.tsx`:

```ts
import { notFound } from "next/navigation";

export default function TestSupabaseLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }
  return <>{children}</>;
}
```

Option B — keep existing client check (already 404s in prod when component mounts). The layout approach is cleaner for server-side 404.

### F.7 Railway API — Auth placeholder for wallet routes

When implementing `/wallet/nonce` and `/wallet/verify`, add auth. Create `apps/api/src/lib/auth.ts`:

```ts
import type { FastifyRequest, FastifyReply } from "fastify";
import { supabaseAdmin } from "./supabase.js";

export async function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;
  const token = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!token) {
    return reply.code(401).send({ error: "Missing Authorization header" });
  }
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) {
    return reply.code(401).send({ error: "Invalid or expired token" });
  }
  (request as any).user = user;
}
```

Use as `preHandler` on wallet routes when implemented.

### F.8 Sentry (web)

```bash
cd apps/web && pnpm add @sentry/nextjs
```

Run Sentry wizard or add to `next.config.js` / `instrumentation.ts` per [Sentry Next.js docs](https://docs.sentry.io/platforms/javascript/guides/nextjs/).

### F.9 Sentry (API)

```bash
cd apps/api && pnpm add @sentry/node
```

Initialize in `index.ts` before `app.listen()`:

```ts
import * as Sentry from "@sentry/node";
Sentry.init({ dsn: process.env.SENTRY_DSN, environment: process.env.NODE_ENV });
```

---

## G) Launch Ready Checklist (Condensed)

**Must do before launch:**

- [ ] Public profile uses `get_public_wallets` (or confirmed safe wallet exposure)
- [ ] Migration `get_public_wallets` applied
- [ ] Wallets RLS matches intended design (public vs owner-only)
- [ ] Auth/RLS verified for profiles + wallets
- [ ] Remove or lock `test-supabase` in prod
- [ ] Sentry for web + API
- [ ] Rate limit any endpoint that can drive external cost
- [ ] Basic caching on public profile page
- [ ] Baseline migration reflects prod

**Recommended:**

- [ ] Status / health check page
- [ ] Admin support tools
- [ ] DB monitoring queries
- [ ] Env validation (Zod)

---

## H) Repo Tree (Reference)

```
apps/web/src:
  app, figma, lib
  app/app, app/test-supabase, app/[username]
  app/page.tsx, app/layout.tsx, app/globals.css, ...
  lib/db.ts, lib/supabase.ts, lib/wallets.ts (if exists at root)
  figma/app, figma/app/components, ...

apps/api/src:
  index.ts
  lib/supabase.ts
  routes/health.ts, routes/wallet.ts
```

---

*End of Launch Readiness Audit.*
