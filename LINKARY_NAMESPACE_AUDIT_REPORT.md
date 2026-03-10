# Linkary: Namespace Audit Report (Phase 1)

**Date:** Run from audit script output.  
**Scope:** Read-only global namespace audit per `LINKARY_FINAL_URL_ARCHITECTURE_AND_NAMESPACE_PLAN.md` Phase 1.  
**Script:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts`  
**No data was modified.**

---

## 1. Summary of Findings

| Category | Count | Status |
|----------|--------|--------|
| Profile slugs (username / twitter_username, normalized) | 16 | — |
| Org slugs (normalized) | 3 | — |
| usernames table rows (unique normalized slugs) | 13 | — |
| **Profile/org slug collisions** (same slug in both) | **1** | **Must resolve** |
| **usernames table conflicts** (same slug, multiple owners) | **0** | None |
| **Orgs missing from usernames** (backfill needed) | **3** | Backfill after resolving collision |

**Verdict:** One collision exists. Three orgs have no row in `usernames`. Do **not** run namespace backfill until the collision is resolved.

---

## 2. Do Any Collisions Exist?

**Yes.** There is **1** profile/org slug collision.

### 2.1 Exact list of problematic slugs/entities

**Collision (same slug claimed by both a profile and an org):**

| Slug | Owner type | Entity ID | Notes |
|------|------------|-----------|--------|
| `desicryptoclub` | profile | `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed` | Profile (username or twitter_username) |
| `desicryptoclub` | org | `520af360-4196-4a41-94d3-523b0ae6c4cc` | Org slug |

- **Profile ID:** `ce3dbb39-5ff3-4712-bbd1-19cbd32583ed`  
- **Org ID:** `520af360-4196-4a41-94d3-523b0ae6c4cc`  

Current resolver behavior (`getPublicEntityByUsername`: profile first, then org) means `linkary.xyz/desicryptoclub` resolves to the **profile**. The org with slug `desicryptoclub` is only reachable today if the user is distinguished by another path (e.g. in-app org by ID). After single-namespace enforcement, only one of these can own `desicryptoclub`.

---

## 3. usernames Table Conflicts

**None.** No slug in the `usernames` table has multiple owners (multiple rows with the same normalized slug and different `owner_type` or `owner_id`). The only conflict is between **denormalized** data: one profile and one org both use the slug in `profiles`/`orgs`, and the audit compares those tables.

---

## 4. Orgs Missing from usernames

**Yes.** **3** orgs have a slug in `orgs` but no corresponding row in `usernames` (no `owner_type = 'org'`, `owner_id = org.id` for that slug).

### 4.1 Exact list

| Org slug (normalized) | Org ID |
|------------------------|--------|
| `desi-crypto-club` | `a74ed16b-cf06-4ccf-bf6d-7dad536e28cf` |
| `desicrypto-club` | `ea3d34eb-123e-4096-ac2f-04d1db9ea2c2` |
| `desicryptoclub` | `520af360-4196-4a41-94d3-523b0ae6c4cc` |

These three orgs were created without going through the shared-namespace flow (e.g. `create_org_and_membership` does not insert into `usernames`). Backfilling them into `usernames` must happen **after** resolving the collision for `desicryptoclub`, because that slug cannot be assigned to both the profile and the org.

---

## 5. Recommended Resolution for Each Issue

### 5.1 Collision: `desicryptoclub` (profile vs org)

**Options (product decision):**

1. **Profile keeps `desicryptoclub`**  
   - Leave the profile as the canonical owner of `desicryptoclub` in the global namespace.  
   - **Org:** Change the org’s slug from `desicryptoclub` to a different, unique slug (e.g. `desicryptoclub-org`, `desicrypto-club-official`, or another agreed name).  
   - After change: insert/update `usernames` so the profile owns `desicryptoclub`; when backfilling orgs, do **not** add `desicryptoclub` for the org (org gets the new slug only).

2. **Org keeps `desicryptoclub`**  
   - Treat the org as the canonical owner.  
   - **Profile:** Change the profile’s username (and/or twitter_username if it matches) to something else (e.g. add suffix or use another handle).  
   - Update `usernames` and profile so the org owns `desicryptoclub`; backfill org into `usernames` with slug `desicryptoclub`.

3. **Manual review**  
   - Decide which entity (profile or org) is the “real” product owner of the brand/handle `desicryptoclub` and assign the slug only to that entity; update the other entity’s slug/username so it no longer uses `desicryptoclub`.

**Recommendation:** Choose one owner (profile or org) and update the other entity’s slug/username; then run the audit again to confirm zero collisions before any backfill.

### 5.2 Orgs missing from usernames (backfill)

**After** the collision is resolved:

- For each org that should keep its current slug (and that slug is unique in the namespace):  
  Insert one row into `usernames`: `username = org.slug` (normalized), `owner_type = 'org'`, `owner_id = org.id`.  
- For the org that **currently** has slug `desicryptoclub`:  
  - If the profile keeps `desicryptoclub`, first change this org’s slug (see 5.1), then backfill the org’s **new** slug into `usernames`.  
  - If the org keeps `desicryptoclub`, ensure the profile no longer uses that slug, then backfill this org’s slug into `usernames`.

Do **not** backfill the three orgs as-is before resolving the collision; that would create a usernames conflict for `desicryptoclub`.

---

## 6. Is It Safe to Proceed to Namespace Backfill?

**No.**

- **Collision:** One slug (`desicryptoclub`) is shared by a profile and an org. Backfilling orgs into `usernames` without resolving this would either duplicate the slug (if both profile and org are backfilled) or leave the namespace inconsistent.  
- **Required order:**  
  1. Resolve the profile/org collision for `desicryptoclub` (assign the slug to exactly one entity and update the other).  
  2. Re-run the audit script and confirm **0** profile/org collisions.  
  3. Then run the one-time backfill so every org’s (final) slug has a row in `usernames`.  
  4. Then enforce `create_org_and_membership` (and org slug updates) to use `usernames` so no new collisions can occur.

---

## 7. Final Verdict

| Verdict | Action |
|--------|--------|
| **Resolve collisions first** | Do **not** run namespace backfill yet. |

**Next steps:**

1. **Product decision:** Decide whether the profile or the org should own the slug `desicryptoclub`.  
2. **Data change (single fix):** Update the other entity’s slug/username so it no longer uses `desicryptoclub`.  
3. **Re-run audit:** `pnpm exec tsx apps/web/scripts/auditNamespaceCollisions.ts` → must report 0 collisions.  
4. **Then:** Proceed to Phase 1 backfill (insert missing orgs into `usernames`) and continue with the rest of the plan (enforce org create/update to use usernames, then resolver, then `/app/...` and `/org/:slug`).

---

*Audit performed read-only. No database or application data was modified.*
