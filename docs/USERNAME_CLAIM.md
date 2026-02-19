# Proof-based username claiming (X connect)

**If you see “duplicate key value violates unique constraint profiles_username_key”:** the claim RPC was updated (migration `20260222000000_claim_username_handle_profiles_unique.sql`) so that when the username is not yet in the `usernames` table, we first check `profiles.username` and `orgs.slug`. If another profile or org already has that handle, we run the same takeover logic (or return USERNAME_TAKEN_VERIFIED). Apply that migration and try again.

Usernames are in a **single namespace** (profiles + orgs). You can only claim a handle by connecting X (proof). Unverified placeholders are automatically renamed to `test-*` so the verified X owner gets the real handle.

## Flow

1. **Connect X** (OAuth) or **Sync from X** (manual): the app gets your X handle (e.g. `muazxinthi`).
2. **Claim**: the backend calls `claim_username_for_profile(desired_username)` (RPC).
3. **If free** → your profile gets that username; a row is added to `usernames` with `provider='x'`, `verified_at=now()`.
4. **If taken by you** → no change.
5. **If taken by an unverified profile** (no X connected) → that profile’s username is renamed to `test-<shortid>`, and the handle is assigned to you.
6. **If taken by an unverified org** → org slug is renamed to `test-org-<shortid>`, and the handle is assigned to you.
7. **If taken by a verified profile/org** → the app returns **409** with `error: 'USERNAME_TAKEN_VERIFIED'` and a friendly message; no 500.

## API behaviour

- **POST /api/x-sync**  
  - Does **not** require a body. Handle is taken from the stored profile (twitter_username or username) and from the X API response.  
  - After updating profile fields, it calls `claim_username_for_profile(normalized_handle)`.  
  - On claim conflict: returns **409** with `{ error: "USERNAME_TAKEN_VERIFIED" }`.  
  - On profile update unique violation: returns **409** instead of 500.

## DB

- **`usernames`**  
  - `username` (normalized, unique), `owner_type` ('profile'|'org'), `owner_id`, `provider`, `verified_at`.  
  - Source of truth for who owns which handle.

- **RPC**  
  - `claim_username_for_profile(desired_username text)`  
  - `claim_username_for_org(desired_username text, org_id uuid)` (for org claims later).

## One-time backfill (dev)

After applying the migration, backfill and clean placeholders:

1. Run **`scripts/backfill-usernames.sql`** in the Supabase SQL editor (or via psql).  
   - Renames unverified profile usernames to `test-<shortid>`.  
   - Inserts current profile usernames and org slugs into `usernames` (with `ON CONFLICT` handling).

## Verification checklist

1. **Inspect usernames**
   ```sql
   SELECT username, owner_type, owner_id, provider, verified_at
   FROM public.usernames
   ORDER BY username;
   ```

2. **Connect X** with a new account and confirm the handle appears as `profiles.username` and in `usernames` with `provider='x'` and `verified_at` set.

3. **Takeover**: create a placeholder profile with username `somehandle` (no X connected). Connect X with another user whose handle is `somehandle`. The placeholder should get `test-<id>`, and the X user should get `somehandle`.

4. **Verified conflict**: connect two different X accounts that both want the same handle; the second should get **409** and the message “That X handle is already taken by a verified account…”.

5. **Sync without body**: `curl -X POST https://your-app/api/x-sync -H "Authorization: Bearer <token>"` (no body). Should return 200 (or 409 if handle taken), not 500.
