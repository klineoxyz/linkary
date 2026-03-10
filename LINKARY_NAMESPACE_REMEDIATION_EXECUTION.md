# Linkary: Namespace Remediation Execution (Option B — Org Keeps `desicryptoclub`)

**Decision:** The org keeps `desicryptoclub`.  
**Date executed:** Per migration and script runs below.  
**Reference:** `LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md` Option B.

---

## 1. Exact Changes Made

### 1.1 Database migrations applied

1. **`20260320000000_namespace_option_b_desicryptoclub_org_keeps.sql`**
   - Updated **profiles**: set `username = 'profile-dsc-ce3dbb39'` and `updated_at = now()` for profile id `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed`.
   - **usernames:** Deleted any row with `username = 'desicryptoclub'` and `owner_type = 'profile'` and `owner_id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed'`.
   - **usernames:** Inserted (or updated on conflict) one row: `username = 'desicryptoclub'`, `owner_type = 'org'`, `owner_id = '520af360-4196-4a41-94d3-523b0ae6c4cc'`.

2. **`20260320000001_namespace_option_b_clear_profile_twitter_handle.sql`**
   - Updated **profiles**: set `twitter_username = NULL` and `updated_at = now()` for profile id `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed` where the normalized `twitter_username` was `'desicryptoclub'`. This was required because the namespace audit treats both `profiles.username` and `profiles.twitter_username` as profile-held slugs; clearing only `username` left a collision from `twitter_username`.

### 1.2 Backfill script

- **`apps/web/scripts/backfillOrgUsernames.ts`** was run after the migrations. It inserted into **usernames** for the two orgs that were still missing: `desi-crypto-club`, `desicrypto-club`. The org `desicryptoclub` was already present from the first migration and was skipped (already present).

---

## 2. Profile Old/New Username

| Field | Before | After |
|-------|--------|--------|
| **Profile ID** | `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed` | (unchanged) |
| **profiles.username** | `desicryptoclub` (or same normalized) | `profile-dsc-ce3dbb39` |
| **profiles.twitter_username** | `desicryptoclub` (or @desicryptoclub) | `NULL` (cleared so profile no longer holds the slug) |

The profile’s public URL is now **`linkary.xyz/profile-dsc-ce3dbb39`** (or whatever canonical username they set later via profile edit). The slug **`desicryptoclub`** is owned only by the org.

---

## 3. Usernames Rows Affected

- **Removed:** One row (if it existed): `(username = 'desicryptoclub', owner_type = 'profile', owner_id = 'ce3dbb39-5ff3-4712-bbd1-19cbd32583ed')`.
- **Added/updated:** One row: `(username = 'desicryptoclub', owner_type = 'org', owner_id = '520af360-4196-4a41-94d3-523b0ae6c4cc')`.
- **Backfill added:** Two rows: `(desi-crypto-club, org, a74ed16b-cf06-4ccf-bf6d-7dad536e28cf)` and `(desicrypto-club, org, ea3d34eb-123e-4096-ac2f-04d1db9ea2c2)`.

Net: **`desicryptoclub`** is owned by the org in **usernames**; profile no longer has any usernames row for that slug. Three org slugs now have usernames rows (desicryptoclub from migration, desi-crypto-club and desicrypto-club from backfill).

---

## 4. Audit Results Before/After

### 4.1 Before remediation

- **Command:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts`
- **Result:** Exit code **1** (collisions present).
- **Findings:**
  - Profile slugs (username / twitter_username): 16
  - Org slugs: 3
  - usernames rows (unique normalized slugs): 13
  - **Collisions:** 1 — slug `desicryptoclub` | profileId `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed` | orgId `520af360-4196-4a41-94d3-523b0ae6c4cc`
  - **Orgs not in usernames:** 3 — `desi-crypto-club`, `desicrypto-club`, `desicryptoclub`

### 4.2 After first migration (username only)

- Audit still reported **1 collision** (profile’s `twitter_username` still matched `desicryptoclub`). Backfill script aborted (collision detected).

### 4.3 After follow-up migration (clear twitter_username)

- **Audit:** Exit code **0**. **0 collisions.** Orgs not in usernames: 2 (`desi-crypto-club`, `desicrypto-club` — `desicryptoclub` org already had a usernames row from the first migration).

### 4.4 After backfill

- **Backfill:** Inserted 2; skipped 1 (already present: `desicryptoclub` org).

### 4.5 Final audit (after backfill)

- **Command:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts`
- **Result:** Exit code **0**.
- **Findings:**
  - Profile slugs: 16
  - Org slugs: 3
  - usernames rows: 15
  - **Collisions:** 0
  - **Orgs not in usernames:** 0 (no “backfill needed” message).

---

## 5. Backfill Results

- **Script:** `pnpm exec tsx apps/web/scripts/backfillOrgUsernames.ts`
- **Run:** After remediation (both migrations applied).
- **Result:** Exit code **0**.
- **Inserted:** 2 rows — `desi-crypto-club` (org id `a74ed16b-cf06-4ccf-bf6d-7dad536e28cf`), `desicrypto-club` (org id `ea3d34eb-123e-4096-ac2f-04d1db9ea2c2`).
- **Skipped (already present):** 1 — `desicryptoclub` (org id `520af360-4196-4a41-94d3-523b0ae6c4cc`).
- **Skipped (slug taken):** 0.

---

## 6. Final Verdict: Namespace Clean Enough to Proceed to Route Migration?

**Yes.** The namespace is clean enough to proceed to route migration.

- **Collisions:** 0.
- **Orgs missing from usernames:** 0.
- **Single owner per slug:** `desicryptoclub` is owned only by the org in **usernames**; the profile no longer holds it in `username` or `twitter_username`.

Next steps (per `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` and `LINKARY_NAMESPACE_REMEDIATION_AND_BACKFILL_PLAN.md`): enforce org create/update through usernames, switch public resolver to usernames-based, then add `/app/...` and `/org/:slug` routes, migrate internal links, and add redirects.

---

## 7. Explicit Final Decision: Wrong-Type In-App Route Behavior

The docs previously allowed wrong-type in-app routes to either **404** or **redirect**. That is now finalized.

### 7.1 Decision: **Redirect to public canonical route**

- **When:** A request hits an in-app route for a slug that is owned by the **other** entity type:
  - **`/u/:username`** but the slug is **org-owned** (e.g. `/u/desicryptoclub` when `desicryptoclub` is an org).
  - **`/org/:slug`** but the slug is **profile-owned** (e.g. `/org/someuser` when `someuser` is a profile).
- **Behavior:** Respond with **302 Redirect** to the **public canonical** URL **`/:segment`** (same slug, root path). Do **not** return 404 and do **not** serve the wrong entity type.

### 7.2 Rationale

- **UX:** The user sees the correct content (public profile or public org) instead of a dead 404.
- **Canonical:** The public URL is the single source of truth for that slug; redirecting there keeps one canonical destination and avoids duplicate content.
- **Links:** Shared or bookmarked wrong-type URLs (e.g. `/u/desicryptoclub` when it’s an org) still resolve to the right page.
- **SEO:** Redirect to canonical is standard; 404 would waste crawl and confuse indexing.

### 7.3 Doc updates

- **`LINKARY_ENTITY_BOUND_SLUG_OWNERSHIP.md`** was updated to state the **wrong-type in-app route policy** explicitly:
  - New subsection **2.4 Wrong-type in-app route policy (final)** with the choice (302 redirect to `/:segment`), rationale, and implementation note.
  - Summary table and all references to “404 or redirect” for wrong-type routes were changed to **302 redirect to `/:segment`** (public canonical).

Implementation for `/u/:username` and `/org/:slug` should resolve the segment from usernames; if `owner_type` does not match the route (profile for `/u/*`, org for `/org/*`), return **302 Redirect** to `/{segment}`.

---

*End of document.*
