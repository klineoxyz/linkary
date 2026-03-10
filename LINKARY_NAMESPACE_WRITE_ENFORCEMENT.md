# Linkary: Namespace Write Enforcement (Phase 2)

**Purpose:** Enforce the global namespace at write-time so no future org can create or update a slug without going through `usernames`. Collisions are impossible going forward.  
**Scope:** DB/RPC, API, and UI validation only. No route changes, no `/app/...` move, no public resolver change.  
**Reference:** `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` Phase 2; namespace is clean per `LINKARY_NAMESPACE_REMEDIATION_EXECUTION.md`.

---

## 1. Exact Files / Migrations / RPCs / APIs Changed

### 1.1 Database migration

| File | Change |
|------|--------|
| `supabase/migrations/20260321000000_create_org_uses_usernames_namespace.sql` | **New.** Replaces `create_org_and_membership`: (1) If explicit slug provided, checks `usernames` (and `orgs`) and raises `SLUG_TAKEN` if taken. (2) If slug auto-generated from name, loop until candidate is free in both `usernames` and `orgs`. (3) After inserting org and org_members, inserts one row into `usernames` with `username = o_slug`, `owner_type = 'org'`, `owner_id = new_org.id`. |

### 1.2 RPC behavior

| RPC | Before | After |
|-----|--------|--------|
| `create_org_and_membership` | Checked only `orgs` for slug; did not write to `usernames`. | Checks `usernames` first; explicit slug fails with `SLUG_TAKEN` if taken; auto slug suffixes until free in `usernames` and `orgs`; always inserts into `usernames` on success. |
| `claim_username_for_org` | Unchanged. | Still used for org slug **updates**; rejects if slug is taken by profile or another org (`USERNAME_TAKEN_VERIFIED`). |

### 1.3 Application code

| File | Change |
|------|--------|
| `apps/web/src/lib/orgs.ts` | **checkSlugAvailable:** Now checks `usernames` (global namespace) and `isReservedPath(slug)`; no longer checks only `orgs`. **claimOrgSlug(orgId, newSlug):** New function; calls `claim_username_for_org` RPC for org slug changes. **updateOrg:** Comment clarified that slug changes must use `claimOrgSlug`; still accepts `slug` for no-op updates when slug is unchanged. |
| `apps/web/src/app/api/orgs/create/route.ts` | **Reserved check:** If `body.slug` is provided and `isReservedPath(slug)`, returns 400 `SLUG_RESERVED`. **Error mapping:** Maps RPC message `SLUG_TAKEN` or `USERNAME_TAKEN*` to 400 with code `SLUG_TAKEN` and message "That handle is already taken by a user or another org. Choose another." |
| `apps/web/src/figma/app/components/OrgDetailPage.tsx` | **Save settings:** When org slug is changed (`settingsOrgSlug !== org.slug`), calls `claimOrgSlug(org.id, newSlug)` first; on error shows "That handle is already taken by a user or another org." Then calls `updateOrg` with other fields only (no slug when slug was changed, since RPC already updated `orgs.slug`). |

---

## 2. How Org Create Now Uses `usernames`

1. **API layer:** Before calling the RPC, the create route checks `isReservedPath(slug)` and returns 400 if reserved.
2. **RPC `create_org_and_membership`:**
   - **Explicit slug:** If the payload includes a slug, the RPC normalizes it and checks `SELECT 1 FROM usernames WHERE username = candidate_slug`. If a row exists (profile or org), it raises `SLUG_TAKEN`. It also checks `orgs` for legacy consistency. If both checks pass, it uses that slug.
   - **Auto slug (from name):** It computes `base_slug` from the org name, then enters a loop: while the candidate exists in **either** `usernames` or `orgs`, it appends a suffix (`-1`, `-2`, …) and tries again. The first free candidate is used.
3. **After insert:** The RPC inserts the new org and org_members row, then **inserts one row into `usernames`**: `(username = o_slug, owner_type = 'org', owner_id = new_org.id, provider = NULL, verified_at = NULL)`.
4. **API error handling:** If the RPC raises `SLUG_TAKEN` or a message containing `USERNAME_TAKEN`, the API returns 400 with code `SLUG_TAKEN` and a clear message.

So every new org gets its slug registered in `usernames` at creation, and no org can be created with a slug that is already in `usernames` (profile or org).

---

## 3. How Org Slug Updates Now Use `usernames`

1. **UI:** When the user saves org settings and the slug field has changed, the app calls **`claimOrgSlug(orgId, newSlug)`** (which calls the `claim_username_for_org` RPC) instead of passing the new slug to `updateOrg`.
2. **RPC `claim_username_for_org`:** The existing RPC checks that the caller is org owner/admin, normalizes the desired slug, and:
   - If the slug is not in `usernames`, it inserts into `usernames` and updates `orgs.slug`.
   - If the slug is already in `usernames` for this org, it updates `orgs.slug` (idempotent).
   - If the slug is in `usernames` for another profile or org (and not an unverified placeholder that can be reassigned), it raises `USERNAME_TAKEN_VERIFIED`.
3. **After a successful claim:** The UI then calls `updateOrg(orgId, { name, published, ... })` with the other fields only (no slug), so the rest of the org row is updated without overwriting the slug. The RPC has already set `orgs.slug`.
4. **Availability check:** Before the user submits, `checkSlugAvailable` (used in org create and, if desired, in org settings) checks the **global** namespace (`usernames`) and reserved paths, so the user sees "taken" or "reserved" before calling the RPC.

So all org slug changes go through `claim_username_for_org`, which is the single path that updates both `usernames` and `orgs.slug` and enforces that the slug is not taken by another profile or org.

---

## 4. UI Validation Changes

- **checkSlugAvailable (org create and org slug edit):** Now queries the **`usernames`** table (and checks **reserved paths** via `isReservedPath`) instead of only the `orgs` table. So "available" means: not reserved and not present in the global namespace (no profile or org owns that slug). When taken, it still returns a suggested alternative (e.g. `slug-2`) by checking `usernames` for availability.
- **Org create modal:** No code change required; it already uses `checkSlugAvailable` and displays errors from `createOrg`. When the RPC raises `SLUG_TAKEN`, the client receives that error and can show "That handle is already taken."
- **Org detail (slug edit):** Save handler now uses `claimOrgSlug` when the slug changed and shows a clear message when the claim fails (e.g. "That handle is already taken by a user or another org.").

---

## 5. How Collisions Are Prevented Going Forward

| Layer | Mechanism |
|-------|------------|
| **DB/RPC** | `create_org_and_membership` checks `usernames` before assigning a slug (explicit: fail if taken; auto: suffix until free). It always inserts into `usernames` on success. `claim_username_for_org` only assigns a slug if it is free or already owned by the same org; otherwise it raises. |
| **API** | Org create checks reserved paths and maps `SLUG_TAKEN` / `USERNAME_TAKEN*` to 400 with a clear message. |
| **UI** | `checkSlugAvailable` uses the global namespace (`usernames`) and reserved paths, so the user cannot submit a slug that is already taken or reserved. Org slug edit goes through `claimOrgSlug`, which uses the same RPC and fails clearly if the slug is taken. |

No path can assign an org a slug that is already in `usernames` for a profile or another org, and every new or updated org slug is written to `usernames` with `owner_type = 'org'`.

---

## 6. What Remains Before Resolver Migration

- **Resolver:** The **public** resolver (`/:segment`) is still **not** switched to usernames-only. It can remain profile-then-org (or current behavior) until the next phase. Phase 2 only enforces **writes**; it does not change how `/:segment` is resolved.
- **Routes:** No changes to `/app/...`, `/org/:slug`, or `/u/:username` in this pass.
- **Enforce profile claims:** Profile username claims already go through `claim_username_for_profile`, which uses `usernames`. No change required in Phase 2.
- **Optional:** Add an explicit **slug availability API** (e.g. `GET /api/slug/available?slug=xxx`) that checks `usernames` and reserved, for use by other clients or server components. The current UI uses `checkSlugAvailable` (client-side with anon or authenticated Supabase), which now hits `usernames`; an API is not required for the current flows.

---

## 7. Summary

| Item | Status |
|------|--------|
| Org creation checks `usernames` and writes to `usernames` | Done (migration) |
| Org slug updates go through `claim_username_for_org` | Done (claimOrgSlug + OrgDetailPage) |
| API org create: reserved check and SLUG_TAKEN mapping | Done |
| Global slug availability in UI (org create/edit) | Done (checkSlugAvailable) |
| Route migration / resolver change | Not in scope (Phase 2 write enforcement only) |

Apply the migration `20260321000000_create_org_uses_usernames_namespace.sql` (e.g. via `pnpm run db:push` or your deployment pipeline) to enforce the new behavior in the database.

---

*End of document.*
