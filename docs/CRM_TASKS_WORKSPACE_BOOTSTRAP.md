# CRM /tasks — Workspace bootstrap and “Could not load workspace”

## Root cause (short)

The message **“Could not load workspace. Try signing out and back in.”** (or the newer actionable variants) appears when the server cannot load or create the **creator workspace** and **personal board** for the current user on `/tasks`.

**Server path:** Session → `resolveCrmAccess` → `canBootstrapCreatorWorkspace` → `getOrCreateCreatorWorkspaceAndBoard` (profile check → workspace insert/load → workspace_member insert → board insert/load). Any failure in that chain results in a bootstrap failure.

**Most likely causes:**

1. **No `public.profiles` row** for the authenticated user  
   - RLS uses `crm_current_profile_id()` = `SELECT id FROM public.profiles WHERE id = auth.uid()`.  
   - If there is no `profiles` row for `auth.uid()`, this returns NULL and RLS blocks `crm_workspaces` insert (and related).  
   - **Fix:** Ensure every auth user gets a `profiles` row (e.g. on first sign-in or via trigger).

2. **Profile type**  
   - `canBootstrapCreatorWorkspace` only allows `profile_type = 'individual'`. Org/company users see the “no access” state, not “Could not load workspace”.

3. **RLS blocking insert/select**  
   - Workspace insert: `owner_profile_id = crm_current_profile_id()`.  
   - If `crm_current_profile_id()` is NULL (no profile), insert is blocked.  
   - Board insert requires workspace membership; after creating the workspace we add the owner, so this normally succeeds if workspace creation did.

4. **Cookie/session across domains**  
   - If the session is not shared between linkary.xyz and crm.linkary.xyz (e.g. wrong or missing `NEXT_PUBLIC_COOKIE_DOMAIN`), the CRM may see no or a different user and fail to resolve profile/workspace.

5. **Duplicate creator slug or other DB constraint**  
   - `crm_workspaces` has a UNIQUE constraint on `slug`. If `getOrCreateCreatorWorkspaceAndBoard` tries to insert and slug already exists (e.g. race), insert fails with 23505. **Hardening (Mar 2025):** On 23505 the server re-selects the workspace by `owner_profile_id` + `type = 'creator'` and continues with member/board; member insert 23505 is ignored. See `docs/CRM_BOOTSTRAP_AND_CAMPAIGN_DEFINITION_PASS.md`.

**Observability:** The CRM server logs bootstrap failures with a `[CRM tasks]` prefix and a reason: `no_profile`, `workspace_insert`, `workspace_member_insert`, `board_insert`, or `unknown`. No PII is logged; only codes/details safe for logs.

---

## Verification checklist

Use this to confirm behavior for different user and session states.

| Scenario | Expected |
|----------|----------|
| **Valid individual user** — `public.profiles` row exists for the user, `profile_type = 'individual'` | Opening `/tasks` loads creator workspace and personal board; no “Could not load workspace” error. |
| **Missing profile** — authenticated user has no `profiles` row | User sees an actionable message (“Your account isn’t set up for Tasks yet” with hint to sign in on linkary.xyz first). Page checks profile before calling getOrCreate; server logs `reason=no_profile` if getOrCreate sees no profile. |
| **Org/company user** — profile exists with `profile_type` not `individual` | User sees “no access” state (no personal task board), not “Could not load workspace”. No creator workspace bootstrap is attempted. |
| **Shared-auth session** — user signs in on linkary.xyz, then opens crm.linkary.xyz | Session is shared (same user). Opening `/tasks` on CRM loads workspace/board without re-login; no “Could not load workspace” when profile exists and is individual. |

---

## References

- RLS: `supabase/migrations/20260405000001_crm_rls.sql` (`crm_current_profile_id`, `crm_workspaces`, `crm_boards`).
- Bootstrap logic: `apps/crm/src/lib/workspace.ts` (`getOrCreateCreatorWorkspaceAndBoard`, `workspaceBootstrapMessage`).
- Callers: `apps/crm/src/app/(dashboard)/tasks/page.tsx`, `apps/crm/src/app/(dashboard)/tasks/actions.ts`, `apps/crm/src/lib/sync.ts`.
