# Orgs INSERT RLS Hardening

**Date:** 2026-03-10  
**Source:** Recommendation from LINKARY_SECURITY_RLS_AUDIT.md — prevent direct client inserts into `orgs` from assigning `owner_profile_id` to another user.

---

## Migration name

`20260318000000_orgs_insert_rls_owner_profile_id.sql`

**Path:** `supabase/migrations/20260318000000_orgs_insert_rls_owner_profile_id.sql`

---

## Exact policy change

- **Dropped:** `orgs_insert_authed` (previous: `WITH CHECK (auth.uid() IS NOT NULL)`).
- **Created:** `orgs_insert_owner_self` with:

```sql
CREATE POLICY "orgs_insert_owner_self"
  ON public.orgs
  FOR INSERT
  WITH CHECK (
    auth.uid() IS NOT NULL
    AND owner_profile_id = auth.uid()
  );
```

So an authenticated user can insert into `orgs` only if they set `owner_profile_id` to their own id (`auth.uid()`). They cannot set it to another user’s id, and if they omit it (NULL), the check fails because `NULL = auth.uid()` is false.

---

## Why it is safe

1. **No privilege escalation**  
   The only new constraint is that the inserting user must set `owner_profile_id` to themselves. Direct client inserts can no longer create orgs “owned” by someone else.

2. **RLS does not apply to the RPC**  
   `create_org_and_membership` is `SECURITY DEFINER`. It runs with the definer’s privileges and **bypasses RLS**. The `INSERT INTO public.orgs` inside the RPC is not evaluated against this (or any) RLS policy, so app-driven org creation is unchanged.

3. **App only uses the RPC**  
   Org creation in the app goes through:
   - `apps/web/src/app/api/orgs/create/route.ts` → `supabase.rpc("create_org_and_membership", { ... })`
   - `apps/web/src/lib/orgs.ts` → same RPC  
   There is no client-side `supabase.from('orgs').insert(...)` for org creation, so the new policy only tightens direct client abuse.

4. **Backward compatibility**  
   Existing call paths do not use direct inserts to `orgs`; the RPC sets `owner_profile_id = uid` (caller). No existing flow relies on inserting with a different or null `owner_profile_id`.

---

## Verification that normal org creation still works

1. **RPC behavior**  
   - `create_org_and_membership` runs as `SECURITY DEFINER` and therefore bypasses RLS.  
   - Its `INSERT INTO public.orgs (..., owner_profile_id, ...) VALUES (..., uid, ...)` does not go through RLS.  
   - So the new policy has no effect on the RPC; org creation via the RPC continues to work.

2. **API flow**  
   - `POST /api/orgs/create` calls `supabase.rpc("create_org_and_membership", payload)` (with user’s Bearer token).  
   - No direct `from('orgs').insert()` in that route.  
   - So normal org creation still works after the migration.

3. **Optional runtime check**  
   - After applying the migration, create an org via the app (or via `POST /api/orgs/create`).  
   - Confirm the org is created and the creating user is owner (e.g. in `org_members` with role `owner` and `orgs.owner_profile_id` = that user’s id).

4. **Direct-insert abuse case**  
   - With anon key and an authenticated user token, run:  
     `supabase.from('orgs').insert({ slug: 'x', name: 'Y', org_type: 'project', owner_profile_id: '<other_user_id>' })`.  
   - Expected: RLS blocks the insert (policy check fails).  
   - With `owner_profile_id: auth_user_id`: allowed (if your app ever allowed direct insert for self, it still would be).

---

## Side effects

- **Direct client inserts**  
  Any code that currently does `supabase.from('orgs').insert({ ... })` with the anon key and a user token **must** set `owner_profile_id` to the current user’s id or the insert will be rejected. The app does not do this today; only the RPC inserts into `orgs`.

- **Future client-side org creation**  
  If you later add a client-side org creation path using `from('orgs').insert()`, you must include `owner_profile_id: currentUser.id` (or equivalent). Prefer continuing to use `create_org_and_membership` RPC so RLS is irrelevant and logic stays in one place.

- **org_members bootstrap**  
  The RPC also inserts the first row into `org_members` (owner). That table’s INSERT policy is unchanged and still allows inserts only when `is_org_admin(org_id, auth.uid())` (or the equivalent owner check). The RPC runs as definer, so that insert also bypasses RLS. No change to org_members bootstrap.

- **is_org_admin**  
  `is_org_admin` reads `orgs.owner_profile_id` and `org_members`; it does not perform inserts into `orgs`. No change to its behavior or assumptions.

---

## Summary

| Item | Result |
|------|--------|
| Migration | `20260318000000_orgs_insert_rls_owner_profile_id.sql` |
| Policy | INSERT only when `owner_profile_id = auth.uid()` (and authenticated) |
| RPC | Unaffected (SECURITY DEFINER bypasses RLS) |
| Normal org creation | Still works via RPC |
| Direct client abuse | Blocked (cannot assign ownership to another user) |

---

*End of LINKARY_ORGS_INSERT_HARDENING.md*
