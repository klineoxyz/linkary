# Org creation: RLS fix, X verification, atomic RPC

## Summary

- **Migration:** `supabase/migrations/20260235000000_org_creation_rls_verification.sql`
- **RLS:** `org_members` policies rewritten to avoid recursion (use `orgs.owner_profile_id` instead of querying `org_members`).
- **Orgs:** Added `owner_profile_id`, X verification columns, publish gate (published ⇒ is_x_verified).
- **Creation:** Org creation is atomic via RPC `create_org_and_membership` (no client direct inserts).
- **UX:** Slug conflict message + suggested slug; Connect org X account; Public listing gated on verification.

---

## New org columns

| Column | Type | Description |
|--------|------|-------------|
| `owner_profile_id` | uuid (nullable, FK auth.users) | Owner user id; backfilled from `created_by` or first owner in `org_members`. Used for RLS. |
| `x_account_username` | text | X handle connected for this org. |
| `x_account_user_id` | text | X provider user id. |
| `x_connected_at` | timestamptz | When org X was connected. |
| `is_x_verified` | boolean NOT NULL DEFAULT false | True only after org X OAuth; required for publish. |

---

## Publish gate (DB)

- **Constraint:** `orgs_published_requires_x_verified`  
  `CHECK (published IS FALSE OR (published = true AND is_x_verified = true))`
- So `published` can only be `true` when `is_x_verified = true` (enforced in DB; cannot be bypassed via API or direct update).

---

## org_members RLS (no recursion)

| Policy | Rule |
|--------|------|
| **org_members_select_own** | SELECT: `user_id = auth.uid()` (no subquery on `org_members`). |
| **org_members_insert_by_owner** | INSERT: `user_id = auth.uid()` AND `role IN ('owner','admin','member')` AND `(SELECT o.owner_profile_id FROM orgs o WHERE o.id = org_id) = auth.uid()`. |
| **org_members_update_own_or_owner** | UPDATE: `user_id = auth.uid()` OR org’s `owner_profile_id = auth.uid()`. |
| **org_members_delete_own_or_owner** | DELETE: same as UPDATE. |

**orgs_update_owner_admin:** UPDATE allowed if `owner_profile_id = auth.uid()` OR exists in `org_members` as owner/admin (reading `org_members` is safe; no recursion).

---

## RPC: create_org_and_membership(payload jsonb)

- **SECURITY DEFINER**, `search_path = public`.
- Validates: `name` required, `org_type` in (company, brand, project, agency).
- Slug: from payload or generated from name (kebab-case); uniquified with `-2`, `-3`, … if taken.
- Inserts `orgs` with `owner_profile_id = auth.uid()`, `published = false`, `is_x_verified = false`.
- Inserts one `org_members` row: `(org_id, auth.uid(), 'owner')`.
- Returns the created org row.

---

## API: POST /api/orgs/connect-x-callback

- Body: `{ orgId: string }`.
- Auth: Bearer token (session after X OAuth).
- Checks caller is org owner (or admin via `org_members`).
- Reads X identity from session (identities / user_metadata).
- Updates org: `x_account_username`, `x_account_user_id`, `x_connected_at`, `is_x_verified = true`.

---

## UI

- **CreateOrgModal:** Uses `createOrg` (RPC). Slug check on blur and before submit; shows “Slug already taken. Try: &lt;suggested&gt;” with click-to-use.
- **Dashboard:** After create, redirects to org detail with `showConnectXBanner: true`.
- **OrgDetailPage → Settings:**  
  - X verification: status (Verified @handle / Unverified), “Connect org X account” when unverified (OAuth redirect; callback calls connect-x-callback).  
  - Public listing: checkbox disabled when `!org.is_x_verified` with “Connect X first”.  
  - Banner: “Org created. Connect X to verify before publishing.” (dismissible).  
  - Save error: if DB rejects publish (e.g. constraint), show “Connect the org X account first to enable public listing.”

---

## Auth callback

- If `sessionStorage.linkary_oauth_org_id` is set (set by OrgDetailPage before X OAuth redirect):
  - Does **not** write to profile.
  - Calls `POST /api/orgs/connect-x-callback` with `{ orgId }` and Bearer token.
  - Redirects to `linkary_oauth_next` (e.g. `/dashboard`).

---

## Manual tests (high level)

1. Create org with blank slug → success; org has `published = false`, `is_x_verified = false`; one owner in `org_members`.
2. Create second org with same name → slug gets `-2` (or next free); success.
3. Create org with existing slug → UI shows “Slug already taken” and suggested slug; using suggestion succeeds.
4. Try to publish org while unverified → DB rejects; UI shows “Connect the org X account first…”
5. As owner, connect org X (button → OAuth → callback) → `is_x_verified = true`; then publish succeeds.
6. Published org appears in `public_org_view`, `/api/search`, `/api/landing/featured`.
7. Non-owner cannot connect org X (API returns 403) and cannot publish (RLS / UI).

After applying the migration, run `pnpm db:push` (or your usual migration path).
