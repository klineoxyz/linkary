# Route recovery + CRM workspace bootstrap (production fix pass)

## 1) Bug summary

### Root causes

| Issue | Cause |
|-------|--------|
| **`/app/analytics/org/[slug]` → 404** | No Next.js route existed. Users/bookmarks expected org analytics under that path. |
| **CRM `/tasks` — “Could not create your workspace”** | **RLS cycle on `crm_workspaces`:** `SELECT` required `crm_workspace_member()`, which needed to read the workspace row to prove ownership—but that read was blocked until the user was already a member. **Member insert** therefore failed after workspace insert. Retries hit **`UNIQUE(slug)`** (short slug `creator-{first8}` could also collide across users) → `duplicate_slug_unresolved` / generic failure. |
| **Orphan workspaces** | Some DB rows may exist with **no `crm_workspace_members` row** and **no board** from the failed bootstrap. |

### What changed

- **Web:** Server redirect from `/app/analytics/org/[slug]` → `/org/[slug]?tab=insights` (org insights = stored org analytics surface).
- **DB:** New RLS policy **`crm_workspaces_select_owner_row`**: `SELECT` allowed when `owner_profile_id = auth.uid()` (breaks the cycle).
- **CRM code:** Slug = `creator-{fullProfileUuid}`; **always** run owner **member insert** after resolving workspace (idempotent via ignoring `23505`), so orphans self-repair after migration.

## 2) Files touched

- `supabase/migrations/20260421000000_crm_workspaces_owner_select_rls_fix.sql` — new
- `apps/web/src/app/app/analytics/org/[slug]/page.tsx` — new
- `apps/crm/src/lib/workspace.ts` — slug + membership repair
- `docs/ROUTE_RECOVERY_CRM_BOOTSTRAP_FIX.md` — this file

## 3) Migrations required

Apply **`20260421000000_crm_workspaces_owner_select_rls_fix.sql`** (`supabase db push` or SQL Editor).

## 4) Env / config

| Variable | Where | Purpose |
|----------|-------|---------|
| `NEXT_PUBLIC_COOKIE_DOMAIN=.linkary.xyz` | **Both** web + CRM Vercel env | Shared session on apex + `crm.` subdomain (already documented in `apps/crm/.env.example`). |
| Supabase **Site URL / redirect URLs** | Dashboard | Must allow `https://crm.linkary.xyz/**` and `https://linkary.xyz/**` for auth callbacks. |

If CRM shows logged-in UI but **RLS still fails**, first verify cookies on `crm.linkary.xyz` and that **`NEXT_PUBLIC_COOKIE_DOMAIN`** matches production.

## 5) Route verification

| Route | Status |
|-------|--------|
| `/{username}` | Exists: `(public)/[username]/page.tsx` — entity resolver, published/unpublished, not touched. |
| `/org/[slug]` | Exists: `org/[orgId]/page.tsx` — `orgId` is slug or id; shell + OrgDetailPage. |
| `/app/analytics/org/[slug]` | **302/307** → `/org/{slug}?tab=insights` (no dead link). |
| CRM `/tasks`, `/tasks/[id]` | Bootstrap fixed post-migration; tasks load when `profile_type = individual`. |
| CRM `/campaigns`, `/campaigns/[id]` | Unchanged; depend on org workspace membership as before. |

## 6) Regression check (intentionally untouched)

- Onboarding, referrals, `org_members` authority, analytics stored-data-only behavior, active context, sourcing/CRM sync contracts — **no changes** in this pass.

## 7) Verdict

- **After deploying migration + web + CRM:** `/app/analytics/org/...` should **no longer 404**; CRM **individual** users should **bootstrap workspace + board** (and **repair orphans**).
- **Remaining blockers (if any):** Users with **`profile_type` ≠ `individual`** still get the truthful **wrong account type** state on Tasks (by design). **Session not shared** across domains without cookie domain still breaks CRM until env is fixed.
